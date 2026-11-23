import { memberPrivateSitAccessPredicate } from './memberPrivateSits';
import { retryKeptPhotoCleanup } from './privateKeptSetupPhotos';
import { privatePhotoResponse, readPrivatePhotoUpload, servePrivatePhotoObject, validatePrivatePhotoBytes } from './privatePhotoUpload';

type SubjectPhoto = { id: string; created_at: string; tea_id: null; own?: boolean | number; shared?: boolean | number };
const limit = 12;

const subjectStores = {
  sit: {
    table: 'private_member_sit_photos',
    column: 'sit_id',
    source: `SELECT 1 FROM member_private_sits AS sit WHERE id = ?1 AND ${memberPrivateSitAccessPredicate('?2')}`,
  },
} as const;

export async function servePrivateSubjectPhotos(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, userId: string, subject: keyof typeof subjectStores, subjectId: string, photoId?: string,
) {
  const { table, column, source } = subjectStores[subject];
  const scope = `${column} = ? AND user_id = ?`;
  const owned = await db.prepare(source).bind(subjectId, userId).first();
  if (!owned) return privatePhotoResponse({ error: 'Photo subject not found.' }, 404);

  if (photoId) {
    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null) as { share?: unknown } | null;
      if (typeof body?.share !== 'boolean') return privatePhotoResponse({ error: 'Choose who can see this photo.' }, 400);
      const update = await db.prepare(
        `UPDATE ${table} SET share_id = CASE WHEN ?4 = 1 THEN COALESCE(share_id, ?5) ELSE NULL END
         WHERE ${column} = ?1 AND user_id = ?2 AND id = ?3 AND EXISTS (${source})`,
      ).bind(subjectId, userId, photoId, Number(body.share), crypto.randomUUID()).run();
      return update.meta.changes ? privatePhotoResponse({ success: true })
        : privatePhotoResponse({ error: 'Photo not found.' }, 404);
    }
    const readShared = request.method === 'GET';
    const photoSql = readShared
      ? `SELECT object_key FROM ${table} WHERE ${column} = ?1
         AND ((user_id = ?2 AND id = ?3) OR share_id = ?3)
         ORDER BY user_id = ?2 AND id = ?3 DESC LIMIT 1`
      : `SELECT object_key FROM ${table} WHERE ${scope} AND id = ?`;
    const photo = await db.prepare(photoSql).bind(subjectId, userId, photoId).first<{ object_key: string }>();
    if (!photo) return privatePhotoResponse({ error: 'Photo not found.' }, 404);
    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM ${table} WHERE ${scope} AND id = ?`)
        .bind(subjectId, userId, photoId).run();
      await retryKeptPhotoCleanup(db, bucket);
      return privatePhotoResponse({ success: true });
    }
    return servePrivatePhotoObject(bucket, photo.object_key);
  }

  if (request.method === 'GET') {
    const list = `SELECT CASE WHEN user_id = ?2 THEN id ELSE share_id END AS id, created_at, NULL AS tea_id,
                user_id = ?2 AS own, share_id IS NOT NULL AS shared
         FROM ${table} WHERE ${column} = ?1 AND (user_id = ?2 OR share_id IS NOT NULL)
         ORDER BY created_at DESC, id DESC`;
    const { results } = await db.prepare(list).bind(subjectId, userId).all<SubjectPhoto>();
    return privatePhotoResponse({ photos: results });
  }
  if (!bucket) return privatePhotoResponse({ error: 'Private photo storage is unavailable.' }, 503);
  const upload = await readPrivatePhotoUpload(request);
  if (upload.error) return upload.error;
  const readPhoto = () => db.prepare(
    `SELECT id, created_at, NULL AS tea_id FROM ${table} WHERE ${scope} AND id = ?`
  ).bind(subjectId, userId, upload.photoId).first<SubjectPhoto>();
  const before = await readPhoto();
  if (before) return privatePhotoResponse(before);

  const image = await validatePrivatePhotoBytes(upload.image);
  if (image.error) return image.error;
  const key = 'private-kept-setups/' + crypto.randomUUID() + '.jpg';
  await bucket.put(key, image.bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  let persisted = false;
  try {
    const added = await db.prepare(
      `INSERT INTO ${table} (${column}, user_id, id, object_key, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
       WHERE EXISTS (${source})
         AND (SELECT count(*) FROM ${table} WHERE ${column} = ?1 AND user_id = ?2) < ?6
       ON CONFLICT DO NOTHING`
    ).bind(subjectId, userId, upload.photoId, key, new Date().toISOString(), limit).run();
    persisted = Boolean(added.meta?.changes);
    const photo = await readPhoto();
    return photo ? privatePhotoResponse({ ...photo, own: true, shared: false }, persisted ? 201 : 200)
      : privatePhotoResponse({ error: 'This record is missing or has reached its photo limit.' }, 409);
  } finally {
    if (!persisted) {
      await db.prepare('INSERT OR IGNORE INTO private_kept_photo_cleanup (object_key) VALUES (?)').bind(key).run();
      await retryKeptPhotoCleanup(db, bucket);
    }
  }
}
