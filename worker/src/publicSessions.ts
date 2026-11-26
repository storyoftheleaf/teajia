// What a visitor sees of a finished sit: on a person's profile and on the
// sit's own recap page.
//
// Everything here is public, so the rules live in one place:
// - a sit shows only once its recap is published (`publishedSitRecap`);
// - people are the sit's public credits whose profiles are published;
// - "poured with" names every public co-host and guest host, published or
//   not: a published person by their page name with a link to their page, an
//   unpublished one by first name only and with no link;
// - poured teas resolve through `resolveSessionTeas`, which carries a price
//   only for a tea its owner marked for sale;
// - a guest's note or photograph appears only when the host marked it
//   `included` AND the guest agreed to the public recap (a note's own
//   `public_recap` yes; a photograph's public-recap permission, the same one
//   the lead recap photograph uses). Everything else stays with the guests.
import { publicSitProfile, publishedSitRecap } from './publicSitConnections';
import { privateAttendeeSeatMatch } from './privateSessionReflections';
import { readSitPhotoRendition, sitPhotoRenditionResponse } from './revocableSitPhotos';
import { resolveSessionTeas, type PublicProductReader, type PublicSessionTea, type SessionTeaRef } from './sessionTeas';
import { GUEST_BOOK_NOTE_LIMIT, prepareGuestBookNote } from './sessionGuestBook';
import { readSessionServedTeas } from './sessionServedTeas';
import { acknowledgementOpen } from './photographCredit';

type Env = { DB: D1Database; ATLAS_BUCKET?: R2Bucket; TEA_TABLE_OPEN?: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Auth<E> = (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;

import type { SessionGuestItem, SessionPerson, SessionPhotograph, SessionSignature } from '../../shared/sessionTea';

type EventRow = { id: string; account_id: string; slug: string; title: string; event_date: string;
  notes: string | null; gallery: string | null };

const noStore = { 'Cache-Control': 'no-store' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: noStore });
const privateJson = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });

const roleOrder = `CASE ec.role WHEN 'lead_host' THEN 0 WHEN 'co_host' THEN 1
  WHEN 'guest_host' THEN 2 WHEN 'photographer' THEN 3 ELSE 4 END`;

const publishedEvent = `SELECT e.id, e.account_id, e.slug, e.title, e.event_date,
    (SELECT ps.session_notes FROM event_post_session ps WHERE ps.event_id = e.id AND ps.account_id = e.account_id LIMIT 1) AS notes,
    (SELECT ps.gallery_images FROM event_post_session ps WHERE ps.event_id = e.id AND ps.account_id = e.account_id LIMIT 1) AS gallery
  FROM events e JOIN accounts a ON a.id = e.account_id WHERE ${publishedSitRecap}`;

function gallery(value: string | null): string[] {
  try {
    const list = JSON.parse(value ?? '[]');
    return Array.isArray(list) ? list.filter((src): src is string => typeof src === 'string' && /^https?:\/\//.test(src)) : [];
  } catch {
    return [];
  }
}

/** A guest signs with their first name only; the full name stays with the host. */
export function guestFirstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'A guest';
}

function placeholders(values: unknown[]) {
  return values.map(() => '?').join(',');
}

async function peopleOf(db: D1Database, events: EventRow[]) {
  const map = new Map<string, SessionPerson[]>();
  if (!events.length) return map;
  const { results } = await db.prepare(
    `SELECT ec.event_id, c.id AS slug, c.display_name AS name, ec.role
     FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
     WHERE ec.is_public = 1 AND ${publicSitProfile} AND ec.event_id IN (${placeholders(events)})
       AND ec.role IN ('lead_host', 'co_host', 'guest_host')
     ORDER BY ${roleOrder}, c.display_name, c.id`,
  ).bind(...events.map(event => event.id)).all<SessionPerson & { event_id: string }>();
  for (const { event_id, ...person } of results) {
    const list = map.get(event_id) ?? [];
    if (!list.some(known => known.slug === person.slug)) list.push(person);
    map.set(event_id, list);
  }
  return map;
}

export type PouredWith = { name: string; slug: string | null };

