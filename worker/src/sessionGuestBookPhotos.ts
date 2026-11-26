import { currentAfterSitLink } from './afterSitCredential';
import { privateAttendeeSeatMatch } from './privateSessionReflections';
import { privatePhotoHeaders } from './privatePhotoUpload';
import { GUEST_BOOK_NOTE_LIMIT, guestBookEntryKeys, prepareGuestBookNote, type GuestBookPlacement } from './sessionGuestBook';
import { readSitPhotoRendition, sitPhotoRenditionResponse } from './revocableSitPhotos';
import { sessionServedTeaName } from './sessionServedTeas';

export type GuestBookPhotoInput = {
  action?: unknown; photoId?: unknown; grantId?: unknown; description?: unknown;
  /** The taker's own choice, made when offering: true shows their first name beside the photograph. */
  showName?: unknown;
};
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
const visiblePhoto = 'g.id, contributor.full_name AS display_name, g.alt_text, g.user_id';
/**
 * What other guests may know of a photograph's taker: the first name, and only
 * when the taker chose to show it when offering. Never the full name.
 */
const takerFirstName = `CASE WHEN g.show_name = 1 THEN NULLIF(substr(trim(contributor.full_name), 1,
  instr(trim(contributor.full_name) || ' ', ' ') - 1), '') END`;
const guestVisiblePhoto = `g.id, ${takerFirstName} AS display_name, g.alt_text, g.user_id`;
const servedTea = sessionServedTeaName();
const sourceDescription = `COALESCE(NULLIF(?, ''), 'Photo of ' || ${servedTea}, (
  SELECT 'Photo of ' || substr(trim(json_extract(tea.value, '$.name')), 1, 240)
  FROM private_kept_setups k, json_each(k.teas_json) tea
  WHERE k.account_id = p.account_id AND k.user_id = p.user_id AND k.event_id = p.event_id
    AND json_extract(tea.value, '$.id') = p.tea_id AND trim(json_extract(tea.value, '$.name')) <> ''
  LIMIT 1
), CASE WHEN p.tea_id IS NULL THEN 'Photo of the tea setup' ELSE 'Photo shared at this sit' END)`;

