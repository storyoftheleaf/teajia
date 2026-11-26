// The host's page for one table (Launch 2, slice H4:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H4").
//
// Everything here starts from ownHostedTable: the session must sit in the
// caller's own personal account and name the caller as its host_user_id.
// Anything else, another host's table, a shop's session, the shop owner
// looking in, is the same "not found". Saying yes to a guest is not here: the
// route reuses the admin approval's own reservation (buildApprovalReservation
// and the guarded allocator reservePartySeats), so capacity is checked in the
// same transaction as the seat is taken.

import { sessionInstant } from './sessionWalkthrough';
import { serveGuestBookReview } from './sessionGuestBook';
import { reviewGuestBookPhotos } from './sessionGuestBookPhotos';

export type HostedTableDoor = 'request' | 'link' | 'open';

export type OwnHostedTable = {
  id: string;
  account_id: string;
  slug: string;
  title: string;
  event_date: string;
  timezone: string | null;
  door: HostedTableDoor | 'open' | null;
  total_capacity: number;
  lifecycle_status: string;
};

/**
 * One of the caller's own tables, or null. The account must be the caller's
 * own personal account (owner and personal_inventory_user_id both the caller,
 * active), and the session must name the caller as its host.
 */
export async function ownHostedTable(db: D1Database, { hostUserId, eventId }: { hostUserId: string; eventId: string }) {
  if (!hostUserId || !eventId) return null;
  return db.prepare(`
    SELECT e.id, e.account_id, e.slug, e.title, e.event_date, e.timezone, e.door, e.total_capacity, e.lifecycle_status
      FROM events e
      JOIN accounts a ON a.id = e.account_id
     WHERE e.id = ? AND e.host_user_id = ?
       AND a.personal_inventory_user_id = ? AND a.owner_user_id = a.personal_inventory_user_id
       AND a.status = 'active'
  `).bind(eventId, hostUserId, hostUserId).first<OwnHostedTable>();
}

/** Review a contribution using the session and account resolved by the ownership guard. */
export function reviewHostedTableGuestBook(
  request: Request, db: D1Database, bucket: R2Bucket | undefined, table: OwnHostedTable,
  kind: 'notes' | 'photos', contributionId?: string,
) {
  return kind === 'photos'
    ? reviewGuestBookPhotos(request, db, bucket, table.account_id, table.id, contributionId, 'host')
    : serveGuestBookReview(request, db, table.account_id, table.id, contributionId);
}

/**
 * Seats taken, counted the way the guarded allocator counts them (held and
 * confirmed party seats, and a live offer to someone waiting), plus a
 * confirmed guest from before party seats existed, who has no seat row.
 */
export function seatsTakenSql(event: string): string {
  return `(
    (SELECT COUNT(*) FROM event_party_members pm
      WHERE pm.event_id = ${event}.id AND pm.account_id = ${event}.account_id AND pm.seat_status IN ('held', 'confirmed'))
    + (SELECT COUNT(*) FROM event_attendees offer
      WHERE offer.event_id = ${event}.id AND offer.account_id = ${event}.account_id AND offer.status = 'waitlist'
        AND offer.claim_expires_at IS NOT NULL AND datetime(offer.claim_expires_at) > datetime('now'))
    + (SELECT COUNT(*) FROM event_attendees older
      WHERE older.event_id = ${event}.id AND older.account_id = ${event}.account_id AND older.status = 'confirmed'
        AND NOT EXISTS (SELECT 1 FROM event_party_members seat
          WHERE seat.participation_id = older.id AND seat.event_id = older.event_id AND seat.account_id = older.account_id))
  )`;
}

export async function seatsTaken(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>): Promise<number> {
  const row = await db.prepare(`SELECT ${seatsTakenSql('e')} AS taken FROM events e WHERE e.id = ? AND e.account_id = ?`)
    .bind(table.id, table.account_id).first<{ taken: number }>();
  return Number(row?.taken ?? 0);
}