/**
 * "Poured with": the sit's public co-hosts and guest hosts, beside the lead
 * host. The credit is the host's to give (`is_public`), so it does not wait
 * for the person's own page to be published. Only a published page is linked,
 * and an unpublished person is named by first name only. Never the lead host.
 */
export async function pouredWithOf(db: D1Database, event: { id: string; account_id: string }): Promise<PouredWith[]> {
  const { results } = await db.prepare(
    `SELECT c.id, c.display_name, (${publicSitProfile}) AS published
     FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
     WHERE ec.event_id = ? AND ec.account_id = ? AND ec.is_public = 1
       AND ec.role IN ('co_host', 'guest_host')
       AND NOT EXISTS (SELECT 1 FROM event_contributors lh
         WHERE lh.event_id = ec.event_id AND lh.account_id = ec.account_id
           AND lh.contributor_id = ec.contributor_id AND lh.role = 'lead_host' AND lh.is_public = 1)
     ORDER BY ${roleOrder}, ec.display_order, c.display_name, c.id`,
  ).bind(event.id, event.account_id).all<{ id: string; display_name: string | null; published: number }>();
  const seen = new Set<string>();
  const list: PouredWith[] = [];
  for (const row of results) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const published = Number(row.published) === 1;
    const name = published ? (row.display_name ?? '').trim() : (row.display_name ?? '').trim().split(/\s+/)[0];
    if (!name) continue;
    list.push({ name, slug: published ? row.id : null });
  }
  return list;
}

type ServedRow = { id?: unknown; name?: unknown; source?: unknown; source_id?: unknown; product_id?: unknown };

/** The sit's served teas in order: the host's served list, else the session menu. */
async function teasOf(db: D1Database, readPublic: PublicProductReader, event: EventRow) {
  const [ledger, owners] = await db.batch([
    db.prepare(`SELECT tea_ledger FROM event_post_session WHERE event_id = ? AND account_id = ? LIMIT 1`)
      .bind(event.id, event.account_id),
    db.prepare(
      `SELECT DISTINCT c.user_id FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
       WHERE ec.event_id = ? AND ec.account_id = ? AND ec.is_public = 1 AND c.user_id IS NOT NULL`,
    ).bind(event.id, event.account_id),
  ]);
  let served: ServedRow[] | null = null;
  try {
    const parsed = JSON.parse(String((ledger.results[0] as { tea_ledger?: unknown } | undefined)?.tea_ledger ?? 'null'));
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.served_teas)) served = parsed.served_teas;
  } catch { served = null; }
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const refs: SessionTeaRef[] = served
    ? served.flatMap(row => {
      const id = str(row?.id); const name = str(row?.name);
      if (!id || !name || id.length > 120 || name.length > 240) return [];
      return [{ menuId: id, name, productId: str(row.product_id),
        chestId: row.source === 'chest' ? str(row.source_id) : null }];
    })
    : (await readSessionServedTeas(db, event.account_id, event.id)).results
      .map(row => ({ menuId: row.id, productId: row.product_id, name: row.name }));
  return resolveSessionTeas(db, readPublic, event.account_id,
    (owners.results as { user_id: string }[]).map(row => row.user_id), refs);
}

/** The served teas of one sit, resolved to their pages and offers. Ids match `sessionServedTeas`. */
export function servedTeasOf(db: D1Database, readPublic: PublicProductReader, event: { id: string; account_id: string }) {
  return teasOf(db, readPublic, event as EventRow);
}

