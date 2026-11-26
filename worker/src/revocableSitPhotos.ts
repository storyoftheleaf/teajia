import { FAMILY_FULL_MAX_BYTES } from '../../src/lib/familyContract';
import { publicSitPhotoJpeg } from './revocableSitPhotoJpeg';
import { sessionServedTeaName } from './sessionServedTeas';
import { RECAP_NOT_HIDDEN } from './publicSitConnections';

type Scope = { accountId: string; userId: string };
type PhotoTea = { tea_id?: string | null; tea_name?: string | null; can_show_in_brewing?: number };
type Permission = PhotoTea & { id: string; credit: string; placed: number };
type OfferedSource = { id: string; credit: string; object_key: string };
type RecapPlacement = OfferedSource & PhotoTea & { alt_text: string; observation: string | null };

const noStore = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (data: object, status = 200) => Response.json(data, { status, headers: noStore });
const missing = () => json({ error: 'Photo not found.' }, 404);
const keyPattern = /^private-kept-setups\/[a-f0-9-]{36}\.jpg$/i;
const versionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

const ownedPhoto = 'p.account_id = ? AND p.user_id = ? AND p.event_id = ? AND p.id = ?';
const exactPhoto = `p.account_id = g.account_id AND p.user_id = g.user_id
    AND p.event_id = g.event_id AND p.id = g.photo_id`;
const completedPublicEvent = `e.lifecycle_status IN ('completed', 'archived')
    AND e.public_visibility = 'public' AND host.status = 'active' AND host.public_enabled = 1`;
const publicRecap = `${completedPublicEvent} AND e.recap_status = 'published'
    AND EXISTS (SELECT 1 FROM event_post_session recap
                WHERE recap.event_id = e.id AND recap.account_id = e.account_id)`;
const currentAttendee = `seat.account_id = p.account_id AND seat.event_id = p.event_id AND seat.user_id = p.user_id
    AND seat.status = 'confirmed' AND seat.attended = 1`;
const servedTea = sessionServedTeaName();
const eligiblePhotoSubject = `(p.tea_id IS NULL OR ${servedTea} IS NOT NULL)`;
const photoTeaSelection = `p.tea_id, ${servedTea} AS tea_name, g.can_show_in_brewing`;
const photoTeaView = (photo: PhotoTea) => photo.tea_id && photo.tea_name
  ? { tea: { id: photo.tea_id, name: photo.tea_name } } : {};
const additionalUseView = (photo: PhotoTea) => photo.can_show_in_brewing === 1
  ? { canShowInBrewing: true as const } : {};
const placedVersion = 'r.account_id = g.account_id AND r.event_id = g.event_id AND r.permission_id = g.id';

/**
 * Source of truth for revocable placements. A destination must also check the
 * audience on g, its own placement, and the current public destination rules.
 */
export const activeSitPhotoPermissionSelect = `
  FROM sit_photo_public_permissions g
  JOIN private_kept_setup_photos p ON ${exactPhoto}
  JOIN event_attendees seat ON seat.id = g.attendee_id AND ${currentAttendee}
  JOIN events e ON e.id = p.event_id AND e.account_id = p.account_id
  JOIN accounts host ON host.id = e.account_id
  WHERE g.revoked_at IS NULL AND ${eligiblePhotoSubject} AND ${completedPublicEvent}
`;

const recapAudienceSelect = `${activeSitPhotoPermissionSelect} AND g.audience = 'public_recap'`;
const publicRecapPlacement = `
  SELECT g.id, g.credit, p.object_key, r.alt_text, r.observation, ${photoTeaSelection}
  FROM sit_photo_recap_placements r
  JOIN (
    SELECT g.id ${recapAudienceSelect} AND ${publicRecap} AND ${RECAP_NOT_HIDDEN} AND e.slug = ?
  ) eligible ON eligible.id = r.permission_id
  JOIN sit_photo_public_permissions g ON ${placedVersion}
  JOIN private_kept_setup_photos p ON ${exactPhoto}
`;

const permissionView = (permission: Permission | null) => permission && {
  id: permission.id, credit: permission.credit, status: permission.placed === 1 ? 'placed' : 'offered',
  ...photoTeaView(permission), ...additionalUseView(permission),
};

async function readPermission(db: D1Database, photo: string[]) {
  return db.prepare(
    `SELECT g.id, g.credit, ${photoTeaSelection}, EXISTS (SELECT 1 FROM sit_photo_recap_placements r WHERE ${placedVersion}) AS placed
     FROM private_kept_setup_photos p JOIN sit_photo_public_permissions g ON ${exactPhoto}
     WHERE ${ownedPhoto} AND g.audience = 'public_recap' AND g.revoked_at IS NULL`
  ).bind(...photo).first<Permission>();
}

