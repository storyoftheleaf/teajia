// The waiting list and a released seat (Launch 3, slice J9:
// todo/plans/guests-and-tea-masters.md; the audit is
// guests-build/j9-waiting-list-audit.md).
//
// The contract, and where each part of it is held:
//
// - Never more confirmed guests than seats. An offer is a seat: every count
//   (seatsTakenSql, and capacityGuard in eventDomain.ts) counts a live offer
//   as taken, and an offer is only made by offerFreedSeats, whose UPDATE
//   carries "a seat is free" in its own WHERE. Two releases at once cannot
//   offer the same seat twice.
// - A released seat goes to the longest-waiting guest, for the session's
//   claim window, then to the next. Order is waitlist_position, then when
//   they asked, then id, so two guests can never tie.
// - Nobody is offered twice at once: the UPDATE only touches a guest with no
//   offer at all (claim_expires_at IS NULL), so a second release finds the
//   next guest instead of renewing the first one's deadline.
// - A lapsed offer moves the queue on. lapseExpiredOffers clears only an
//   offer whose deadline has passed, in the same statement that checks it, so
//   a stale cleanup cannot wipe a deadline that was renewed in between. The
//   lapsed guest is marked (offer_lapsed_at) and is not offered again by
//   itself; in Manage the host can put them back at the end of the queue,
//   which clears the mark. The scheduled worker runs it.
// - Nobody loses a seat through someone else's action. releaseSeats is the
//   only way a seat is given back: by the guest themself (cancel), or by the
//   host on their own table (release). Each is guarded on the guest's status
//   in the same transaction, and gives back every seat the party holds: the
//   guest's own and any companion invitation nobody has claimed yet. A
//   companion who already claimed holds a seat of their own and keeps it.
// - The host is told, in the app: event_seat_notices, read on the host's table
//   page and in Manage. Nothing here sends anything to anyone, and no offer is
//   made once a session has begun.
//
// Every deadline is written to the whole second. SQLite's datetime() drops
// fractions, so a deadline with milliseconds reads as expired in SQL up to a
// second before it reads as expired in JavaScript; whole seconds make the two
// agree. Liveness is still decided in SQL wherever a write depends on it.

import { seatsTakenSql } from './hostTableGuests';
import { sessionInstant } from './sessionWalkthrough';

type Db = Pick<D1Database, 'prepare' | 'batch'>;

export type SeatNoticeKind = 'cancelled' | 'released' | 'offered' | 'offer_lapsed' | 'claimed';

export const LIVE_OFFER_SQL = (alias: string) =>
  `${alias}.claim_expires_at IS NOT NULL AND datetime(${alias}.claim_expires_at) > datetime('now')`;
const EXPIRED_OFFER_SQL = `claim_expires_at IS NOT NULL AND datetime(claim_expires_at) <= datetime('now')`;

/** An offer's deadline: the claim window from now, rounded up to the whole second. */
export function offerDeadline(now: number, minutes: number): string {
  const window = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return new Date(Math.ceil((now + window * 60_000) / 1000) * 1000).toISOString();
}

const noticeId = () => `seat-notice-${crypto.randomUUID()}`;

/** Write one notice for the host. A notice is a record only; a failure never fails the seat change. */
export async function recordSeatNotice(db: Db, notice: {
  accountId: string; eventId: string; attendeeId: string | null; kind: SeatNoticeKind; seats?: number;
}): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO event_seat_notices (id, account_id, event_id, attendee_id, kind, seats) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(noticeId(), notice.accountId, notice.eventId, notice.attendeeId, notice.kind, notice.seats ?? 0).run();
  } catch (error) {
    console.error('Seat notice not recorded', error instanceof Error ? error.message : String(error));
  }
}

export type ReleaseSeatsInput = {
  accountId: string;
  eventId: string;
  attendeeId: string;
  /** The statuses the guest may be in for this release to happen. */
  from: ReadonlyArray<'confirmed' | 'requested' | 'waitlist'>;
  /** 'cancelled' when the guest gave the seat up, 'released' when the host did. */
  kind: 'cancelled' | 'released';
  cancellationNote?: string;
  userId?: string;
};

/**
 * Give back every seat a party holds, and mark the guest cancelled, in one
 * transaction guarded on the guest's status. Returns the seats given back,
 * or null when the guest was not in one of the `from` statuses (already
 * cancelled, denied, or changed in the meantime), in which case nothing was
 * written.
 */