/** Guest photographs the host included and the guest agreed to show on the public recap. */
async function publicGuestPhotos(db: D1Database, event: EventRow) {
  const { results } = await db.prepare(
    `SELECT perm.id, g.alt_text, perm.credit, p.tea_id AS tea_menu_id
     FROM session_guest_book_photos g
     JOIN private_kept_setup_photos p
       ON p.account_id = g.account_id AND p.user_id = g.user_id AND p.event_id = g.event_id AND p.id = g.photo_id
     JOIN event_attendees a ON a.id = g.attendee_id AND a.account_id = g.account_id AND a.event_id = g.event_id
       AND a.user_id = g.user_id AND a.status = 'confirmed' AND a.attended = 1
     JOIN sit_photo_public_permissions perm ON perm.account_id = p.account_id AND perm.user_id = p.user_id
       AND perm.event_id = p.event_id AND perm.photo_id = p.id AND perm.audience = 'public_recap' AND perm.revoked_at IS NULL
     WHERE g.account_id = ? AND g.event_id = ? AND g.status = 'included' AND g.revoked_at IS NULL
     ORDER BY g.offered_at ASC, g.id`,
  ).bind(event.account_id, event.id).all<{ id: string; alt_text: string; credit: string; tea_menu_id: string | null }>();
  return results.map(row => ({
    teaMenuId: row.tea_menu_id,
    photo: { src: `/api/public/sit-recaps/${encodeURIComponent(event.slug)}/photos/${encodeURIComponent(row.id)}`,
      alt: row.alt_text, by: { name: row.credit.trim(), part: 'guest' as const } },
  }));
}

/** Guest notes the host included and the guest agreed to show on the public recap. */
async function publicGuestNotes(db: D1Database, event: EventRow) {
  const { results } = await db.prepare(
    `SELECT b.note, a.full_name, b.tea_id AS tea_menu_id
     FROM session_guest_book b
     JOIN event_attendees a ON a.id = b.attendee_id AND a.account_id = b.account_id AND a.event_id = b.event_id
     WHERE b.account_id = ? AND b.event_id = ? AND b.status = 'included' AND b.public_recap = 1
       AND a.status = 'confirmed' AND a.attended = 1
     ORDER BY b.updated_at ASC, b.id`,
  ).bind(event.account_id, event.id).all<{ note: string; full_name: string | null; tea_menu_id: string | null }>();
  return results.map(row => ({
    teaMenuId: row.tea_menu_id,
    note: { text: row.note, by: { name: guestFirstName(row.full_name), part: 'guest' as const } },
  }));
}

function hostSignature(people: SessionPerson[]): SessionSignature | null {
  const host = people.find(person => person.role === 'lead_host') ?? people[0];
  return host ? { name: host.name, part: 'host', slug: host.slug } : null;
}

export type PublicRecapTea = PublicSessionTea & { items: SessionGuestItem[] };

/**
 * Places each guest item under the poured tea it names. An item that names no
 * tea, or a tea that is not on this sit's menu, lands under "The table"
 * (photographs) or "Guest book" (notes).
 */
export function placeGuestItems(
  teas: PublicSessionTea[],
  photos: { teaMenuId: string | null; photo: SessionPhotograph & { by: SessionSignature } }[],
  notes: { teaMenuId: string | null; note: { text: string; by: SessionSignature } }[],
) {
  const byTea = new Map<string, SessionGuestItem[]>();
  const known = new Set(teas.map(tea => tea.id).filter((id): id is string => Boolean(id)));
  const table: SessionPhotograph[] = [];
  const guestBook: { text: string; by: SessionSignature }[] = [];
  const under = (id: string | null) => (id && known.has(id) ? id : null);
  for (const { teaMenuId, photo } of photos) {
    const id = under(teaMenuId);
    if (id) byTea.set(id, [...(byTea.get(id) ?? []), { kind: 'photo', ...photo }]);
    else table.push(photo);
  }
  for (const { teaMenuId, note } of notes) {
    const id = under(teaMenuId);
    if (id) byTea.set(id, [...(byTea.get(id) ?? []), { kind: 'note', ...note }]);
    else guestBook.push(note);
  }
  return {
    teas: teas.map(tea => ({ ...tea, items: tea.id ? byTea.get(tea.id) ?? [] : [] })) as PublicRecapTea[],
    table, guestBook,
  };
}

async function readEventBySlug(db: D1Database, slug: string) {
  return db.prepare(`${publishedEvent} AND e.slug = ?`).bind(slug).first<EventRow>();
}