function revokePublicUses(
  db: D1Database, guestBookPhotoWhere: string, binds: string[], now: string,
) {
  return db.prepare(`UPDATE sit_photo_public_permissions AS permission SET revoked_at = ?
    WHERE permission.revoked_at IS NULL AND EXISTS (
      SELECT 1 FROM session_guest_book_photos g
      WHERE g.revoked_at IS NULL AND ${guestBookPhotoWhere}
        AND g.account_id = permission.account_id AND g.event_id = permission.event_id
        AND g.user_id = permission.user_id AND g.photo_id = permission.photo_id
    )`).bind(now, ...binds);
}

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
  input: GuestBookPhotoInput,
) {
  const { action, photoId, grantId, description } = input;
  const binds = [credentialHash, scope.accountId, scope.userId, scope.userId];
  const seat = await guestSeat(db, binds);
  if (!seat) return ineligible();
  const event = [seat.account_id, seat.event_id];
  const ownSource = `p.account_id = ? AND p.event_id = ? AND p.user_id = ?`;
  if (action === 'photos-read') {
    const [gallery, own] = await Promise.all([
      db.prepare(`SELECT ${guestVisiblePhoto} ${roster}
        AND g.account_id = ? AND g.event_id = ? AND g.status = 'included'
        ORDER BY g.offered_at DESC, g.id`).bind(...event).all<{ user_id: string }>(),
      db.prepare(`SELECT p.id, p.tea_id, p.created_at,
          COALESCE(${servedTea}, json_extract(tea.value, '$.name')) AS tea_name,
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
    const entries = await guestBookEntryKeys(gallery.results, seat.account_id, seat.event_id);
    return await guestSeat(db, binds) ? json({ gallery: entries, own: own.results }) : ineligible();
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
    const now = new Date().toISOString();
    const match = `g.id = ? AND g.account_id = ? AND g.event_id = ? AND g.user_id = ?
      AND EXISTS (SELECT 1 FROM event_attendees a WHERE ${guestCheck} AND a.id = ?)`;
    const photoBinds = [grantId, ...event, scope.userId, ...binds, seat.id];
    const [, removed] = await db.batch([
      revokePublicUses(db, match, photoBinds, now),
      db.prepare(`UPDATE session_guest_book_photos AS g SET revoked_at = COALESCE(revoked_at, ?)
        WHERE ${match}`).bind(now, ...photoBinds),
    ]);
    return removed.meta?.changes ? json({ success: true }) : missing();
  }
  if (action !== 'photo-offer') return json({ error: 'Choose a Guest Book photo action.' }, 400);
  return saveGuestBookPhoto(db, scope, seat, binds, { photoId, grantId, description, showName: input.showName });
}

async function saveGuestBookPhoto(
  db: D1Database, scope: Scope, seat: Seat, binds: string[], { photoId, grantId, description, showName }: GuestBookPhotoInput,
  note = '', placement: GuestBookPlacement = {},
) {
  const alt = typeof description === 'string' ? description.trim() : '';
  if (!isId(grantId) || !isId(photoId) || alt.length > 250) {
    return json({ error: 'Choose a photo and keep any description to 250 characters.' }, 400);
  }
  if (showName !== undefined && typeof showName !== 'boolean') {
    return json({ error: 'Say whether your first name is shown with the photograph.' }, 400);
  }
  const shown = showName === true ? 1 : 0;
  const event = [seat.account_id, seat.event_id];
  const eligibility = `${guestCheck} AND a.id = ?`;
  const eligibilityBinds = [...binds, seat.id];
  const now = new Date().toISOString();
  // Check both the owner's live slot and the submitted grant ID before either
  // component writes. D1 runs the batch in one transaction. Existing grants
  // can stay visible until withdrawn, but cannot admit another active photo.
  const emptySlot = `NOT EXISTS (SELECT 1 FROM session_guest_book_photos existing
    WHERE existing.account_id = p.account_id AND existing.event_id = p.event_id
      AND existing.user_id = p.user_id AND existing.revoked_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM session_guest_book_photos previous WHERE previous.id = ?)`;
  const canOffer = `EXISTS (SELECT 1 FROM private_kept_setup_photos p
    WHERE p.account_id = a.account_id AND p.event_id = a.event_id
      AND p.user_id = ? AND p.id = ? AND ${emptySlot})`;
  const eligibleToOffer = `${eligibility} AND ${canOffer}`;
  const offerBinds = [...eligibilityBinds, scope.userId, photoId, grantId];
  const claim = db.prepare(`UPDATE event_attendees AS a SET user_id = ?
    WHERE a.user_id IS NULL AND ${eligibleToOffer}`).bind(scope.userId, ...offerBinds);
  const offer = db.prepare(`INSERT INTO session_guest_book_photos
      (id, account_id, event_id, attendee_id, user_id, photo_id, alt_text, status, offered_at, show_name)
    SELECT ?, p.account_id, p.event_id, a.id, p.user_id, p.id, ${sourceDescription}, 'pending', ?, ?
      FROM private_kept_setup_photos p
      JOIN event_attendees a ON a.account_id = p.account_id AND a.event_id = p.event_id AND a.user_id = p.user_id
    WHERE p.user_id = ? AND p.id = ? AND ${eligibility} AND ${emptySlot}`)
    .bind(grantId, alt, now, shown, scope.userId, photoId, ...eligibilityBinds, grantId);
  const statements = note
    ? [claim, prepareGuestBookNote(db, scope.userId, note, now, eligibleToOffer, offerBinds, placement), offer]
    : [claim, offer];
  const written = await db.batch(statements);
  if (written.at(-1)?.meta?.changes) return json({ success: true }, 201);

  // Exact retries leave both moderator decisions and newer guest edits alone.
  // Reusing an old grant to submit a different note is a conflict.
  const sameNote = note ? `AND EXISTS (SELECT 1 FROM session_guest_book b
    WHERE b.account_id = g.account_id AND b.event_id = g.event_id AND b.user_id = g.user_id AND b.note = ?)` : '';
  const same = await db.prepare(`SELECT 1 ${roster} AND g.id = ? AND g.account_id = ? AND g.event_id = ?
    AND g.attendee_id = ? AND g.user_id = ? AND g.photo_id = ? AND g.show_name = ?
    AND g.alt_text = ${sourceDescription} ${sameNote}`)
    .bind(grantId, ...event, seat.id, scope.userId, photoId, shown, alt, ...(note ? [note] : [])).first();
  return same && await guestSeat(db, binds) ? json({ success: true })
    : json({ error: 'This entry already has a photo, or the photo changed. Check your current entry.' }, 409);
}

export async function saveGuestBookEntryWithPhoto(
  db: D1Database, scope: Scope, credentialHash: string, note: unknown, photo: unknown, placement: GuestBookPlacement = {},
) {
  const binds = [credentialHash, scope.accountId, scope.userId, scope.userId];
  const seat = await guestSeat(db, binds);
  if (!seat) return ineligible();
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > GUEST_BOOK_NOTE_LIMIT)) {
    return json({ error: 'Keep your note to 280 characters.' }, 400);
  }
  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) return json({ error: 'Choose a photo.' }, 400);
  return saveGuestBookPhoto(db, scope, seat, binds, photo, typeof note === 'string' ? note.trim() : '', placement);
}

export async function withdrawGuestBookEntry(db: D1Database, scope: Scope, credentialHash: string) {
  const binds = [credentialHash, scope.accountId, scope.userId, scope.userId];
  const seat = await guestSeat(db, binds);
  if (!seat) return ineligible();
  const contribution = `account_id = ? AND event_id = ? AND user_id = ?
    AND EXISTS (SELECT 1 FROM event_attendees a WHERE ${guestCheck} AND a.id = ?)`;
  const scoped = [seat.account_id, seat.event_id, scope.userId, ...binds, seat.id];
  const now = new Date().toISOString();
  await db.batch([
    revokePublicUses(db, contribution, scoped, now),
    db.prepare(`DELETE FROM session_guest_book WHERE ${contribution}`).bind(...scoped),
    db.prepare(`UPDATE session_guest_book_photos SET revoked_at = ?
      WHERE revoked_at IS NULL AND ${contribution}`).bind(now, ...scoped),
  ]);
  return await guestSeat(db, binds) ? json({ success: true }) : ineligible();
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
  const now = new Date().toISOString();
  const grant = `${match} AND g.id = ?`;
  const photoBinds = [...binds, body.grantId];
  const [, removed] = await db.batch([
    revokePublicUses(db, grant, photoBinds, now),
    db.prepare(`UPDATE session_guest_book_photos AS g SET revoked_at = COALESCE(revoked_at, ?)
      WHERE ${grant}`).bind(now, ...photoBinds),
  ]);
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
      .bind(...event).all<{ user_id: string }>();
    return json({ photos: await guestBookEntryKeys(results, accountId, eventId) });
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

export type GallerySeat = { account_id: string; event_id: string };
export type GalleryInput = { action?: unknown; grantId?: unknown };

/**
 * The session gallery on the after-sit page (Launch 3, J7): every photograph
 * its taker offered and the host included, not withdrawn, newest first.
 *
 * `resolveSeat` is the same seat check keeps use (the booking's own link or a
 * personal party link), run again after each read so a link revoked mid-way
 * returns nothing. A taker is named by first name only, and only when they
 * chose to be. `own` marks the viewer's own photographs so they can withdraw
 * them; `can_add` is true only when this link can offer a photograph (the
 * booking's own link, opened by the person on that seat).
 */
export async function serveSessionGallery(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, userId: string, credentialHash: string,
  resolveSeat: () => Promise<GallerySeat | null>, { action, grantId }: GalleryInput,
) {
  const seat = await resolveSeat();
  if (!seat) return missing();
  const event = [seat.account_id, seat.event_id];
  if (action === 'read') {
    const offerBinds = [credentialHash, seat.account_id, userId, userId];
    const [photos, offerSeat, waiting] = await Promise.all([
      db.prepare(`SELECT g.id, g.alt_text, ${takerFirstName} AS taker_first_name,
          CASE WHEN g.user_id = ? THEN 1 ELSE 0 END AS own
        ${roster} AND g.account_id = ? AND g.event_id = ? AND g.status = 'included'
        ORDER BY g.offered_at DESC, g.id`).bind(userId, ...event)
        .all<{ id: string; alt_text: string; taker_first_name: string | null; own: number }>(),
      guestSeat(db, offerBinds),
      db.prepare(`SELECT 1 FROM session_guest_book_photos g
        WHERE g.account_id = ? AND g.event_id = ? AND g.user_id = ? AND g.status = 'pending' AND g.revoked_at IS NULL
        LIMIT 1`).bind(...event, userId).first(),
    ]);
    if (!await resolveSeat()) return missing();
    return json({
      photos: photos.results.map(photo => ({ ...photo, own: photo.own === 1 })),
      can_add: Boolean(offerSeat && offerSeat.event_id === seat.event_id),
      waiting: Boolean(waiting),
    });
  }
  if (action === 'bytes') {
    if (!isId(grantId)) return missing();
    return serveBytes(request, bucket, async () => await resolveSeat()
      ? db.prepare(`SELECT p.object_key ${roster}
          AND g.account_id = ? AND g.event_id = ? AND g.id = ? AND g.status = 'included'`)
        .bind(...event, grantId).first<{ object_key: string }>()
      : null);
  }
  return json({ error: 'Choose a gallery action.' }, 400);
}