export type HostTableGuest = {
  id: string;
  full_name: string;
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'requested' | 'denied';
  plus_one: number | null;
  attended: number | null;
  created_at: string | null;
  /** What the guest wrote when they asked for a seat. */
  note: string | null;
  /** The phone number the guest gave, for the host's own WhatsApp. Null when none. */
  phone: string | null;
  /** The guest asked not to be photographed (photo_consent 0; NULL means they said nothing). */
  no_photographs: boolean;
};

/** The guests of one of the host's tables, for the host only. Never the guest's private link. */
export async function hostTableGuests(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>): Promise<HostTableGuest[]> {
  const { results } = await db.prepare(`
    SELECT id, full_name, status, plus_one, attended, created_at, notes, phone_number, photo_consent
      FROM event_attendees WHERE event_id = ? AND account_id = ?
     ORDER BY created_at ASC, id ASC
  `).bind(table.id, table.account_id).all<Record<string, unknown>>();
  return results.map(row => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    status: row.status as HostTableGuest['status'],
    plus_one: row.plus_one as number | null,
    attended: row.attended as number | null,
    created_at: row.created_at as string | null,
    note: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
    phone: typeof row.phone_number === 'string' && row.phone_number.trim() ? row.phone_number.trim() : null,
    // The seat form's "Please, no photographs of me" (H10) sends photo_consent
    // false, stored as 0; a guest who said nothing is stored NULL since H5
    // (seatRequest.photoConsentValue), so only a real no reads as one. Seats
    // taken before H5 kept 0 for silence and were not rewritten.
    no_photographs: row.photo_consent === 0,
  }));
}

/** A guest of this table who is waiting for the host's yes, with what the approval needs. */
export async function waitingGuest(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>, attendeeId: string) {
  return db.prepare(`
    SELECT ea.*, e.title AS event_title, e.slug AS event_slug,
           (SELECT COUNT(*) FROM event_party_members pm
             WHERE pm.participation_id = ea.id AND pm.event_id = ea.event_id AND pm.account_id = ea.account_id
               AND pm.is_primary = 0 AND pm.seat_status = 'requested') AS requested_guests
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id AND e.account_id = ea.account_id
     WHERE ea.id = ? AND ea.event_id = ? AND ea.account_id = ?
  `).bind(attendeeId, table.id, table.account_id).first<Record<string, unknown> & {
    id: string; account_id: string; event_id: string; full_name: string; status: string; requested_guests: number;
    guest_requests: string | null; phone_number: string | null; email: string | null; customer_id: string | null;
    magic_token: string;
  }>();
}

/**
 * The host says no to a guest who is still waiting. Guarded on the waiting
 * state, so a guest who was said yes to in the meantime is not undone here.
 * A waiting guest holds no seat, so nothing is freed.
 */
export async function sayNoToGuest(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>, attendeeId: string) {
  const result = await db.prepare(`
    UPDATE event_attendees SET status = 'denied'
     WHERE id = ? AND event_id = ? AND account_id = ? AND status IN ('requested', 'waitlist')
       AND (status = 'requested' OR claim_expires_at IS NULL OR datetime(claim_expires_at) <= datetime('now'))
  `).bind(attendeeId, table.id, table.account_id).run();
  return Boolean(result.meta?.changes);
}

export type TableChange = { door?: HostedTableDoor; seats?: number };
export type TableChangeResult =
  | { ok: true }
  | { refused: { status: number; code: string; error: string } };

const refuse = (status: number, code: string, error: string) => ({ refused: { status, code, error } });
export const HOST_TABLE_MAX_SEATS = 40;

/**
 * Read a change of door or seats from a request body. `doors` is what
 * hostDoorsFor gives this host now: 'open' only with the Launch 3 switch on
 * and reach above invitation (J10). A host not offered 'open' is refused it
 * exactly as before, with nothing that names reach.
 */