/** One session as a profile card: people, note, lead and small photographs, poured teas. */
async function card(db: D1Database, readPublic: PublicProductReader, event: EventRow, people: SessionPerson[]) {
  const [teas, guests] = await Promise.all([teasOf(db, readPublic, event), publicGuestPhotos(db, event)]);
  const host = hostSignature(people);
  const images = gallery(event.gallery);
  const small: SessionPhotograph[] = [
    ...images.slice(1).map(src => ({ src, alt: `Photo from ${event.title}`, by: host })),
    ...guests.map(guest => guest.photo),
  ];
  const writing = event.notes?.trim() ?? '';
  return {
    slug: event.slug, title: event.title, event_date: event.event_date,
    people,
    writing: writing.slice(0, 280),
    note: writing ? { text: writing.slice(0, 280), by: host } : null,
    galleryPhoto: images[0] ?? null,
    photos: { small: small.slice(0, 3), more: Math.max(0, small.length - 3) },
    teas,
  };
}

/** The profile's past sits: each placed sit with the person's own part on it. */
export async function formalSessionCardsFor(db: D1Database, readPublic: PublicProductReader, contributor: string) {
  const { results: events } = await db.prepare(
    `${publishedEvent.replace('FROM events e', `, ec.role AS role FROM events e
      JOIN event_contributors ec ON ec.event_id = e.id AND ec.account_id = e.account_id AND ec.is_public = 1
      JOIN contributors c ON c.id = ec.contributor_id
      JOIN sit_profile_placements pl ON pl.account_id = e.account_id AND pl.event_id = e.id
        AND pl.contributor_id = c.id AND pl.role = ec.role`)}
      AND ${publicSitProfile} AND c.id = ?
     ORDER BY e.event_date DESC, e.id DESC LIMIT 12`,
  ).bind(contributor).all<EventRow & { role: string }>();
  const people = await peopleOf(db, events);
  return Promise.all(events.map(async event => ({
    ...await card(db, readPublic, event, people.get(event.id) ?? []), role: event.role,
  })));
}

/** The sit's recap: the host's words, then each poured tea with what guests attached to it. */
export async function formalSessionRecap(db: D1Database, readPublic: PublicProductReader, slug: string, acknowledged = true) {
  const event = await readEventBySlug(db, slug);
  if (!event) return null;
  const people = (await peopleOf(db, [event])).get(event.id) ?? [];
  const [teas, photos, notes, pouredWith] = await Promise.all([
    teasOf(db, readPublic, event), publicGuestPhotos(db, event), publicGuestNotes(db, event),
    acknowledged ? pouredWithOf(db, event) : Promise.resolve(null),
  ]);
  const host = hostSignature(people);
  const placed = placeGuestItems(teas, photos, notes);
  const images = gallery(event.gallery);
  const writing = event.notes?.trim() ?? '';
  return {
    slug: event.slug, title: event.title, event_date: event.event_date, people,
    // "Poured with" opens with the Tea Table (A4 review, finding 11).
    ...(pouredWith ? { poured_with: pouredWith } : {}),
    note: writing ? { text: writing, by: host } : null,
    galleryPhoto: images[0] ?? null,
    teas: placed.teas,
    table: [...images.slice(1).map(src => ({ src, alt: `Photo from ${event.title}`, by: host })), ...placed.table],
    guestBook: placed.guestBook,
  };
}

function seat(db: D1Database, event: EventRow, userId: string) {
  return db.prepare(
    `SELECT a.id, a.event_id, a.account_id FROM event_attendees a
     WHERE a.event_id = ? AND ${privateAttendeeSeatMatch} LIMIT 1`,
  ).bind(event.id, event.account_id, userId, userId).first<{ id: string; event_id: string; account_id: string }>();
}