export async function releaseSeats(db: Db, input: ReleaseSeatsInput): Promise<{ seats: number } | null> {
  if (input.from.length === 0) return null;
  const statuses = input.from.map(() => '?').join(', ');
  const ownerGuard = input.userId === undefined ? '' : ' AND user_id = ?';
  const ownerValues = input.userId === undefined ? [] : [input.userId];
  const stillThere = `EXISTS (SELECT 1 FROM event_attendees guest
      WHERE guest.id = ? AND guest.event_id = ? AND guest.account_id = ? AND guest.status IN (${statuses})${ownerGuard})`;
  const stillThereValues = [input.attendeeId, input.eventId, input.accountId, ...input.from, ...ownerValues];
  // Seats given back: the party's own held and confirmed seats, or one seat
  // for a confirmed guest from before party seats existed.
  const seatsSql = `(
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM event_party_members pm
        WHERE pm.participation_id = ? AND pm.event_id = ? AND pm.account_id = ?)
      THEN (SELECT COUNT(*) FROM event_party_members pm
        WHERE pm.participation_id = ? AND pm.event_id = ? AND pm.account_id = ? AND pm.seat_status IN ('held', 'confirmed'))
      ELSE (SELECT COUNT(*) FROM event_attendees older
        WHERE older.id = ? AND older.event_id = ? AND older.account_id = ? AND older.status = 'confirmed')
    END)`;
  const party = [input.attendeeId, input.eventId, input.accountId];
  const id = noticeId();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO event_seat_notices (id, account_id, event_id, attendee_id, kind, seats)
       SELECT ?, ?, ?, ?, ?, ${seatsSql} WHERE ${stillThere}`
    ).bind(id, input.accountId, input.eventId, input.attendeeId, input.kind, ...party, ...party, ...party, ...stillThereValues),
    db.prepare(
      `UPDATE event_party_members SET seat_status = 'cancelled'
        WHERE participation_id = ? AND event_id = ? AND account_id = ?
          AND seat_status IN ('requested', 'held', 'confirmed') AND ${stillThere}`
    ).bind(...party, ...stillThereValues),
    db.prepare(
      `UPDATE guest_invites SET status = 'expired'
        WHERE parent_attendee_id = ? AND event_id = ? AND status = 'pending' AND ${stillThere}`
    ).bind(input.attendeeId, input.eventId, ...stillThereValues),
    db.prepare(
      `UPDATE event_attendees SET status = 'cancelled', claim_expires_at = NULL${input.cancellationNote !== undefined ? ', cancellation_note = ?' : ''}
        WHERE id = ? AND event_id = ? AND account_id = ? AND status IN (${statuses})${ownerGuard}`
    ).bind(...(input.cancellationNote !== undefined ? [input.cancellationNote] : []), ...party, ...input.from, ...ownerValues),
  ]);
  if (!Number(results[3]?.meta?.changes || 0)) return null;
  const row = await db.prepare(`SELECT seats FROM event_seat_notices WHERE id = ?`).bind(id).first<{ seats: number }>();
  return { seats: Number(row?.seats ?? 0) };
}

/** Guest cancellation, shared by the private guest link and the signed-in agent. */
export async function cancelGuestSeat(db: Db, input: Omit<ReleaseSeatsInput, 'from' | 'kind'>) {
  const released = await releaseSeats(db, { ...input, from: ['confirmed', 'requested', 'waitlist'], kind: 'cancelled' });
  if (!released) {
    const now = await db.prepare(`SELECT status FROM event_attendees WHERE id = ? AND event_id = ? AND account_id = ?
      ${input.userId === undefined ? '' : 'AND user_id = ?'}`)
      .bind(input.attendeeId, input.eventId, input.accountId, ...(input.userId === undefined ? [] : [input.userId]))
      .first<{ status: string }>();
    return now?.status === 'cancelled' ? { success: true, status: 'cancelled' } as const : null;
  }
  if (released.seats > 0) await offerFreedSeats(db, input);
  return {
    success: true, status: 'cancelled',
    ...(input.cancellationNote !== undefined ? { cancellation_note: input.cancellationNote } : {}),
  } as const;
}

/**
 * Clear offers whose deadline has passed, and tell the host. One event, or
 * (from the scheduled worker) every event, a page at a time. Returns the
 * events whose queue may now move on.
 */
export async function lapseExpiredOffers(db: Db, scope: { eventId: string; accountId: string } | { limit: number }) {
  const one = 'eventId' in scope;
  const { results } = await db.prepare(
    `UPDATE event_attendees SET claim_expires_at = NULL, offer_lapsed_at = datetime('now')
      WHERE status = 'waitlist' AND ${EXPIRED_OFFER_SQL}
        AND id IN (SELECT id FROM event_attendees
          WHERE status = 'waitlist' AND ${EXPIRED_OFFER_SQL}${one ? ' AND event_id = ? AND account_id = ?' : ''}
          LIMIT ?)
      RETURNING id, event_id, account_id`
  ).bind(...(one ? [scope.eventId, scope.accountId, 100] : [scope.limit])).all<{ id: string; event_id: string; account_id: string }>();
  for (const row of results) {
    await recordSeatNotice(db, { accountId: row.account_id, eventId: row.event_id, attendeeId: row.id, kind: 'offer_lapsed', seats: 1 });
  }
  const events = new Map<string, { eventId: string; accountId: string }>();
  for (const row of results) events.set(`${row.account_id}:${row.event_id}`, { eventId: row.event_id, accountId: row.account_id });
  return [...events.values()];
}

/**
 * Offer every free seat to the guests waiting longest, one seat each, for the
 * session's claim window. Expired offers are cleared first, so their seats
 * move on too. Nothing is offered on a session that is not open for seats or
 * has already begun. Returns the guests offered a seat, in order.
 */
export async function offerFreedSeats(db: Db, scope: { eventId: string; accountId: string }, now = Date.now()): Promise<string[]> {
  await lapseExpiredOffers(db, scope);
  const event = await db.prepare(
    `SELECT total_capacity, claim_window_minutes, lifecycle_status, event_date, timezone FROM events WHERE id = ? AND account_id = ?`
  ).bind(scope.eventId, scope.accountId).first<{
    total_capacity: number; claim_window_minutes: number | null; lifecycle_status: string; event_date: string; timezone: string | null;
  }>();
  if (!event || event.lifecycle_status !== 'published') return [];
  const start = sessionInstant(event.event_date, event.timezone);
  if (start && start.at <= now) return [];

  const offered: string[] = [];
  const deadline = offerDeadline(now, Number(event.claim_window_minutes) || 60);
  for (let round = 0; round < Math.max(1, Number(event.total_capacity) || 0); round += 1) {
    const row = await db.prepare(
      `UPDATE event_attendees SET claim_expires_at = ?
        WHERE id = (SELECT queued.id FROM event_attendees queued
            WHERE queued.event_id = ? AND queued.account_id = ? AND queued.status = 'waitlist'
              AND queued.claim_expires_at IS NULL AND queued.offer_lapsed_at IS NULL
            ORDER BY queued.waitlist_position IS NULL, queued.waitlist_position, queued.created_at, queued.id
            LIMIT 1)
          AND status = 'waitlist' AND claim_expires_at IS NULL AND offer_lapsed_at IS NULL
          AND EXISTS (SELECT 1 FROM events e
            WHERE e.id = ? AND e.account_id = ? AND e.lifecycle_status = 'published'
              AND ${seatsTakenSql('e')} < e.total_capacity)
        RETURNING id`
    ).bind(deadline, scope.eventId, scope.accountId, scope.eventId, scope.accountId).first<{ id: string }>();
    if (!row) break;
    offered.push(row.id);
    await recordSeatNotice(db, { ...scope, attendeeId: row.id, kind: 'offered', seats: 1 });
    // The record the shop's Notifications list already shows. It is never
    // sent by the worker: the guest sees the offer on their own page.
    try {
      await db.prepare(
        `INSERT INTO event_notifications (id, account_id, event_id, attendee_id, type, message_template, status)
         VALUES (?, ?, ?, ?, 'waitlist_promotion', 'A seat has opened. Take it before the offer ends.', 'pending')`
      ).bind(crypto.randomUUID(), scope.accountId, scope.eventId, row.id).run();
    } catch (error) {
      console.error('Waiting list record not written', error instanceof Error ? error.message : String(error));
    }
  }
  return offered;
}

/** The scheduled worker's part: lapse expired offers everywhere and move each queue on. */
export async function advanceWaitingLists(db: Db, now = Date.now()): Promise<{ lapsed: number; offered: number }> {
  let lapsed = 0;
  let offered = 0;
  for (let page = 0; page < 5; page += 1) {
    const events = await lapseExpiredOffers(db, { limit: 100 });
    if (events.length === 0) break;
    lapsed += events.length;
    for (const event of events) offered += (await offerFreedSeats(db, event, now)).length;
  }
  return { lapsed, offered };
}

/** Where a guest goes on the waiting list: after everyone already on it. Used inside the write that puts them there. */
export const NEXT_WAITLIST_POSITION_SQL = `(SELECT COALESCE(MAX(queue.waitlist_position), 0) + 1 FROM event_attendees queue
  WHERE queue.event_id = event_attendees.event_id AND queue.account_id = event_attendees.account_id AND queue.status = 'waitlist')`;

export type SeatNotice = {
  id: string;
  kind: SeatNoticeKind;
  seats: number;
  guest_name: string | null;
  created_at: string;
};

/** What happened to the seats of one session, newest first, for its host. */
export async function seatNoticesFor(db: Db, scope: { eventId: string; accountId: string }, limit = 30): Promise<SeatNotice[]> {
  const { results } = await db.prepare(
    `SELECT n.id, n.kind, n.seats, n.created_at, ea.full_name AS guest_name
       FROM event_seat_notices n
       LEFT JOIN event_attendees ea ON ea.id = n.attendee_id AND ea.event_id = n.event_id AND ea.account_id = n.account_id
      WHERE n.event_id = ? AND n.account_id = ?
      ORDER BY n.created_at DESC, n.rowid DESC
      LIMIT ?`
  ).bind(scope.eventId, scope.accountId, limit).all<SeatNotice>();
  return results.map(row => ({ ...row, seats: Number(row.seats) || 0 }));
}
