import { privatePhotoResponse as response, readPrivatePhotoUpload, servePrivatePhotoObject, validatePrivatePhotoBytes } from './privatePhotoUpload';
import { readSessionServedTeas } from './sessionServedTeas';

type Scope = { accountId: string; userId: string };
type Photo = { id: string; tea_id: string | null; created_at: string };
const limit = 12;
const ownedSetup = 'account_id = ? AND user_id = ? AND event_id = ?';
const ownership = (scope: Scope, eventId: string) => [scope.accountId, scope.userId, eventId];

export function queueKeptPhotoCleanupForUser(db: D1Database, userId: string) {
  return db.prepare(
    `INSERT OR IGNORE INTO private_kept_photo_cleanup (object_key)
     SELECT object_key FROM private_kept_setup_photos WHERE user_id = ?`
  ).bind(userId);
}

export async function retryKeptPhotoCleanup(db: D1Database, bucket?: R2Bucket) {
  if (!bucket) return;
  const { results } = await db.prepare(
    'SELECT object_key FROM private_kept_photo_cleanup ORDER BY object_key LIMIT 20'
  ).all<{ object_key: string }>();
  if (!results.length) return;
  const keys = results.map(row => row.object_key);
  try {
    await bucket.delete(keys);
  } catch {
    return; // The keys stay queued for the next retry.
  }
  await db.batch(keys.map(key => db.prepare(
    'DELETE FROM private_kept_photo_cleanup WHERE object_key = ?'
  ).bind(key)));
}

export async function eraseKeptSetup(db: D1Database, scope: Scope, eventId: string) {
  const binds = ownership(scope, eventId);
  const deleted = await db.prepare(
    `DELETE FROM private_kept_setups WHERE ${ownedSetup}
       AND NOT EXISTS (SELECT 1 FROM private_kept_setup_photos WHERE ${ownedSetup})`
  ).bind(...binds, ...binds).run();
  if (deleted.meta?.changes) return true;
  const remaining = await db.prepare(
    `SELECT 1 FROM private_kept_setups WHERE ${ownedSetup}`
  ).bind(...binds).first();
  return !remaining;
}

export async function serveKeptSetupPhotos(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, scope: Scope, eventId: string, id?: string,
) {
  const binds = ownership(scope, eventId);
  const kept = await db.prepare(
    `SELECT teas_json FROM private_kept_setups WHERE ${ownedSetup}`
  ).bind(...binds).first<{ teas_json: string }>();
  if (!kept) return response({ error: 'Saved setup not found.' }, 404);

  if (id) {
    const photo = await db.prepare(
      `SELECT object_key FROM private_kept_setup_photos WHERE ${ownedSetup} AND id = ?`
    ).bind(...binds, id).first<{ object_key: string }>();
    if (!photo) return response({ error: 'Photo not found.' }, 404);
    if (request.method === 'DELETE') {
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO private_kept_photo_cleanup (object_key) VALUES (?)').bind(photo.object_key),
        db.prepare(`DELETE FROM private_kept_setup_photos WHERE ${ownedSetup} AND id = ?`).bind(...binds, id),
      ]);
      await retryKeptPhotoCleanup(db, bucket);
      return response({ success: true });
    }
    return servePrivatePhotoObject(bucket, photo.object_key);
  }

  if (request.method === 'GET') {
    const { results } = await db.prepare(
      `SELECT id, tea_id, created_at FROM private_kept_setup_photos
       WHERE ${ownedSetup} ORDER BY created_at DESC, id DESC`
    ).bind(...binds).all<Photo>();
    return response({ photos: results });
  }
  if (!bucket) return response({ error: 'Private photo storage is unavailable.' }, 503);
  const upload = await readPrivatePhotoUpload(request, true);
  if (upload.error) return upload.error;
  const { photoId, teaId, image } = upload;
  if (teaId && !(JSON.parse(kept.teas_json) as { id: string }[]).some(tea => tea.id === teaId)) {
    // Existing snapshots keep their older teas. A guest may also attach a
    // photo to a tea the host subsequently recorded for this exact session.
    const current = await readSessionServedTeas(db, scope.accountId, eventId);
    if (!current.results.some(tea => tea.id === teaId)) {
      return response({ error: 'That tea is not part of this saved setup.' }, 400);
    }
  }

  const readPhoto = () => db.prepare(
    `SELECT id, tea_id, created_at FROM private_kept_setup_photos WHERE ${ownedSetup} AND id = ?`
  ).bind(...binds, photoId).first<Photo>();
  const before = await readPhoto();
  if (before) return response(before);

  const parsed = await validatePrivatePhotoBytes(image);
  if (parsed.error) return parsed.error;
  const key = 'private-kept-setups/' + crypto.randomUUID() + '.jpg';
  await bucket.put(key, parsed.bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  let persisted = false;
  try {
    const added = await db.prepare(
      `INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE EXISTS (SELECT 1 FROM private_kept_setups WHERE account_id = ?1 AND user_id = ?2 AND event_id = ?3)
         AND (SELECT count(*) FROM private_kept_setup_photos WHERE account_id = ?1 AND user_id = ?2 AND event_id = ?3) < ?8
       ON CONFLICT(account_id, user_id, event_id, id) DO NOTHING`
    ).bind(...binds, photoId, teaId, key, new Date().toISOString(), limit).run();
    persisted = Boolean(added.meta?.changes);
    const photo = await readPhoto();
    return photo ? response(photo, persisted ? 201 : 200)
      : response({ error: 'This setup is missing or has reached its photo limit.' }, 409);
  } finally {
    if (!persisted) {
      await db.prepare('INSERT OR IGNORE INTO private_kept_photo_cleanup (object_key) VALUES (?)').bind(key).run();
      await retryKeptPhotoCleanup(db, bucket);
    }
  }
}
