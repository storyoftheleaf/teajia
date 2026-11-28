import { createAfterSitCredential, hashAfterSitCredential } from './afterSitCredential';
import { GUEST_BOOK_NOTE_LIMIT, guestBookEntryKeys, guestBookPlacement, guestSignature, prepareGuestBookNote, type GuestBookPlacement } from './sessionGuestBook';
import { namedSetupTeas } from './privateKeptSetups';
import { approvedSeatSourceSql } from './seatRequest';

const LINK_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
const MAX_LINKS_PER_BOOKING = 12;
const FIRST_NAME_LIMIT = 40;
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const unavailable = () => reply({ error: 'This after-sit link is unavailable.' }, 404);

const guestSeat = `
  a.status = 'confirmed' AND a.attended = 1
  AND ${approvedSeatSourceSql('e', 'a')}
  AND e.lifecycle_status IN ('completed', 'archived') AND shop.status = 'active'`;
const eventJoins = `
  JOIN events e ON e.id = a.event_id AND e.account_id = a.account_id
  JOIN accounts shop ON shop.id = a.account_id`;

/** The host's own wording for a first name: trimmed, one line, never empty. */
export function cleanFirstName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name && name.length <= FIRST_NAME_LIMIT ? name : null;
}

/** Host only: a personal link for one named person under one booking. */
export async function issuePartyLink(db: D1Database, accountId: string, eventId: string, attendeeId: string, input: unknown) {
  const firstName = cleanFirstName((input as { first_name?: unknown } | null)?.first_name);
  if (!firstName) return reply({ error: `Give a first name of up to ${FIRST_NAME_LIMIT} characters.` }, 400);
  const credential = createAfterSitCredential();
  const hash = await hashAfterSitCredential(credential);
  const expiresAt = Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS;
  const result = await db.prepare(
    `INSERT INTO after_sit_party_links (id, credential_hash, attendee_id, event_id, account_id, first_name, expires_at, created_at)
     SELECT ?, ?, a.id, a.event_id, a.account_id, ?, ?, ? FROM event_attendees a ${eventJoins}
     WHERE a.id = ? AND a.event_id = ? AND a.account_id = ? AND ${guestSeat}
       AND (SELECT count(*) FROM after_sit_party_links p WHERE p.attendee_id = a.id AND p.event_id = a.event_id
         AND p.account_id = a.account_id) < ${MAX_LINKS_PER_BOOKING}`,
  ).bind(crypto.randomUUID(), hash, firstName, expiresAt, new Date().toISOString(), attendeeId, eventId, accountId).run();
  if (!result.meta?.changes) return unavailable();
  return reply({ credential, first_name: firstName, expires_at: new Date(expiresAt * 1000).toISOString() });
}

export type PartyLink = { first_name: string; attendee_id: string; event_id: string; account_id: string };

export function findPartyLink(db: D1Database, credentialHash: string) {
  return db.prepare(
    `SELECT l.first_name, a.id AS attendee_id, a.event_id, a.account_id
     FROM after_sit_party_links l
     JOIN event_attendees a ON a.id = l.attendee_id AND a.event_id = l.event_id AND a.account_id = l.account_id
     ${eventJoins}
     WHERE l.credential_hash = ? AND l.expires_at > unixepoch() AND ${guestSeat}`,
  ).bind(credentialHash).first<PartyLink>();
}

/** The same recap a booking's own link opens. */
export function findPartyRecap(db: D1Database, credentialHash: string) {
  return db.prepare(
    `SELECT e.id, e.title, e.event_date, a.account_id, s.session_notes AS host_note,
        (SELECT json_group_array(json_object('id', tea.id, 'name', tea.name))
          FROM (${namedSetupTeas}) AS tea) AS teas_json
     FROM after_sit_party_links l
     JOIN event_attendees a ON a.id = l.attendee_id AND a.event_id = l.event_id AND a.account_id = l.account_id
     ${eventJoins}
     LEFT JOIN event_attendee_recaps s ON s.event_id = a.event_id AND s.account_id = a.account_id
     WHERE l.credential_hash = ? AND l.expires_at > unixepoch() AND ${guestSeat}`,
  ).bind(credentialHash).first<{
    id: string; title: string; event_date: string; account_id: string; host_note: string | null; teas_json: string;
  }>();
}

type Body = { action?: unknown; note?: unknown } & GuestBookPlacement;

/**
 * Guest book for a personal link. The note belongs to the signed-in person who
 * opened the link, is signed with the first name the host gave, waits for the
 * host's review like any other note, and can only land on this link's event.
 */
export async function servePartyGuestBook(db: D1Database, link: PartyLink, credentialHash: string, userId: string, body: Body) {
  const where = [link.account_id, link.event_id];
  const seatCheck = `a.id = ? AND a.event_id = ? AND a.account_id = ? AND a.status = 'confirmed' AND a.attended = 1
    AND EXISTS (SELECT 1 FROM after_sit_party_links l WHERE l.credential_hash = ? AND l.expires_at > unixepoch()
      AND l.attendee_id = a.id AND l.event_id = a.event_id AND l.account_id = a.account_id)`;
  const binds = [link.attendee_id, link.event_id, link.account_id, credentialHash];

  if (body.action === 'read') {
    const [included, own] = await Promise.all([
      db.prepare(
        `SELECT b.id, ${guestSignature} AS display_name, b.note, b.user_id
         FROM session_guest_book b
         JOIN event_attendees a ON a.id = b.attendee_id AND a.account_id = b.account_id AND a.event_id = b.event_id
         WHERE b.account_id = ? AND b.event_id = ? AND b.status = 'included' AND a.status = 'confirmed' AND a.attended = 1
         ORDER BY b.updated_at ASC, b.id ASC`,
      ).bind(...where).all<{ user_id: string }>(),
      db.prepare(
        'SELECT id, status, note, tea_id, public_recap FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ?',
      ).bind(...where, userId).first(),
    ]);
    return reply({ entries: await guestBookEntryKeys(included.results, link.account_id, link.event_id), own });
  }

  if (body.action === 'withdraw' || body.action === 'entry-withdraw') {
    await db.prepare(
      `DELETE FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ? AND attendee_id = ?
       AND EXISTS (SELECT 1 FROM event_attendees a WHERE ${seatCheck})`,
    ).bind(...where, userId, link.attendee_id, ...binds).run();
    return reply({ success: true });
  }

  if (body.action !== 'send' && body.action !== 'entry-save') return reply({ error: 'Choose a Guest Book action.' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note || note.length > GUEST_BOOK_NOTE_LIMIT) return reply({ error: 'Write a note of up to 280 characters.' }, 400);
  const written = await prepareGuestBookNote(
    db, userId, note, new Date().toISOString(), seatCheck, binds, body, link.first_name,
  ).run();
  if (!written.meta?.changes) {
    const identical = await db.prepare(
      `SELECT 1 FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ? AND note = ?
       AND public_recap = ? AND signed_name IS ?`,
    ).bind(...where, userId, note, guestBookPlacement(body).publicRecap, link.first_name).first();
    if (!identical) return reply({ error: 'This link cannot add a note.' }, 403);
  }
  return reply({ success: true });
}

/** Revoke every personal link under one booking (used when the booking's links are withdrawn). */
export const revokePartyLinks = (db: D1Database, attendeeId: string, eventId: string, accountId: string) =>
  db.prepare('DELETE FROM after_sit_party_links WHERE attendee_id = ? AND event_id = ? AND account_id = ?')
    .bind(attendeeId, eventId, accountId);