export function publicSessionRoutes<E extends Env>(deps: {
  requireUser: Auth<E>;
  readPublic: (env: E) => PublicProductReader;
}): [string, string, Handler<E>][] {
  const recap: Handler<E> = async (_request, env, { slug }) => {
    const found = await formalSessionRecap(env.DB, deps.readPublic(env), slug, acknowledgementOpen(env));
    return found ? json({ recap: found }) : json({ error: 'This recap is unavailable.' }, 404);
  };

  const photo: Handler<E> = async (request, env, { slug, photoId }) => {
    const read = async () => {
      const event = await readEventBySlug(env.DB, slug);
      if (!event) return null;
      return env.DB.prepare(
        `SELECT p.object_key FROM sit_photo_public_permissions perm
         JOIN private_kept_setup_photos p ON p.account_id = perm.account_id AND p.user_id = perm.user_id
           AND p.event_id = perm.event_id AND p.id = perm.photo_id
         JOIN session_guest_book_photos g ON g.account_id = p.account_id AND g.user_id = p.user_id
           AND g.event_id = p.event_id AND g.photo_id = p.id AND g.revoked_at IS NULL AND g.status = 'included'
         JOIN event_attendees a ON a.id = g.attendee_id AND a.account_id = g.account_id AND a.event_id = g.event_id
           AND a.user_id = g.user_id AND a.status = 'confirmed' AND a.attended = 1
         WHERE perm.id = ? AND perm.account_id = ? AND perm.event_id = ?
           AND perm.audience = 'public_recap' AND perm.revoked_at IS NULL`,
      ).bind(photoId, event.account_id, event.id).first<{ object_key: string }>();
    };
    const source = await read();
    if (!source) return json({ error: 'Photo not found.' }, 404);
    if (!env.ATLAS_BUCKET) return json({ error: 'Photo storage is unavailable.' }, 503);
    const bytes = await readSitPhotoRendition(env.ATLAS_BUCKET, source.object_key);
    // Recheck after the storage read so a withdrawal during I/O takes effect.
    return bytes && (await read())?.object_key === source.object_key
      ? sitPhotoRenditionResponse(request, bytes) : json({ error: 'Photo not found.' }, 404);
  };

  // "Add yours": only someone who sat at this table, by the existing seat check.
  const mine: Handler<E> = async (request, env, { slug }) => {
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return actor.error;
    const event = await readEventBySlug(env.DB, slug);
    if (!event) return privateJson({ error: 'This recap is unavailable.' }, 404);
    const found = await seat(env.DB, event, actor.userId);
    if (!found) return privateJson({ seated: false });
    if (request.method === 'GET') {
      const own = await env.DB.prepare(
        `SELECT note, status, tea_id, public_recap FROM session_guest_book
         WHERE account_id = ? AND event_id = ? AND user_id = ?`,
      ).bind(event.account_id, event.id, actor.userId).first();
      const teas = (await teasOf(env.DB, () => Promise.resolve(null), event))
        .filter(tea => tea.id).map(tea => ({ id: tea.id, name: tea.name }));
      return privateJson({ seated: true, teas, own: own ?? null });
    }
    const body = await request.json().catch(() => null) as { note?: unknown; teaId?: unknown; publicRecap?: unknown } | null;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const teaId = typeof body?.teaId === 'string' && body.teaId ? body.teaId : null;
    if (!note || note.length > GUEST_BOOK_NOTE_LIMIT || typeof body?.publicRecap !== 'boolean') {
      return privateJson({ error: 'Write a note of up to 280 characters.' }, 400);
    }
    const seatCheck = `a.event_id = ? AND ${privateAttendeeSeatMatch}`;
    const binds = [event.id, event.account_id, actor.userId, actor.userId];
    const now = new Date().toISOString();
    const [, written] = await env.DB.batch([
      env.DB.prepare(`UPDATE event_attendees AS a SET user_id = ? WHERE a.user_id IS NULL AND ${seatCheck}`)
        .bind(actor.userId, ...binds),
      prepareGuestBookNote(env.DB, actor.userId, note, now, seatCheck, binds, { teaId, publicRecap: body.publicRecap }),
    ]);
    if (written.meta?.changes) return privateJson({ success: true });
    // An unchanged resend is already saved.
    const same = await env.DB.prepare(
      `SELECT 1 FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ? AND note = ?
       AND public_recap = ? AND tea_id IS ?`,
    ).bind(event.account_id, event.id, actor.userId, note, body.publicRecap ? 1 : 0, teaId).first();
    return same ? privateJson({ success: true }) : privateJson({ error: 'Confirm your attendance before sharing.' }, 403);
  };

  return [
    ['GET', '/api/public/sit-recaps/:slug', recap],
    ['GET', '/api/public/sit-recaps/:slug/photos/:photoId', photo],
    ['GET', '/api/me/sit-recaps/:slug/guest-book', mine],
    ['PUT', '/api/me/sit-recaps/:slug/guest-book', mine],
  ];
}