export function readTableChange(body: Record<string, unknown> | null, doors: HostedTableDoor[]): TableChange | Extract<TableChangeResult, { refused: unknown }> {
  if (!body) return refuse(400, 'hosted_table_change', 'Say what to change.');
  const change: TableChange = {};
  if (body.door !== undefined) {
    const offered = body.door === 'request' || body.door === 'link' || (body.door === 'open' && doors.includes('open'));
    if (!offered) return refuse(400, 'hosted_table_door', 'A table opens by request or by link.');
    if (!doors.includes(body.door as HostedTableDoor)) {
      return refuse(403, 'hosted_table_door_needs_approval', 'A table by link opens once Teajia has approved you as a host.');
    }
    change.door = body.door as HostedTableDoor;
  }
  if (body.seats !== undefined) {
    if (typeof body.seats !== 'number' || !Number.isInteger(body.seats) || body.seats < 1 || body.seats > HOST_TABLE_MAX_SEATS) {
      return refuse(400, 'hosted_table_seats', `Seats are a whole number from 1 to ${HOST_TABLE_MAX_SEATS}.`);
    }
    change.seats = body.seats;
  }
  if (change.door === undefined && change.seats === undefined) return refuse(400, 'hosted_table_change', 'Say what to change.');
  return change;
}

/**
 * Change the door or the seats of a table that has not happened yet. Seats
 * never go below the seats already taken: the guard is in the same statement
 * as the write, so a yes that lands at the same moment cannot slip under it.
 */
export async function changeHostedTable(db: D1Database, table: OwnHostedTable, change: TableChange): Promise<TableChangeResult> {
  if (table.lifecycle_status !== 'published') {
    return refuse(409, 'hosted_table_closed', 'This table has already happened, so its door and seats stay as they were.');
  }
  const sets: string[] = [];
  const values: unknown[] = [];
  if (change.door) {
    sets.push('door = ?', 'requires_approval = ?');
    // Only the by-link door seats a guest without the host's yes.
    values.push(change.door, change.door === 'link' ? 0 : 1);
  }
  if (change.seats !== undefined) {
    sets.push('total_capacity = ?');
    values.push(change.seats);
  }
  const result = await db.prepare(`
    UPDATE events SET ${sets.join(', ')}, updated_at = datetime('now')
     WHERE id = ? AND account_id = ? AND lifecycle_status = 'published'
       AND (? IS NULL OR ? >= ${seatsTakenSql('events')})
  `).bind(...values, table.id, table.account_id, change.seats ?? null, change.seats ?? null).run();
  if (result.meta?.changes) return { ok: true };
  const taken = await seatsTaken(db, table);
  if (change.seats !== undefined && change.seats < taken) {
    return refuse(409, 'hosted_table_seats_below_taken',
      `${taken} ${taken === 1 ? 'seat is' : 'seats are'} already taken, so the table needs at least ${taken}.`);
  }
  return refuse(409, 'hosted_table_changed', 'The table changed while you were looking. Open it again.');
}

/**
 * The host marks who came, once the table's time has passed. Every confirmed
 * guest named is marked as came and every other confirmed guest as not, and a
 * table still open is finished (published, then registration closed, then
 * completed, the steps the lifecycle allows), so each guest who came can be
 * given their thank-you link.
 */
export async function markWhoCame(db: D1Database, table: OwnHostedTable, attendeeIds: string[], now = new Date()) {
  const start = sessionInstant(table.event_date, table.timezone);
  if (!start || start.at > now.getTime()) {
    return refuse(409, 'hosted_table_not_started', 'Mark who came once the table has begun.');
  }
  if (!['published', 'registration_closed', 'completed'].includes(table.lifecycle_status)) {
    return refuse(409, 'hosted_table_closed', 'This table can no longer be marked.');
  }
  const ids = [...new Set(attendeeIds.filter(id => typeof id === 'string' && id))];
  const came = ids.length ? `id IN (${ids.map(() => '?').join(', ')})` : '0';
  await db.batch([
    db.prepare(`UPDATE event_attendees SET attended = CASE WHEN ${came} THEN 1 ELSE 0 END
      WHERE event_id = ? AND account_id = ? AND status = 'confirmed'`).bind(...ids, table.id, table.account_id),
    db.prepare(`UPDATE events SET lifecycle_status = 'registration_closed', status = 'closed', updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND lifecycle_status = 'published'`).bind(table.id, table.account_id),
    db.prepare(`UPDATE events SET lifecycle_status = 'completed', status = 'closed', updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND lifecycle_status = 'registration_closed'`).bind(table.id, table.account_id),
  ]);
  return { ok: true } as const;
}
