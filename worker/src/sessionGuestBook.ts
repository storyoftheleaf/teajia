import { hashAfterSitCredential } from './afterSitCredential';
import { privateAttendeeMatch } from './privateSessionReflections';

type Scope = { accountId: string; userId: string };
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const GUEST_BOOK_NOTE_LIMIT = 280;

export function prepareGuestBookNote(
  db: D1Database, userId: string, note: string, now: string, seatCheck: string, binds: string[],
) {
  return db.prepare(
    `INSERT INTO session_guest_book (id, account_id, event_id, attendee_id, user_id, note, status, updated_at)
     SELECT ?, a.account_id, a.event_id, a.id, ?, ?, 'pending', ?
     FROM event_attendees a WHERE ${seatCheck}
     ON CONFLICT(account_id, event_id, user_id) DO UPDATE
     SET note = excluded.note, status = 'pending', revision = revision + 1, updated_at = excluded.updated_at
     WHERE session_guest_book.note <> excluded.note`
  ).bind(crypto.randomUUID(), userId, note, now, ...binds);
}

export function guestBookEntryKeys<T extends { user_id: string }>(rows: T[], accountId: string, eventId: string) {
  return Promise.all(rows.map(async ({ user_id, ...row }) => ({
    ...row,
    entry_key: await hashAfterSitCredential(JSON.stringify(['guest-book-entry', accountId, eventId, user_id])),
  })));
}

const attendeeBinds = (scope: Scope, token: string) => [token, scope.accountId, scope.userId, scope.userId];
const roster = `FROM session_guest_book b
  JOIN event_attendees a ON a.id = b.attendee_id AND a.account_id = b.account_id AND a.event_id = b.event_id
  WHERE b.account_id = ? AND b.event_id = ? AND a.status = 'confirmed' AND a.attended = 1`;

export async function serveGuestBook(request: Request, db: D1Database, scope: Scope, token: string, afterSitHash?: string) {
  const linkCheck = afterSitHash === undefined ? '' : `AND EXISTS (
    SELECT 1 FROM after_sit_access l WHERE l.attendee_id = a.id AND l.event_id = a.event_id AND l.account_id = a.account_id
      AND l.credential_hash = ? AND l.expires_at > unixepoch()
  )`;
  const seatCheck = `${privateAttendeeMatch} ${linkCheck}`;
  const binds = [...attendeeBinds(scope, token), ...(afterSitHash === undefined ? [] : [afterSitHash])];
  const findSeat = () => db.prepare(
    `SELECT a.event_id FROM event_attendees a WHERE ${seatCheck}`
  ).bind(...binds).first<{ event_id: string }>();
  const seat = await findSeat();
  if (!seat) return reply({ error: 'Confirm your own attendance to open the guest book.' }, 403);
  const where = [scope.accountId, seat.event_id];
  if (request.method === 'GET') {
    const [included, own] = await Promise.all([
      db.prepare(
        `SELECT b.id, a.full_name AS display_name, b.note, b.user_id ${roster}
         AND b.status = 'included' ORDER BY b.updated_at ASC, b.id ASC`
      ).bind(...where).all<{ user_id: string }>(),
      db.prepare(
        'SELECT id, status, note FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ?'
      ).bind(...where, scope.userId).first(),
    ]);
    const entries = await guestBookEntryKeys(included.results, scope.accountId, seat.event_id);
    if (!await findSeat()) return reply({ error: 'Confirm your own attendance to open the guest book.' }, 403);
    return reply({ entries, own });
  }

  if (request.method === 'DELETE') {
    await db.prepare(
      `DELETE FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ?
       AND EXISTS (SELECT 1 FROM event_attendees a WHERE ${seatCheck})`
    ).bind(...where, scope.userId, ...binds).run();
    return reply({ success: true });
  }

  const body = await request.json().catch(() => null) as { note?: unknown } | null;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!note || note.length > GUEST_BOOK_NOTE_LIMIT) return reply({ error: 'Write a note of up to 280 characters.' }, 400);
  const [, written] = await db.batch([
    db.prepare(`UPDATE event_attendees AS a SET user_id = ? WHERE a.user_id IS NULL AND ${seatCheck}`)
      .bind(scope.userId, ...binds),
    prepareGuestBookNote(db, scope.userId, note, new Date().toISOString(), seatCheck, binds),
  ]);
  if (!written.meta?.changes) {
    const identical = await db.prepare(
      'SELECT 1 FROM session_guest_book WHERE account_id = ? AND event_id = ? AND user_id = ? AND note = ?'
    ).bind(...where, scope.userId, note).first();
    if (!identical) return reply({ error: 'Confirm your attendance before sharing.' }, 403);
  }
  return reply({ success: true });
}

export async function serveGuestBookReview(request: Request, db: D1Database, accountId: string, eventId: string, id?: string) {
  const event = await db.prepare(
    `SELECT 1 FROM events WHERE account_id = ? AND id = ? AND lifecycle_status IN ('completed', 'archived')`
  ).bind(accountId, eventId).first();
  if (!event) return reply({ error: 'Completed session not found.' }, 404);
  if (!id) {
    const { results } = await db.prepare(
      `SELECT b.id, a.full_name AS display_name, b.note, b.status, b.revision, b.user_id ${roster}
       ORDER BY CASE b.status WHEN 'pending' THEN 0 WHEN 'included' THEN 1 ELSE 2 END, b.updated_at DESC`
    ).bind(accountId, eventId).all<{ user_id: string }>();
    return reply({ entries: await guestBookEntryKeys(results, accountId, eventId) });
  }
  const body = await request.json().catch(() => null) as { action?: unknown; revision?: unknown } | null;
  if ((body?.action !== 'include' && body?.action !== 'pass') ||
      typeof body.revision !== 'number' || !Number.isSafeInteger(body.revision) || body.revision < 1) {
    return reply({ error: 'Choose an action for the current revision.' }, 400);
  }
  const updated = await db.prepare(
    `UPDATE session_guest_book SET status = ?
     WHERE id = ? AND revision = ? AND id IN (SELECT b.id ${roster})`
  ).bind(body.action === 'include' ? 'included' : 'passed', id, body.revision, accountId, eventId).run();
  return updated.meta?.changes ? reply({ success: true }) : reply({ error: 'This note changed. Read it again before reviewing.' }, 409);
}