export async function serveOwnerSitPhotoPermission(
  request: Request, db: D1Database, scope: Scope, eventId: string, photoId: string,
) {
  const photo = [scope.accountId, scope.userId, eventId, photoId];
  if (request.method === 'GET') {
    const source = await db.prepare(
      `SELECT EXISTS (
         SELECT 1 FROM event_attendees seat
         JOIN events e ON e.id = seat.event_id AND e.account_id = seat.account_id
         JOIN accounts host ON host.id = e.account_id
         WHERE ${currentAttendee} AND ${completedPublicEvent}
       ) AND ${eligiblePhotoSubject} AS eligible
       FROM private_kept_setup_photos p WHERE ${ownedPhoto}`
    ).bind(...photo).first<{ eligible: number }>();
    if (!source) return missing();
    const grant = await readPermission(db, photo);
    return json({ eligible: source.eligible === 1, permission: permissionView(grant) });
  }

  const body = await request.json().catch(() => null) as { id?: unknown; credit?: unknown; canShowInBrewing?: unknown } | null;
  if (typeof body?.id !== 'string' || !versionPattern.test(body.id)) {
    return json({ error: 'Choose the current permission.' }, 400);
  }

  if (request.method === 'DELETE') {
    const withdrawn = await db.prepare(
      `UPDATE sit_photo_public_permissions SET revoked_at = COALESCE(revoked_at, ?)
       WHERE account_id = ? AND user_id = ? AND event_id = ? AND photo_id = ?
         AND audience = 'public_recap' AND id = ?`
    ).bind(new Date().toISOString(), ...photo, body.id).run();
    return withdrawn.meta?.changes ? json({ success: true }) : missing();
  }

  const credit = typeof body.credit === 'string' ? body.credit.trim() : '';
  if (!credit || credit.length > 120) return json({ error: 'Enter a credit of up to 120 characters.' }, 400);
  if (body.canShowInBrewing !== undefined && typeof body.canShowInBrewing !== 'boolean') {
    return json({ error: 'Choose where to offer the photo.' }, 400);
  }
  const canShowInBrewing = body.canShowInBrewing === true ? 1 : 0;
  const inserted = await db.prepare(
    `INSERT INTO sit_photo_public_permissions
       (id, account_id, user_id, event_id, photo_id, attendee_id, audience, credit, offered_at, can_show_in_brewing)
     SELECT ?, p.account_id, p.user_id, p.event_id, p.id, seat.id, 'public_recap', ?, ?, ?
     FROM private_kept_setup_photos p
     JOIN events e ON e.id = p.event_id AND e.account_id = p.account_id
     JOIN accounts host ON host.id = e.account_id
     JOIN event_attendees seat ON ${currentAttendee}
     WHERE ${ownedPhoto} AND ${eligiblePhotoSubject} AND ${completedPublicEvent}
     ORDER BY seat.id LIMIT 1
     ON CONFLICT DO NOTHING`
  ).bind(body.id, credit, new Date().toISOString(), canShowInBrewing, ...photo).run();
  const grant = await readPermission(db, photo);
  if (grant?.id === body.id && grant.credit === credit && grant.can_show_in_brewing === canShowInBrewing) {
    return json({ permission: permissionView(grant) }, inserted.meta?.changes ? 201 : 200);
  }
  return json({ error: 'This photo or permission has changed. Check the current permission.' }, 409);
}

const readReviewSource = (db: D1Database, accountId: string, eventId: string, grantId: string) =>
  db.prepare(
    `SELECT g.id, g.credit, p.object_key ${recapAudienceSelect}
     AND g.account_id = ? AND g.event_id = ? AND g.id = ?`
  ).bind(accountId, eventId, grantId).first<OfferedSource>();

export async function readSitPhotoRendition(bucket: R2Bucket, key: string) {
  if (!keyPattern.test(key)) return null;
  const original = await bucket.get(key);
  if (!original || original.size > FAMILY_FULL_MAX_BYTES) return null;
  return publicSitPhotoJpeg(new Uint8Array(await original.arrayBuffer()));
}

export function sitPhotoRenditionResponse(request: Request, bytes: Uint8Array<ArrayBuffer>) {
  return new Response(request.method === 'HEAD' ? null : bytes, {
    headers: { ...noStore, 'Content-Type': 'image/jpeg', 'Content-Length': String(bytes.length) },
  });
}

