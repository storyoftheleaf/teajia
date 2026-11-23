import { currentAfterSitLink } from './afterSitCredential';
import { privateAttendeeSeatMatch } from './privateSessionReflections';
import { privatePhotoHeaders } from './privatePhotoUpload';
import { readSitPhotoRendition, sitPhotoRenditionResponse } from './revocableSitPhotos';

export type GuestBookPhotoInput = { action?: unknown; photoId?: unknown; grantId?: unknown; description?: unknown };
type Scope = { accountId: string; userId: string };
type Seat = { account_id: string; event_id: string; id: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const isId = (id: unknown): id is string => typeof id === 'string' && uuid.test(id);
const json = (body: object, status = 200) => Response.json(body, { status, headers: privatePhotoHeaders });
const missing = () => json({ error: 'Guest Book photo not found.' }, 404);
const ineligible = () => json({ error: 'Confirm your own attendance to open the Guest Book photos.' }, 403);

const guestCheck = `${currentAfterSitLink} AND ${privateAttendeeSeatMatch}`;
const eventCheck = "e.lifecycle_status IN ('completed', 'archived') AND shop.status = 'active'";
const roster = `FROM session_guest_book_photos g
  JOIN private_kept_setup_photos p
    ON p.account_id = g.account_id AND p.user_id = g.user_id AND p.event_id = g.event_id AND p.id = g.photo_id
  JOIN event_attendees contributor
    ON contributor.id = g.attendee_id AND contributor.account_id = g.account_id
    AND contributor.event_id = g.event_id AND contributor.user_id = g.user_id
  JOIN events e ON e.id = g.event_id AND e.account_id = g.account_id
  JOIN accounts shop ON shop.id = e.account_id
  WHERE g.revoked_at IS NULL AND contributor.status = 'confirmed' AND contributor.attended = 1
    AND ${eventCheck}`;
const visiblePhoto = 'g.id, contributor.full_name AS display_name, g.alt_text';
const sourceDescription = `COALESCE(NULLIF(?, ''), (
  SELECT 'Photo of ' || substr(trim(json_extract(tea.value, '$.name')), 1, 240)
  FROM private_kept_setups k, json_each(k.teas_json) tea
  WHERE k.account_id = p.account_id AND k.user_id = p.user_id AND k.event_id = p.event_id
    AND json_extract(tea.value, '$.id') = p.tea_id AND trim(json_extract(tea.value, '$.name')) <> ''
  LIMIT 1
), CASE WHEN p.tea_id IS NULL THEN 'Photo of the tea setup' ELSE 'Photo shared at this sit' END)`;

function guestSeat(db: D1Database, binds: string[]) {
  return db.prepare(`SELECT a.account_id, a.event_id, a.id FROM event_attendees a WHERE ${guestCheck}`)
    .bind(...binds).first<Seat>();
}

async function serveBytes(request: Request, bucket: R2Bucket | undefined, source: () => Promise<{ object_key: string } | null>) {
  const photo = await source();
  if (!photo) return missing();
  if (!bucket) return json({ error: 'Private photo storage is unavailable.' }, 503);
  const bytes = await readSitPhotoRendition(bucket, photo.object_key);
  return bytes && await source() ? sitPhotoRenditionResponse(request, bytes) : missing();
}

export async function serveGuestBookPhotos(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, scope: Scope, credentialHash: string,
  { action, photoId, grantId, description }: GuestBookPhotoInput,
) {
  const binds = [credentialHash, scope.accountId, scope.userId, scope.userId];
  const seat = await guestSeat(db, binds);
  if (!seat) return ineligible();
  const event = [seat.account_id, seat.event_id];
  const ownSource = `p.account_id = ? AND p.event_id = ? AND p.user_id = ?`;
  if (action === 'photos-read') {
    const [gallery, own] = await Promise.all([
      db.prepare(`SELECT ${visiblePhoto} ${roster}
        AND g.account_id = ? AND g.event_id = ? AND g.status = 'included'
        ORDER BY g.offered_at DESC, g.id`).bind(...event).all(),
      db.prepare(`SELECT p.id, p.tea_id, p.created_at,
          json_extract(tea.value, '$.name') AS tea_name,
          g.id AS grant_id, g.status, g.alt_text
        FROM private_kept_setup_photos p
        JOIN private_kept_setups k
          ON k.account_id = p.account_id AND k.user_id = p.user_id AND k.event_id = p.event_id
        LEFT JOIN json_each(k.teas_json) tea ON json_extract(tea.value, '$.id') = p.tea_id
        LEFT JOIN session_guest_book_photos g ON g.account_id = p.account_id AND g.event_id = p.event_id
          AND g.user_id = p.user_id AND g.photo_id = p.id AND g.revoked_at IS NULL
        WHERE ${ownSource}
        ORDER BY p.created_at DESC, p.id`).bind(...event, scope.userId).all(),
    ]);
    return await guestSeat(db, binds) ? json({ gallery: gallery.results, own: own.results }) : ineligible();
  }
  if (action === 'photo-bytes' || action === 'private-photo-preview') {
    if (action === 'photo-bytes' ? !isId(grantId) : !isId(photoId)) return missing();
    const viewer = `EXISTS (SELECT 1 FROM event_attendees a WHERE ${guestCheck}
      AND a.account_id = p.account_id AND a.event_id = p.event_id)`;
    return serveBytes(request, bucket, () => action === 'photo-bytes'
      ? db.prepare(`SELECT p.object_key ${roster}
          AND g.account_id = ? AND g.event_id = ? AND g.id = ? AND g.status = 'included' AND ${viewer}`)
        .bind(...event, grantId, ...binds).first<{ object_key: string }>()
      : db.prepare(`SELECT p.object_key FROM private_kept_setup_photos p
          WHERE ${ownSource} AND p.id = ? AND ${viewer}`)
        .bind(...event, scope.userId, photoId, ...binds).first<{ object_key: string }>());
  }
  if (action === 'photo-withdraw') {
    if (!isId(grantId)) return missing();
    const removed = await db.prepare(
      `UPDATE session_guest_book_photos SET revoked_at = COALESCE(revoked_at, ?)
       WHERE id = ? AND account_id = ? AND event_id = ? AND user_id = ?
         AND EXISTS (SELECT 1 FROM event_attendees a WHERE ${guestCheck} AND a.id = ?)`
    ).bind(new Date().toISOString(), grantId, ...event, scope.userId, ...binds, seat.id).run();
    return removed.meta?.changes ? json({ success: true }) : missing();
  }
  if (action !== 'photo-offer') return json({ error: 'Choose a Guest Book photo action.' }, 400);
  const alt = typeof description === 'string' ? description.trim() : '';
  if (!isId(grantId) || !isId(photoId) || alt.length > 250) {
    return json({ error: 'Choose a photo and keep any description to 250 characters.' }, 400);
  }

  const [, inserted] = await db.batch([
    db.prepare(`UPDATE event_attendees AS a SET user_id = ?
      WHERE a.user_id IS NULL AND ${guestCheck} AND a.id = ?
        AND EXISTS (SELECT 1 FROM private_kept_setup_photos p WHERE ${ownSource} AND p.id = ?)`)
      .bind(scope.userId, ...binds, seat.id, ...event, scope.userId, photoId),
    db.prepare(`INSERT INTO session_guest_book_photos
        (id, account_id, event_id, attendee_id, user_id, photo_id, alt_text, status, offered_at)
      SELECT ?, p.account_id, p.event_id, a.id, p.user_id, p.id, ${sourceDescription}, 'pending', ?
      FROM private_kept_setup_photos p
      JOIN event_attendees a ON a.account_id = p.account_id AND a.event_id = p.event_id AND a.user_id = p.user_id
      WHERE ${ownSource} AND p.id = ? AND ${guestCheck} AND a.id = ?
      ON CONFLICT DO NOTHING`)
      .bind(grantId, alt, new Date().toISOString(), ...event, scope.userId, photoId, ...binds, seat.id),
  ]);
  if (inserted.meta?.changes) return json({ success: true }, 201);
  const same = await db.prepare(`SELECT 1 ${roster} AND g.id = ? AND g.account_id = ?
    AND g.event_id = ? AND g.attendee_id = ? AND g.user_id = ? AND g.photo_id = ? AND g.alt_text = ${sourceDescription}`)
    .bind(grantId, ...event, seat.id, scope.userId, photoId, alt).first();
  return same && await guestSeat(db, binds) ? json({ success: true })
    : json({ error: 'This photo or contribution has changed. Check the current contribution.' }, 409);
}

export async function serveOwnerGuestBookPhoto(
  request: Request, db: D1Database, userId: string, eventId: string, photoId: string,
) {
  const match = 'g.event_id = ? AND g.user_id = ? AND g.photo_id = ?';
  const binds = [eventId, userId, photoId];
  if (request.method === 'GET') {
    const grant = await db.prepare(`SELECT g.id, g.status FROM session_guest_book_photos g
      WHERE ${match} AND g.revoked_at IS NULL`).bind(...binds).first();
    return json({ grant });
  }
  const body = await request.json().catch(() => null) as { grantId?: unknown } | null;
  if (!isId(body?.grantId)) return missing();
  const removed = await db.prepare(`UPDATE session_guest_book_photos AS g SET revoked_at = COALESCE(revoked_at, ?)
    WHERE ${match} AND g.id = ?`).bind(new Date().toISOString(), ...binds, body.grantId).run();
  return removed.meta?.changes ? json({ success: true }) : missing();
}

export async function reviewGuestBookPhotos(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, accountId: string, eventId: string, grantId?: string,
) {
  const event = [accountId, eventId];
  const found = await db.prepare(`SELECT 1 FROM events e JOIN accounts shop ON shop.id = e.account_id
    WHERE e.account_id = ? AND e.id = ? AND ${eventCheck}`).bind(...event).first();
  if (!found) return missing();
  const scoped = `${roster} AND g.account_id = ? AND g.event_id = ?`;
  if (!grantId) {
    const { results } = await db.prepare(`SELECT ${visiblePhoto}, g.status ${scoped}
      ORDER BY CASE g.status WHEN 'pending' THEN 0 WHEN 'included' THEN 1 ELSE 2 END, g.offered_at DESC, g.id`)
      .bind(...event).all();
    return json({ photos: results });
  }
  if (!isId(grantId)) return missing();
  const source = () => db.prepare(`SELECT p.object_key ${scoped} AND g.id = ?`)
    .bind(...event, grantId).first<{ object_key: string }>();
  if (request.method === 'GET') return serveBytes(request, bucket, source);
  const body = await request.json().catch(() => null) as { action?: unknown; status?: unknown } | null;
  if ((body?.action !== 'include' && body?.action !== 'pass') ||
      (body.status !== 'pending' && body.status !== 'included' && body.status !== 'passed')) {
    return json({ error: 'Choose an action for the current contribution.' }, 400);
  }
  if (body.action === 'include') {
    const photo = await source();
    if (!photo) return json({ error: 'This contribution changed. Check the current review status.' }, 409);
    if (!bucket || !await readSitPhotoRendition(bucket, photo.object_key)) {
      return json({ error: 'The photo preview is unavailable.' }, 409);
    }
  }
  const updated = await db.prepare(`UPDATE session_guest_book_photos SET status = ?
    WHERE id IN (SELECT g.id ${scoped} AND g.id = ? AND g.status = ?)`)
    .bind(body.action === 'include' ? 'included' : 'passed', ...event, grantId, body.status).run();
  return updated.meta?.changes ? json({ success: true })
    : json({ error: 'This contribution changed. Check the current review status.' }, 409);
}
