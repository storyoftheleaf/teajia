// Taking a seat by name (Launch 2, slice H5:
// todo/plans/guests-and-tea-masters-launch-2-run.md, hard question 8, "Astra,
// H5: a seat by name").
//
// The decisions handleRSVP (worker/src/index.ts) takes before it writes, kept
// pure so each is tested on its own (worker/tests/seat-request.test.ts):
//
// - What a door asks for. At a by-link door ('link') a name is enough; phone
//   and email are optional. At a by-request door ('request') and at an older
//   session (door NULL, read from requires_approval exactly as before) a phone
//   or an email is still required, because the host has to be able to answer.
// - What status the seat gets: confirmed at once at a by-link door, waiting for
//   the host's yes at a by-request door, and as before at an older session.
// - Whether a request is a repeat. A guest who gave no contact can only be
//   told apart by the browser they asked from: the seat form sends a random
//   per-browser key, and the seat's id is derived from it, so a second tap
//   from the same browser finds the first seat instead of taking another.
//   Without a key, two requests are two guests.
// - A guest who gave no contact makes no customers row, and is never looked
//   up by contact: there is nothing to match, and an empty string must never
//   match the empty strings of someone else.
//
// Never more confirmed guests than seats: the write itself is guarded. It is
// reservePartySeats (worker/src/eventDomain.ts), whose INSERT carries the
// count in its own WHERE (noted at the foot of this file) inside one D1 batch, so
// two requests for the last seat cannot both pass. A read of the free seats
// followed by a write is not enough: both requests can read "one left" before
// either writes.

export type SeatDoor = 'request' | 'link' | 'open' | null;

/** How this session's door behaves for a seat request. */
export type SeatDoorRule = 'link' | 'request' | 'older' | 'closed';

/**
 * The door, read for a seat. NULL is an older session and behaves exactly as
 * today from requires_approval. 'open' is refused until Launch 3.
 */
export function seatDoorRule(door: unknown): SeatDoorRule {
  if (door === 'link') return 'link';
  if (door === 'request') return 'request';
  if (door === null || door === undefined) return 'older';
  return 'closed';
}

export type SeatContact = { phone: string | null; email: string | null };

/**
 * The contact a guest gave, or none. Surrounding space is not a contact, and
 * a phone with no digit in it is not a phone. Everything else is kept as
 * typed, as before.
 */
export function seatContact(body: { phone_number?: unknown; email?: unknown }): SeatContact {
  const phone = typeof body.phone_number === 'string' ? body.phone_number.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  return {
    phone: phone && /\d/.test(phone) ? phone : null,
    email: email || null,
  };
}

export const hasContact = (contact: SeatContact) => Boolean(contact.phone || contact.email);

export type SeatRefusal = { status: number; error: string; code: string };

/** What the door asks for, or the refusal. The message is the one the form shows. */
export function seatRequirement(rule: SeatDoorRule, fullName: unknown, contact: SeatContact): SeatRefusal | null {
  if (rule === 'closed') {
    return { status: 409, error: 'This table is not taking seats.', code: 'event_not_reservable' };
  }
  if (typeof fullName !== 'string' || !fullName.trim()) {
    return { status: 400, error: 'full_name is required', code: 'full_name_required' };
  }
  if (rule !== 'link' && !hasContact(contact)) {
    return { status: 400, error: 'phone_number or email is required', code: 'contact_required' };
  }
  return null;
}

/** The status a new seat gets. */
export function seatStatusFor(rule: SeatDoorRule, requiresApproval: unknown): 'confirmed' | 'requested' {
  if (rule === 'link') return 'confirmed';
  if (rule === 'request') return 'requested';
  // An older session: approval unless it was explicitly turned off (a stored
  // 0), exactly as handleRSVP read it before; NULL still asks for approval.
  return requiresApproval === 0 ? 'confirmed' : 'requested';
}

/**
 * The guest's own wish about photographs. A tick on "Please, no photographs
 * of me" is sent as false and kept as 0; a yes is 1; a guest who said nothing
 * is NULL, so the host's list does not read silence as a no.
 */
export function photoConsentValue(value: unknown): 1 | 0 | null {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return null;
}

/** A per-browser key is random and long; anything else is ignored. */
export function seatKey(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22,128}$/.test(value) ? value : null;
}

/**
 * The seat's id when the browser sent its key: the same browser asking twice
 * for the same session derives the same id, so the second insert cannot add a
 * second seat. The key itself is never stored; the id is a one-way digest of
 * it, so reading the id (the host's admin sees it) does not give the key.
 */
export async function seatIdFromKey(eventId: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`teajia-seat:${eventId}:${key}`));
  return `seat-${[...new Uint8Array(digest)].slice(0, 16).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Whether a repeat is used at all: only at a by-link door, where a name may be all there is. */
export const usesSeatKey = (rule: SeatDoorRule, key: string | null): key is string => rule === 'link' && key !== null;

/**
 * Contact lookups (the repeat by contact and the customer by contact) run
 * only with a contact. With none there is nothing to match, so nothing is
 * looked up and no customer is made.
 */
export const looksUpByContact = (contact: SeatContact) => hasContact(contact);
export const createsCustomer = (contact: SeatContact) => hasContact(contact);

/**
 * What a full by-link table says. No waiting list is made in this launch.
 * A party larger than the seats left is told how many are left, and nobody of
 * it is seated: a party is seated whole or not at all.
 */
export function linkDoorFullAnswer(seatsLeft: number, partySize: number): SeatRefusal {
  if (seatsLeft <= 0) return { status: 409, error: 'This table is full.', code: 'table_full' };
  const left = seatsLeft === 1 ? 'One seat is left' : `${seatsLeft} seats are left`;
  return {
    status: 409,
    error: `${left}, and you asked for ${partySize}. Ask for fewer, or ask the host.`,
    code: 'table_too_few_seats',
  };
}

/*
 * The guarded write, for the record. reservePartySeats builds this condition
 * (capacityGuard in eventDomain.ts) into the INSERT of the guest and of each
 * of their party's seats, and ends the batch with a statement that fails when
 * any of them wrote nothing, which rolls the whole batch back:
 *
 *   INSERT INTO event_party_members (...) SELECT ...
 *    WHERE (SELECT COUNT(*) FROM event_party_members WHERE event_id = ?
 *             AND seat_status IN ('held','confirmed'))
 *          + <seats asked for>
 *          + <live waiting-list offers>
 *          <= events.total_capacity
 *
 * D1 runs a batch as one transaction and one writer at a time, so the count
 * each request sees includes every seat already written.
 */