export async function serveRecapPhotoReview(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, scope: Scope, eventId: string, grantId?: string,
) {
  const event = await db.prepare(
    `SELECT (${publicRecap}) AS published FROM events e
     JOIN accounts host ON host.id = e.account_id
     WHERE e.account_id = ? AND e.id = ? AND ${completedPublicEvent}`
  ).bind(scope.accountId, eventId).first<{ published: number }>();
  if (!event) return json({ error: 'Public session not found.' }, 404);

  if (!grantId) {
    const { results } = await db.prepare(
      `SELECT g.id, g.credit, ${photoTeaSelection}, EXISTS (SELECT 1 FROM sit_photo_recap_placements r WHERE ${placedVersion}) AS placed
       ${recapAudienceSelect} AND g.account_id = ? AND g.event_id = ?
       ORDER BY placed DESC, g.offered_at DESC, g.id`
    ).bind(scope.accountId, eventId).all<Permission>();
    return json({ published: event.published === 1, permissions: results.map(permissionView) });
  }

  const readSource = () => readReviewSource(db, scope.accountId, eventId, grantId);
  const source = await readSource();
  if (!source) return missing();
  if (!bucket) return json({ error: 'Photo storage is unavailable.' }, 503);

  if (request.method === 'GET') {
    const bytes = await readSitPhotoRendition(bucket, source.object_key);
    return bytes && await readSource() ? sitPhotoRenditionResponse(request, bytes) : missing();
  }

  const body = await request.json().catch(() => null) as { alt_text?: unknown; observation?: unknown } | null;
  const alt = typeof body?.alt_text === 'string' ? body.alt_text.trim() : '';
  const observation = typeof body?.observation === 'string' ? body.observation.trim() : '';
  if (!alt || alt.length > 250 || observation.length > 280) {
    return json({ error: 'Enter a photo description of up to 250 characters and an optional observation of up to 280.' }, 400);
  }
  if (!event.published) return json({ error: 'Publish the recap before placing a photo.' }, 409);
  if (!await readSitPhotoRendition(bucket, source.object_key)) return json({ error: 'The photo could not be read.' }, 422);

  const write = await db.prepare(
    `INSERT INTO sit_photo_recap_placements
       (account_id, event_id, permission_id, alt_text, observation, approved_by, approved_at)
     SELECT g.account_id, g.event_id, g.id, ?, ?, ?, ?
     ${recapAudienceSelect} AND ${publicRecap} AND g.account_id = ? AND g.event_id = ? AND g.id = ?
     ON CONFLICT (account_id, event_id) DO UPDATE SET
       permission_id = excluded.permission_id, alt_text = excluded.alt_text, observation = excluded.observation,
       approved_by = excluded.approved_by, approved_at = excluded.approved_at
     WHERE sit_photo_recap_placements.permission_id NOT IN (
       SELECT g.id ${recapAudienceSelect} AND g.account_id = ? AND g.event_id = ?
     )`
  ).bind(alt, observation || null, scope.userId, new Date().toISOString(),
    scope.accountId, eventId, grantId, scope.accountId, eventId).run();
  if (write.meta?.changes) return json({ success: true });

  const alreadyPlaced = await db.prepare(
    `SELECT 1 ${recapAudienceSelect} AND ${publicRecap}
     AND g.account_id = ? AND g.event_id = ? AND g.id = ?
     AND EXISTS (SELECT 1 FROM sit_photo_recap_placements r
                 WHERE ${placedVersion} AND r.alt_text = ? AND r.observation IS ?)`
  ).bind(scope.accountId, eventId, grantId, alt, observation || null).first();
  return alreadyPlaced ? json({ success: true })
    : json({ error: 'The permission or recap placement changed. Check the current selection.' }, 409);
}

export async function servePublicRecapPhoto(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, slug: string, grantId?: string,
) {
  const placement = new URL(request.url).searchParams.get('placement');
  const needsExplicitConsent = placement === 'brewing' || placement === 'essay';
  const source = () => db.prepare(`${publicRecapPlacement}
    WHERE (? IS NULL OR g.id = ?) AND (? = 0 OR g.can_show_in_brewing = 1)`
  ).bind(slug, grantId ?? null, grantId ?? null, needsExplicitConsent ? 1 : 0).first<RecapPlacement>();
  const placed = await source();
  if (!grantId) {
    return json({ photo: placed ? {
      id: placed.id, credit: placed.credit, alt_text: placed.alt_text, observation: placed.observation, ...photoTeaView(placed), ...additionalUseView(placed),
    } : null });
  }
  if (!placed) return missing();
  if (!bucket) return json({ error: 'Photo storage is unavailable.' }, 503);
  const bytes = await readSitPhotoRendition(bucket, placed.object_key);
  // Recheck after the storage read so a withdrawal during I/O takes effect.
  return bytes && await source() ? sitPhotoRenditionResponse(request, bytes) : missing();
}
