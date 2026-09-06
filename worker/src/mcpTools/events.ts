/**
 * Events over MCP — running a tea session by voice.
 *
 * Eight tools: three that read (what is coming up, one session in detail, who
 * is on its list) and five that write (create, edit, move the lifecycle, take
 * an RSVP, approve one). Everything a seat touches goes through
 * `reservePartySeats` in eventDomain.ts rather than writing
 * `event_attendees` / `event_party_members` directly, because capacity is
 * decided in one atomic batch there and a second implementation of it is a
 * double-booked session nobody notices until twelve people arrive for ten
 * seats.
 *
 * ── What the domain would not let me build ──
 *
 * "Unpublish" is not here because it does not exist. `EVENT_TRANSITIONS` lets
 * `published` go to `registration_closed` or `cancelled` and nowhere else, so
 * a tool called unpublish would either fail every time or quietly invent a
 * seventh transition. Closing registration is the move that was actually
 * designed; that is what `set_event_lifecycle` offers.
 *
 * Denying, waitlisting and cancelling an RSVP are also absent, and their
 * absence is deliberate. The admin routes for those call `cascadeWaitlist`,
 * which promotes the first waitlisted party into the freed seat. That helper
 * lives unexported in index.ts, so a tool here could only reimplement it — a
 * second copy of a promotion rule is exactly the shape that once gave this
 * shop four freight rates, and here the cost would be a guest who was promised
 * a seat and never told. See REQUIREMENTS below.
 *
 * ── REQUIREMENTS ON FILES THIS MODULE MAY NOT EDIT ──
 *
 * These are the changes this module needs and could not make, listed so the
 * next person does not have to rediscover them:
 *
 *  1. `worker/src/index.ts` — `EVENT_STATUS_BY_LIFECYCLE` (and its inverse
 *     `EVENT_LIFECYCLE_BY_STATUS`) should move to `eventDomain.ts` and be
 *     imported back. The map is duplicated below because it is not exported and
 *     `events.status` must move in lockstep with `events.lifecycle_status` —
 *     the public routes still read `status = 'active'`, so writing one without
 *     the other publishes an event no visitor can see, with nothing failing.
 *     `worker/tests/mcp-events.test.ts` reads index.ts's source and fails if the
 *     two copies drift, which is a splint, not a fix.
 *
 *  2. `worker/src/index.ts` — `cascadeWaitlist` should move to `eventDomain.ts`
 *     too. It is the reason there is no tool here for denying, waitlisting or
 *     cancelling an RSVP: those routes call it to promote the first waitlisted
 *     party into the freed seat, and a tool that freed a seat without it would
 *     leave a guest who was promised one and never told.
 *
 *  3. `worker/src/mcp.ts` — SERVER_INFO's description still lists inventory,
 *     invoicing and the order process, and says nothing about running a
 *     session. A client reads that string to decide what this server is for.
 *
 * Three earlier requirements are already met and are recorded here only so
 * nobody re-does them: the seam registers this module in `TOOL_MODULES`,
 * derives `readOnlyHint` from a `:read` scope rather than a hand-kept list, and
 * audits every non-read-only module tool by construction.
 *
 * ── Scopes, and why these ones ──
 *
 * There is no `events:read`, and inventing one is not on the table: the scope
 * list is in mcp.ts, tokens already minted carry the seven that exist, and a
 * scope no token holds makes a tool nobody can call. So:
 *
 *  - The three reads take `inventory:read`, the scope this server already
 *    treats as "may see what the shop holds". A session with ten seats is
 *    stock of a different kind, and `inventory:read` is the only read scope
 *    that is not specifically about people.
 *
 *  - `create_event`, `update_event` and `set_event_lifecycle` take
 *    `catalog:write`. An event is a catalogue object — a slug, a title, a
 *    description, a flyer, a public page — and publishing one is the same act
 *    of authority as putting a tea in the shop. `catalog:write` is owner-tier,
 *    which is right: nobody should publish a session from a door-staff token.
 *
 *  - `record_event_rsvp` and `approve_event_rsvp` take `sales:write`. Seating a
 *    named person against a finite capacity is order-shaped, not
 *    catalogue-shaped, and it is work the person running the door does. Making
 *    them owner-tier would mean Adrian is the only one who can answer a
 *    WhatsApp asking for a seat.
 *
 * ── What is deliberately not in any payload here ──
 *
 * No phone number and no email address is ever returned. `list_event_rsvps`
 * gives names, status and `customer_id`; a caller that needs to reach someone
 * looks the customer up with `get_customer`, which holds `customers:read` for
 * exactly that reason. The one place contact detail appears is the preview of
 * `record_event_rsvp`, echoing back the number the operator just spoke, because
 * a mis-heard digit is the failure that preview exists to catch.
 */

import {
  EVENT_TRANSITIONS,
  reservePartySeats,
  seatAvailability,
  type EventLifecycle,
  type PartySeatReservation,
  type ReservePartySeatsInput,
  type ReservePartySeatsResult,
} from '../eventDomain';
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET as expiredTicket, consumeTicket as consumeShared, issueTicket, previewEnvelope } from './tickets';

// ── the two maps index.ts owns and does not export ──
//
// `events` carries both the old four-value `status` and the six-value
// `lifecycle_status`, and the public surface has not moved: /api/events,
// /api/events/:slug/availability and the public RSVP door all still select on
// `status = 'active'`. Writing one without the other publishes an event that
// no visitor can see, or leaves a cancelled one taking bookings. Requirement 4
// above is the real fix; until then these must equal index.ts's copies, which
// the test asserts by reading its source.
export const EVENT_STATUS_BY_LIFECYCLE: Readonly<Record<EventLifecycle, string>> = {
  draft: 'draft',
  published: 'active',
  registration_closed: 'closed',
  completed: 'closed',
  cancelled: 'closed',
  archived: 'archived',
};

const EVENT_LIFECYCLE_VALUES = Object.keys(EVENT_STATUS_BY_LIFECYCLE) as EventLifecycle[];

const isEventLifecycle = (value: unknown): value is EventLifecycle =>
  typeof value === 'string' && (EVENT_LIFECYCLE_VALUES as string[]).includes(value);


// ── confirmation tickets ──
//
// The mechanism is `./tickets`, shared by every module in this folder. It is
// not reimplemented here: a preview and its confirm can land on different
// isolates, so the pending mutation has to live in D1 rather than in module
// memory, and a second copy of that rule is free to drift from the first in
// exactly the way the four freight rates did. All this module owns is the
// shape of what it stores.
//
// Every variant carries `accountId` because the shared consume matches on it
// in the guarded UPDATE, and `userEmail` because the commit writes an
// activity_logs row naming who did it.

type EventMutation =
  | { kind: 'create_event'; accountId: string; userEmail: string; fields: Record<string, unknown>; slug: string; title: string }
  | { kind: 'update_event'; accountId: string; userEmail: string; eventId: string; fields: Record<string, unknown>; title: string }
  | { kind: 'set_event_lifecycle'; accountId: string; userEmail: string; eventId: string; from: EventLifecycle; to: EventLifecycle; title: string }
  | {
      kind: 'record_event_rsvp'; accountId: string; userEmail: string; eventId: string; eventTitle: string;
      attendeeId: string; magicToken: string; fullName: string; phone: string | null; email: string | null;
      customerId: string | null; accessTier: string; guestNames: string[]; holdForApproval: boolean;
      showInGuestList: boolean; notes: string | null;
    }
  | {
      kind: 'approve_event_rsvp'; accountId: string; userEmail: string; eventId: string;
      attendeeId: string; fullName: string; approvedGuests: number;
    };


// ── argument reading ──
//
// `enteredNumber()` in the admin exists because `Number('')` is 0 and an empty
// input is falsy exactly like a typed zero, so the natural conversion turns "I
// said nothing" into "the value is zero". A tool call has the same two states
// and the same trap: a capacity nobody named is not a capacity of nobody.
// These three are that rule at this boundary.

/** Present and non-blank, or absent. A whitespace-only title is not a title. */
function enteredText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function requiredText(name: string, value: unknown, max = 500): string {
  const text = enteredText(value);
  if (!text) throw new Error(`${name} is required`);
  return text.slice(0, max);
}

/**
 * A whole count that may legitimately be zero. Absence returns undefined so the
 * caller can tell "leave it alone" from "make it nothing"; a capacity of 0 is a
 * session with no seats, which is a strange thing to enter but is not the same
 * fact as a session whose capacity was never set.
 */
function enteredCount(name: string, value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${name} must be a whole number of zero or more`);
  return n;
}

function enteredFlag(name: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function boundedLimit(value: unknown, fallback: number, ceiling: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), ceiling);
}

// ── shared reads ──

type EventRow = {
  id: string; slug: string; title: string; subtitle: string | null;
  event_date: string; event_end_date: string | null;
  location_name: string | null; area_hint: string | null;
  total_capacity: number; claim_window_minutes: number | null; timezone: string | null;
  status: string; lifecycle_status: string; requires_approval: number;
  gathering_type: string | null; public_visibility: string; event_format: string;
  held_seats: number; offered_seats: number;
  requested_count: number; waitlist_count: number; interest_count: number;
};

// The two counted subqueries are lifted from handleGetEvents in index.ts rather
// than re-derived: a seat is held when a party member says so, and a waitlist
// row only holds capacity while its claim window is still open. Counting
// `event_attendees` instead — the obvious shortcut — counts parties, not seats,
// and a party of three reads as one.
const EVENT_SELECT = `
  SELECT e.id, e.slug, e.title, e.subtitle, e.event_date, e.event_end_date,
         e.location_name, e.area_hint, e.total_capacity, e.claim_window_minutes,
         e.timezone, e.status, e.lifecycle_status, e.requires_approval,
         e.gathering_type, e.public_visibility, e.event_format,
         COALESCE((SELECT COUNT(*) FROM event_party_members pm
           WHERE pm.event_id = e.id AND pm.account_id = e.account_id
             AND pm.seat_status IN ('held','confirmed')), 0) AS held_seats,
         COALESCE((SELECT COUNT(*) FROM event_attendees offer
           WHERE offer.event_id = e.id AND offer.account_id = e.account_id
             AND offer.status = 'waitlist' AND offer.claim_expires_at IS NOT NULL
             AND datetime(offer.claim_expires_at) > datetime('now')), 0) AS offered_seats,
         COALESCE((SELECT COUNT(*) FROM event_attendees req
           WHERE req.event_id = e.id AND req.status = 'requested'), 0) AS requested_count,
         COALESCE((SELECT COUNT(*) FROM event_attendees wl
           WHERE wl.event_id = e.id AND wl.status = 'waitlist'), 0) AS waitlist_count,
         COALESCE((SELECT COUNT(*) FROM interest_signups si
           WHERE si.event_id = e.id AND si.converted_at IS NULL), 0) AS interest_count
    FROM events e`;

/**
 * Seat arithmetic, or an honest nothing.
 *
 * `seatAvailability` throws on a capacity that is not a whole non-negative
 * number, and a legacy row can hold one. Reporting a dash there is right;
 * inventing a 0 says "full" and inventing a capacity says "room left", and both
 * are wrong in the direction that puts a stranger on a doorstep.
 */
function seatsFor(row: Pick<EventRow, 'total_capacity' | 'held_seats' | 'offered_seats'>) {
  try {
    const { held, available } = seatAvailability({
      capacity: Number(row.total_capacity),
      confirmedSeats: Number(row.held_seats),
      offeredSeats: Number(row.offered_seats),
    });
    return {
      total_capacity: Number(row.total_capacity),
      seats_held: held,
      seats_available: available,
      is_full: available === 0,
    };
  } catch {
    return {
      total_capacity: null,
      seats_held: null,
      seats_available: null,
      is_full: null,
      seat_count_unavailable: 'This event has a capacity that is not a whole number of seats, so availability cannot be stated.',
    };
  }
}

function eventProjection(row: EventRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    event_date: row.event_date,
    event_end_date: row.event_end_date,
    location_name: row.location_name,
    area_hint: row.area_hint,
    timezone: row.timezone,
    lifecycle_status: row.lifecycle_status,
    legacy_status: row.status,
    public_visibility: row.public_visibility,
    gathering_type: row.gathering_type,
    event_format: row.event_format,
    requires_approval: Number(row.requires_approval) !== 0,
    claim_window_minutes: row.claim_window_minutes,
    ...seatsFor(row),
    requests_awaiting_reply: Number(row.requested_count),
    waitlisted: Number(row.waitlist_count),
    interest_signups: Number(row.interest_count),
    next_lifecycle_states: isEventLifecycle(row.lifecycle_status)
      ? [...EVENT_TRANSITIONS[row.lifecycle_status]]
      : [],
  };
}

async function loadEvent(env: ToolEnv, accountId: string, idOrSlug: string): Promise<EventRow | null> {
  return await env.DB.prepare(
    `${EVENT_SELECT} WHERE (e.id = ? OR e.slug = ?) AND e.account_id = ?`
  ).bind(idOrSlug, idOrSlug, accountId).first<EventRow>();
}

/** Named errors beat a bare throw: the model reads these back to a person. */
function seatFailure(result: Exclude<ReservePartySeatsResult, { ok: true }>) {
  if (result.code === 'capacity_conflict') {
    return { error: 'capacity_conflict', message: 'The session filled while this was being confirmed. Nothing was written.' };
  }
  if (result.code === 'event_not_reservable') {
    return { error: 'event_not_published', message: 'Seats can only be held on a published event. Publish it first with set_event_lifecycle.' };
  }
  return { error: 'state_conflict', message: 'The RSVP changed while this was being confirmed. Read it again and retry.' };
}

function activityLog(
  env: ToolEnv, action: string, details: string,
  userEmail: string, entityType: string, entityId: string, accountId: string,
) {
  return env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), action, details, userEmail, entityType, entityId, accountId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Reads
// ═══════════════════════════════════════════════════════════════════════════

const listEvents: ToolHandler = async (env, auth, args) => {
  const limit = boundedLimit(args?.limit, 20, 100);
  const when = String(args?.when ?? 'upcoming');
  const wheres = ['e.account_id = ?'];
  const binds: unknown[] = [auth.accountId];

  // "Upcoming" means the date has not passed, not that the event is published:
  // a draft two days out is the thing most likely to need attention, and
  // hiding it would answer "what is coming up" with silence.
  if (when === 'upcoming') wheres.push(`datetime(e.event_date) >= datetime('now', '-12 hours')`);
  else if (when === 'past') wheres.push(`datetime(e.event_date) < datetime('now', '-12 hours')`);
  else if (when !== 'all') throw new Error(`when must be one of: upcoming, past, all`);

  const lifecycle = enteredText(args?.lifecycle_status);
  if (lifecycle) {
    if (!isEventLifecycle(lifecycle)) throw new Error(`lifecycle_status must be one of: ${EVENT_LIFECYCLE_VALUES.join(', ')}`);
    wheres.push('e.lifecycle_status = ?');
    binds.push(lifecycle);
  }

  const { results } = await env.DB.prepare(
    `${EVENT_SELECT} WHERE ${wheres.join(' AND ')}
      ORDER BY e.event_date ${when === 'past' ? 'DESC' : 'ASC'} LIMIT ?`
  ).bind(...binds, limit).all<EventRow>();

  return { events: results.map(eventProjection), count: results.length, when };
};

const getEvent: ToolHandler = async (env, auth, args) => {
  const key = requiredText('event', args?.event_id ?? args?.slug);
  const row = await loadEvent(env, auth.accountId, key);
  if (!row) return { error: 'event_not_found' };

  // The tea menu is the other half of "read one event" for a host, and it
  // carries nothing personal.
  const { results: menu } = await env.DB.prepare(
    `SELECT tm.id, tm.brew_order, tm.reveal_date,
            COALESCE(tm.custom_name, p.given_name, p.product_name) AS name,
            tm.product_id
       FROM event_tea_menu tm
       LEFT JOIN products p ON p.id = tm.product_id AND p.account_id = ?
      WHERE tm.event_id = ? AND tm.account_id = ?
      ORDER BY COALESCE(tm.brew_order, 999), tm.created_at`
  ).bind(auth.accountId, row.id, auth.accountId).all();

  return {
    event: eventProjection(row),
    tea_menu: menu,
    // Said plainly so a model does not go looking for a phone number that is
    // deliberately not here.
    guest_list_hint: 'Names and statuses are in list_event_rsvps. Contact details are never in an event payload — look the person up with get_customer using the customer_id it returns.',
  };
};

type RsvpRow = {
  id: string; full_name: string; status: string; access_tier: string;
  customer_id: string | null; waitlist_position: number | null;
  attended: number | null; created_at: string; show_in_guest_list: number | null;
  seats_requested: number; seats_held: number;
};

const listEventRsvps: ToolHandler = async (env, auth, args) => {
  const key = requiredText('event', args?.event_id ?? args?.slug);
  const event = await loadEvent(env, auth.accountId, key);
  if (!event) return { error: 'event_not_found' };

  const status = enteredText(args?.status);
  const allowed = ['confirmed', 'requested', 'waitlist', 'denied', 'cancelled'];
  if (status && !allowed.includes(status)) throw new Error(`status must be one of: ${allowed.join(', ')}`);

  // Scoped through the event, the way handleGetAttendees does it: the FK to
  // `events` is the authority on which shop a participation belongs to, and
  // `event_attendees.account_id` is nullable, so filtering on it directly
  // would hide legacy rows rather than protect them.
  const { results } = await env.DB.prepare(
    `SELECT ea.id, ea.full_name, ea.status, ea.access_tier, ea.customer_id,
            ea.waitlist_position, ea.attended, ea.created_at, ea.show_in_guest_list,
            COALESCE((SELECT COUNT(*) FROM event_party_members pm
              WHERE pm.participation_id = ea.id AND pm.seat_status = 'requested'), 0) AS seats_requested,
            COALESCE((SELECT COUNT(*) FROM event_party_members pm
              WHERE pm.participation_id = ea.id AND pm.seat_status IN ('held','confirmed')), 0) AS seats_held
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
      WHERE ea.event_id = ? AND e.account_id = ?
        ${status ? 'AND ea.status = ?' : ''}
      ORDER BY ea.status ASC, ea.created_at ASC
      LIMIT ?`
  ).bind(...(status ? [event.id, auth.accountId, status] : [event.id, auth.accountId]), boundedLimit(args?.limit, 200, 500))
    .all<RsvpRow>();

  return {
    event: { id: event.id, slug: event.slug, title: event.title, event_date: event.event_date, ...seatsFor(event) },
    rsvps: results.map(r => ({
      attendee_id: r.id,
      name: r.full_name,
      status: r.status,
      access_tier: r.access_tier,
      customer_id: r.customer_id,
      seats_requested: Number(r.seats_requested),
      seats_held: Number(r.seats_held),
      waitlist_position: r.waitlist_position,
      // NULL attended is "the session has not happened / nobody marked it",
      // which is not the same fact as "did not turn up".
      attended: r.attended === null ? null : Number(r.attended) !== 0,
      shows_in_public_guest_list: Number(r.show_in_guest_list ?? 0) !== 0,
      requested_at: r.created_at,
    })),
    count: results.length,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Writes — event shape
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fields an event carries that are safe to set from a sentence. Deliberately
 * excludes `status` / `lifecycle_status` (set_event_lifecycle is the one door
 * for those, and it enforces the transition table), and the JSON columns —
 * session_flow, briefing_cards, mood_hints, venue_guide — which are structured
 * documents that voice cannot dictate and a half-written one is worse than none.
 */
const TEXT_FIELDS = [
  'title', 'subtitle', 'description', 'location_name', 'address_text',
  'map_link', 'guidelines_text', 'area_hint', 'playlist_url', 'flyer_image_url',
  'timezone', 'event_date', 'event_end_date',
] as const;
const COUNT_FIELDS = ['total_capacity', 'claim_window_minutes'] as const;
const FLAG_FIELDS = ['requires_approval'] as const;
const ENUM_FIELDS: Record<string, readonly string[]> = {
  public_visibility: ['public', 'unlisted', 'private'],
  gathering_type: ['private', 'public', 'invite_only'],
};

/** Columns a caller may blank on purpose. A cleared field is NULL, never ''. */
const CLEARABLE = new Set([
  'subtitle', 'description', 'location_name', 'address_text', 'map_link',
  'guidelines_text', 'area_hint', 'playlist_url', 'flyer_image_url', 'event_end_date',
]);

function readEventFields(args: any): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of TEXT_FIELDS) {
    const value = enteredText(args?.[key]);
    if (value === undefined) continue;
    // An empty string reaching a column is the shape that makes a title look
    // set and read as nothing. Blanking a field that may be blank is
    // `clear_fields`, said out loud; a field that may not be blank is simply
    // refused, and the message does not offer advice that would also fail.
    if (value === null) {
      throw new Error(CLEARABLE.has(key)
        ? `${key} cannot be blank — list it in clear_fields to remove it`
        : `${key} cannot be blank`);
    }
    fields[key] = value;
  }
  for (const key of COUNT_FIELDS) {
    const value = enteredCount(key, args?.[key]);
    if (value !== undefined) fields[key] = value;
  }
  for (const key of FLAG_FIELDS) {
    const value = enteredFlag(key, args?.[key]);
    if (value !== undefined) fields[key] = value ? 1 : 0;
  }
  for (const [key, allowed] of Object.entries(ENUM_FIELDS)) {
    const value = enteredText(args?.[key]);
    if (value === undefined || value === null) continue;
    if (!allowed.includes(value)) throw new Error(`${key} must be one of: ${allowed.join(', ')}`);
    fields[key] = value;
  }
  return fields;
}

const createEvent: ToolHandler = async (env, auth, args) => {
  const confirm = enteredText(args?.confirm);

  if (!confirm) {
    const slug = requiredText('slug', args?.slug, 120).toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new Error('slug must be lowercase letters, numbers and hyphens');
    }
    const fields = readEventFields(args);
    const title = requiredText('title', args?.title, 200);
    fields.title = title;
    if (!fields.event_date) throw new Error('event_date is required (ISO 8601, e.g. 2026-10-04T18:30:00.000Z)');
    // Present-and-zero is a session with no seats; absent is a session whose
    // size nobody stated. The HTTP door rejects both alike with
    // `!body.total_capacity`; here they are different answers.
    if (fields.total_capacity === undefined) throw new Error('total_capacity is required — say how many seats the session holds');

    // The only query in this file not scoped by account_id, and it has to be:
    // `events.slug` carries a GLOBAL unique index because the slug is the
    // public URL across the whole network. An account-scoped check would pass
    // and then the INSERT would fail on a constraint, which reads as a bug.
    const taken = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(slug).first();
    if (taken) return { error: 'slug_taken', message: `Another event already uses the slug "${slug}". Slugs are unique across every shop because they are public URLs.` };

    const token = await issueTicket(env, {
      kind: 'create_event', accountId: auth.accountId, userEmail: auth.userEmail, fields, slug, title,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'create_event',
      slug,
      title,
      // Created as a draft, always. Publishing is a separate sentence because
      // it is a separate decision: it puts a page on the public internet and
      // opens the door to RSVPs.
      lifecycle_status: 'draft',
      public_url_when_published: `/events/${slug}`,
      fields,
      capacity_note: Number(fields.total_capacity) === 0
        ? 'Capacity is zero, so no seat can be held on this event once published.'
        : undefined,
    }, token);
  }

  const pending = await consumeShared<EventMutation, 'create_event'>(env, confirm, 'create_event', auth);
  if (!pending) return expiredTicket;

  const columns = ['id', 'account_id', 'slug', 'status', 'lifecycle_status', ...Object.keys(pending.fields)];
  const values = [crypto.randomUUID(), pending.accountId, pending.slug, EVENT_STATUS_BY_LIFECYCLE.draft, 'draft',
    ...Object.values(pending.fields)];

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
      ).bind(...values),
      activityLog(env, 'event_created', `Created "${pending.title}" (${pending.slug}) via MCP`,
        pending.userEmail, 'event', String(values[0]), pending.accountId),
    ]);
  } catch (error) {
    // The global slug index is the one race this can lose between preview and
    // confirm, and it is worth naming rather than surfacing raw SQL.
    if (String(error).includes('UNIQUE') && String(error).includes('slug')) {
      return { error: 'slug_taken', message: `The slug "${pending.slug}" was claimed while this was being confirmed.` };
    }
    throw error;
  }

  return {
    committed: true, action: 'create_event',
    event_id: values[0], slug: pending.slug, title: pending.title, lifecycle_status: 'draft',
    next: 'It is a draft — nobody can see it or RSVP yet. Publish it with set_event_lifecycle.',
  };
};

const updateEvent: ToolHandler = async (env, auth, args) => {
  const confirm = enteredText(args?.confirm);
  const key = requiredText('event', args?.event_id ?? args?.slug);
  const current = await loadEvent(env, auth.accountId, key);
  if (!current) return { error: 'event_not_found' };

  if (!confirm) {
    const fields = readEventFields(args);

    const clear = Array.isArray(args?.clear_fields) ? args.clear_fields.map((f: unknown) => String(f)) : [];
    for (const field of clear) {
      if (!CLEARABLE.has(field)) throw new Error(`${field} cannot be cleared. Clearable: ${[...CLEARABLE].join(', ')}`);
      if (field in fields) throw new Error(`${field} is both set and cleared in the same call`);
      fields[field] = null;
    }

    if (Object.keys(fields).length === 0) throw new Error('Nothing to change — name at least one field, or list one in clear_fields');

    // Capacity below the seats already given out leaves an event oversubscribed
    // in silence: nobody is un-seated, the number just stops being true, and
    // the next reservation is refused for a reason that looks like a bug.
    if (typeof fields.total_capacity === 'number') {
      const held = Number(current.held_seats) + Number(current.offered_seats);
      if (fields.total_capacity < held) {
        return {
          error: 'capacity_below_held_seats',
          message: `${held} seats are already held. Set the capacity to ${held} or more, or move those RSVPs first.`,
          seats_held: held,
        };
      }
    }

    const token = await issueTicket(env, {
      kind: 'update_event', accountId: auth.accountId, userEmail: auth.userEmail,
      eventId: current.id, fields, title: current.title,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'update_event',
      event: { id: current.id, slug: current.slug, title: current.title, lifecycle_status: current.lifecycle_status },
      changes: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, {
        from: (current as unknown as Record<string, unknown>)[k] ?? null,
        to: v,
      }])),
      cleared: clear,
      visible_to_the_public: current.lifecycle_status === 'published'
        ? 'This event is published, so the change is live the moment it is confirmed.'
        : 'This event is not published, so nothing changes on the public site yet.',
    }, token);
  }

  const pending = await consumeShared<EventMutation, 'update_event'>(env, confirm, 'update_event', auth);
  if (!pending || pending.eventId !== current.id) return expiredTicket;

  const cols = Object.keys(pending.fields);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE events SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now')
        WHERE id = ? AND account_id = ?`
    ).bind(...cols.map(c => pending.fields[c] ?? null), pending.eventId, pending.accountId),
    activityLog(env, 'event_updated', `Updated "${pending.title}" via MCP: ${cols.join(', ')}`,
      pending.userEmail, 'event', pending.eventId, pending.accountId),
  ]);

  return { committed: true, action: 'update_event', event_id: pending.eventId, fields_changed: cols };
};

const setEventLifecycle: ToolHandler = async (env, auth, args) => {
  const confirm = enteredText(args?.confirm);
  const key = requiredText('event', args?.event_id ?? args?.slug);
  const current = await loadEvent(env, auth.accountId, key);
  if (!current) return { error: 'event_not_found' };

  if (!isEventLifecycle(current.lifecycle_status)) {
    return { error: 'unreadable_lifecycle', message: `This event's lifecycle_status is "${current.lifecycle_status}", which is not one of the six states. Fix it in the admin before moving it.` };
  }
  const from: EventLifecycle = current.lifecycle_status;
  const legal = EVENT_TRANSITIONS[from];

  if (!confirm) {
    const to = requiredText('to', args?.to, 40);
    if (!isEventLifecycle(to)) throw new Error(`to must be one of: ${EVENT_LIFECYCLE_VALUES.join(', ')}`);
    if (to === from) return { error: 'already_in_state', message: `This event is already ${from}.` };
    if (!legal.includes(to)) {
      // Naming the legal set matters more than the refusal: "unpublish" is the
      // move people reach for, and the honest answer is that the domain has no
      // such edge — a published session closes registration or is cancelled.
      return {
        error: 'illegal_transition',
        message: `An event that is ${from} can only become: ${legal.length ? legal.join(', ') : 'nothing — archived is the end of the line'}.`,
        from, requested: to, allowed: [...legal],
      };
    }

    const token = await issueTicket(env, {
      kind: 'set_event_lifecycle', accountId: auth.accountId, userEmail: auth.userEmail,
      eventId: current.id, from, to, title: current.title,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_event_lifecycle',
      event: { id: current.id, slug: current.slug, title: current.title, event_date: current.event_date },
      from, to,
      ...seatsFor(current),
      effect: to === 'published'
        ? `"${current.title}" goes live at /events/${current.slug} and starts accepting RSVPs.`
        : to === 'registration_closed'
          ? 'No new seats can be held. Everyone already confirmed keeps their seat.'
          : to === 'cancelled'
            ? `This calls off the session. ${Number(current.held_seats)} held seats stay on the record — tell those guests yourself; nothing here messages them.`
            : to === 'completed'
              ? 'Marks the session as done, which is what the recap and post-session tools read.'
              : 'Archives the event. It leaves the working lists and stays on the record.',
    }, token);
  }

  const pending = await consumeShared<EventMutation, 'set_event_lifecycle'>(env, confirm, 'set_event_lifecycle', auth);
  if (!pending || pending.eventId !== current.id) return expiredTicket;
  // The state may have moved between preview and confirm — a cron, the admin,
  // another session. The guarded UPDATE is what makes that a refusal instead of
  // a silent overwrite of somebody else's decision.
  const result = await env.DB.prepare(
    `UPDATE events SET lifecycle_status = ?, status = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND lifecycle_status = ?`
  ).bind(pending.to, EVENT_STATUS_BY_LIFECYCLE[pending.to], pending.eventId, pending.accountId, pending.from).run();

  if (Number(result.meta?.changes || 0) === 0) {
    return { error: 'state_conflict', message: `This event is no longer ${pending.from}. Read it again and retry.` };
  }

  await activityLog(env, `event_${pending.to}`, `"${pending.title}" moved ${pending.from} → ${pending.to} via MCP`,
    pending.userEmail, 'event', pending.eventId, pending.accountId).run();

  return {
    committed: true, action: 'set_event_lifecycle',
    event_id: pending.eventId, from: pending.from, to: pending.to,
    legacy_status: EVENT_STATUS_BY_LIFECYCLE[pending.to],
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Writes — the list
// ═══════════════════════════════════════════════════════════════════════════

const recordEventRsvp: ToolHandler = async (env, auth, args) => {
  const confirm = enteredText(args?.confirm);
  const key = requiredText('event', args?.event_id ?? args?.slug);
  const event = await loadEvent(env, auth.accountId, key);
  if (!event) return { error: 'event_not_found' };

  if (!confirm) {
    const fullName = requiredText('full_name', args?.full_name, 200);
    const phone = enteredText(args?.phone_number) ?? null;
    const email = enteredText(args?.email) ?? null;
    // One of the two, because a guest with neither cannot be told anything and
    // is invisible to the deduplication that stops a double booking.
    if (!phone && !email) throw new Error('phone_number or email is required — one of them is how this person is reached and how a duplicate RSVP is caught');

    const guestNames = Array.isArray(args?.guests)
      ? args.guests.map((g: unknown) => enteredText(g) ?? '').slice(0, 12)
      : [];
    const notes = enteredText(args?.notes) ?? null;

    // Absent means "whatever this event does", present means obey — the same
    // shape as a freight rate: NULL takes the level above, a value is a
    // decision. The operator entering an RSVP by hand IS the approval, so
    // passing false here is a legitimate override, not a bypass.
    const holdOverride = enteredFlag('hold_for_approval', args?.hold_for_approval);
    const holdForApproval = holdOverride ?? Number(event.requires_approval) !== 0;

    // Consent is given, not assumed: a name goes on the public guest list only
    // if someone said so. Absent is off.
    const showInGuestList = enteredFlag('show_in_guest_list', args?.show_in_guest_list) ?? false;

    if (event.lifecycle_status !== 'published') {
      return { error: 'event_not_published', message: `Seats can only be held on a published event; this one is ${event.lifecycle_status}. Publish it first with set_event_lifecycle.` };
    }

    // Same last-nine-digits match the public door uses. `UNIQUE(event_id,
    // phone_number)` would catch an exact repeat anyway, but only as a raw
    // constraint error from inside the seat batch; a number written once with
    // a country code and once without slips past exact matching entirely and
    // seats the same person twice.
    const phoneSuffix = phone ? phone.replace(/\D/g, '').slice(-9) : null;
    const existing = await env.DB.prepare(
      `SELECT ea.id, ea.full_name, ea.status FROM event_attendees ea
        JOIN events e ON e.id = ea.event_id
       WHERE ea.event_id = ? AND e.account_id = ?
         AND (
           (? IS NOT NULL AND ea.phone_number = ?)
           OR (? IS NOT NULL AND length(?) = 9 AND ea.phone_number LIKE ?)
           OR (? IS NOT NULL AND ea.email = ?)
         )`
    ).bind(
      event.id, auth.accountId,
      phone, phone,
      phoneSuffix, phoneSuffix, `%${phoneSuffix}`,
      email, email,
    ).first<{ id: string; full_name: string; status: string }>();
    if (existing) {
      return {
        error: 'already_on_the_list',
        message: `${existing.full_name} is already on this list as "${existing.status}".`,
        attendee_id: existing.id, status: existing.status,
      };
    }

    // Link to an existing customer if one matches, but never create one: that
    // is `customers:write` authority and this tool holds `sales:write`. The
    // admin's approve path creates the record when it needs to.
    let customerId: string | null = null;
    let accessTier = 'standard';
    let customer: { id: string; tags: string | null } | null = null;
    if (phone) {
      const suffix = phone.replace(/\D/g, '').slice(-9);
      customer = await env.DB.prepare(
        `SELECT id, tags FROM customers WHERE account_id = ?
           AND (phone = ? OR whatsapp = ? OR (length(?) = 9 AND (phone LIKE ? OR whatsapp LIKE ?)))`
      ).bind(auth.accountId, phone, phone, suffix, `%${suffix}`, `%${suffix}`).first<{ id: string; tags: string | null }>();
    }
    if (!customer && email) {
      customer = await env.DB.prepare(
        `SELECT id, tags FROM customers WHERE account_id = ? AND email = ?`
      ).bind(auth.accountId, email).first<{ id: string; tags: string | null }>();
    }
    if (customer) {
      customerId = customer.id;
      try {
        const tags = typeof customer.tags === 'string' ? JSON.parse(customer.tags) : customer.tags;
        if (Array.isArray(tags) && tags.some((t: string) => String(t).toLowerCase() === 'golden')) accessTier = 'golden';
      } catch { /* a malformed tags blob is not a reason to refuse a seat */ }
    }

    const seatsWanted = 1 + guestNames.length;
    const seats = seatsFor(event);
    if (!holdForApproval && typeof seats.seats_available === 'number' && seats.seats_available < seatsWanted) {
      return {
        error: 'capacity_conflict',
        message: `${seatsWanted} seats were asked for and ${seats.seats_available} are free. Nothing was written.`,
        seats_available: seats.seats_available,
      };
    }

    const token = await issueTicket(env, {
      kind: 'record_event_rsvp', accountId: auth.accountId, userEmail: auth.userEmail,
      eventId: event.id, eventTitle: event.title, attendeeId: crypto.randomUUID(),
      magicToken: crypto.randomUUID(), fullName, phone, email, customerId, accessTier,
      guestNames, holdForApproval, showInGuestList, notes,
    }, auth.tokenId);

    return previewEnvelope({
      action: 'record_event_rsvp',
      event: { id: event.id, title: event.title, event_date: event.event_date, ...seats },
      person: {
        name: fullName,
        // Echoed back on purpose, and only here: preview exists to catch the
        // digit that was misheard on the way in. No read tool in this module
        // returns a contact detail.
        phone_number: phone,
        email,
        matched_customer_id: customerId,
        access_tier: accessTier,
      },
      guests: guestNames,
      seats_requested: seatsWanted,
      resulting_status: holdForApproval ? 'requested' : 'confirmed',
      capacity_effect: holdForApproval
        ? 'A request holds no seat. Approve it with approve_event_rsvp to seat them.'
        : `Seats them straight away, leaving ${typeof seats.seats_available === 'number' ? seats.seats_available - seatsWanted : 'an unknown number of'} free.`,
      public_guest_list: showInGuestList ? 'Their name will show on the public guest list.' : 'Their name stays off the public guest list.',
    }, token);
  }

  const pending = await consumeShared<EventMutation, 'record_event_rsvp'>(env, confirm, 'record_event_rsvp', auth);
  if (!pending || pending.eventId !== event.id) return expiredTicket;

  const status = pending.holdForApproval ? 'requested' : 'confirmed';
  const seatState = pending.holdForApproval ? 'requested' : 'confirmed';
  // Guest requests are stored in the shape the public RSVP door writes, so the
  // admin's approve screen reads an MCP-taken RSVP exactly like a web one.
  const guestRequests = pending.guestNames.map(name => ({ nameHint: name || 'guest', contact: null, approved: null }));

  const reserved = await reservePartySeats(env, {
    accountId: pending.accountId,
    eventId: pending.eventId,
    participationId: pending.attendeeId,
    sourceState: 'requested',
    targetState: status as 'requested' | 'confirmed',
    seats: [
      { id: crypto.randomUUID(), fullName: pending.fullName, isPrimary: true, sourceState: null, targetState: seatState },
      ...guestRequests.map(g => ({
        id: crypto.randomUUID(), fullName: g.nameHint, isPrimary: false,
        sourceState: null as null, targetState: seatState as 'requested' | 'confirmed',
      })),
    ],
    createParticipation: {
      columns: ['customer_id', 'full_name', 'phone_number', 'email', 'access_tier', 'magic_token',
        'notes', 'guest_requests', 'contact_method', 'source', 'show_in_guest_list'],
      values: [
        pending.customerId, pending.fullName, pending.phone, pending.email, pending.accessTier,
        pending.magicToken, pending.notes,
        guestRequests.length ? JSON.stringify(guestRequests) : null,
        pending.phone ? 'whatsapp' : 'email',
        // `source` is how the shop later tells a self-service RSVP from one
        // Adrian took over a message and typed in himself.
        'mcp',
        pending.showInGuestList ? 1 : 0,
      ],
    },
  });
  if (!reserved.ok) return seatFailure(reserved);

  await activityLog(env, 'rsvp_requested',
    `${pending.fullName} added to "${pending.eventTitle}" via MCP as ${status}${pending.guestNames.length ? ` with ${pending.guestNames.length} guest(s)` : ''}`,
    pending.userEmail, 'event_attendee', pending.attendeeId, pending.accountId).run();

  return {
    committed: true, action: 'record_event_rsvp',
    attendee_id: pending.attendeeId, event_id: pending.eventId, name: pending.fullName,
    status,
    seats_taken: status === 'confirmed' ? 1 + pending.guestNames.length : 0,
    // The magic token is a bearer link to that person's RSVP page. It is
    // returned once, here, because it is the only way to hand them their
    // ticket, and it appears in no read tool.
    rsvp_link: `/m/${pending.magicToken}`,
  };
};

type PartySeatRow = { id: string; full_name: string | null; is_primary: number; seat_status: string };

const approveEventRsvp: ToolHandler = async (env, auth, args) => {
  const confirm = enteredText(args?.confirm);
  const attendeeId = requiredText('attendee_id', args?.attendee_id);

  const attendee = await env.DB.prepare(
    `SELECT ea.id, ea.account_id, ea.event_id, ea.full_name, ea.status, ea.guest_requests,
            e.title AS event_title
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
      WHERE ea.id = ? AND e.account_id = ?`
  ).bind(attendeeId, auth.accountId).first<{
    id: string; account_id: string | null; event_id: string; full_name: string;
    status: string; guest_requests: string | null; event_title: string;
  }>();
  if (!attendee) return { error: 'attendee_not_found' };

  // `event_attendees.account_id` is nullable and some legacy rows carry NULL.
  // reservePartySeats writes `WHERE ... account_id = ?`, so such a row would
  // come back as a bare state_conflict — true, and useless. Name it instead.
  if (!attendee.account_id) {
    return { error: 'attendee_missing_account_scope', message: 'This RSVP predates account scoping and has no shop on it. Approve it in the admin, which repairs the row.' };
  }
  if (attendee.status !== 'requested') {
    return { error: 'not_awaiting_approval', message: `This RSVP is "${attendee.status}". Only a request can be approved.`, status: attendee.status };
  }

  const party = await env.DB.prepare(
    `SELECT id, full_name, is_primary, seat_status FROM event_party_members
      WHERE participation_id = ? AND event_id = ? AND account_id = ?
      ORDER BY is_primary DESC, created_at ASC, id ASC`
  ).bind(attendee.id, attendee.event_id, attendee.account_id).all<PartySeatRow>();
  const primary = party.results.find(seat => Number(seat.is_primary) === 1);
  if (!primary) return { error: 'party_incomplete', message: 'This RSVP has no primary seat, so there is nothing to confirm. Repair it in the admin.' };

  let guestRequests: Array<{ nameHint?: string; contact?: string | null }> = [];
  if (attendee.guest_requests) { try { guestRequests = JSON.parse(attendee.guest_requests); } catch { /* ignore */ } }
  const requestedGuestSeats = party.results.filter(s => Number(s.is_primary) === 0 && s.seat_status === 'requested');

  if (!confirm) {
    // Zero approved guests is a real answer — "yes to her, no to the plus-one"
    // — so absent means zero here only because there is nothing else it could
    // mean, and the preview says the number out loud either way.
    const approvedGuests = enteredCount('approve_guests', args?.approve_guests) ?? 0;
    if (approvedGuests > requestedGuestSeats.length && approvedGuests > guestRequests.length) {
      return {
        error: 'more_guests_than_requested',
        message: `${attendee.full_name} asked for ${Math.max(requestedGuestSeats.length, guestRequests.length)} guest seats; ${approvedGuests} were approved.`,
        guests_requested: Math.max(requestedGuestSeats.length, guestRequests.length),
      };
    }

    const event = await loadEvent(env, auth.accountId, attendee.event_id);
    const seats = event ? seatsFor(event) : null;
    const token = await issueTicket(env, {
      kind: 'approve_event_rsvp', accountId: auth.accountId, userEmail: auth.userEmail,
      eventId: attendee.event_id, attendeeId: attendee.id, fullName: attendee.full_name, approvedGuests,
    }, auth.tokenId);

    return previewEnvelope({
      action: 'approve_event_rsvp',
      event: { id: attendee.event_id, title: attendee.event_title, ...(seats ?? {}) },
      person: { attendee_id: attendee.id, name: attendee.full_name },
      guests_requested: Math.max(requestedGuestSeats.length, guestRequests.length),
      guests_approved: approvedGuests,
      seats_taken: 1 + approvedGuests,
      effect: `Confirms ${attendee.full_name}. ${approvedGuests
        ? `${approvedGuests} guest seat(s) are held for invitation — the invite links are in the admin, not returned here.`
        : 'No guest seats are held.'} Nothing is sent to anyone; telling them is still yours to do.`,
    }, token);
  }

  const pending = await consumeShared<EventMutation, 'approve_event_rsvp'>(env, confirm, 'approve_event_rsvp', auth);
  if (!pending || pending.attendeeId !== attendee.id) return expiredTicket;

  // The same party shape the admin's approve route builds: the primary seat
  // moves to confirmed, each approved guest seat is HELD against an invitation
  // the guest later claims by name. Held, not confirmed, because the seat is
  // spoken for while the person in it is still unknown.
  const seats: PartySeatReservation[] = [{
    id: primary.id,
    fullName: primary.full_name || pending.fullName,
    isPrimary: true,
    sourceState: primary.seat_status as 'requested' | 'held' | 'confirmed',
    targetState: 'confirmed',
  }];
  for (let index = 0; index < pending.approvedGuests; index++) {
    const seat = requestedGuestSeats[index];
    const invitationId = crypto.randomUUID();
    seats.push({
      id: seat?.id || crypto.randomUUID(),
      fullName: guestRequests[index]?.nameHint || seat?.full_name || null,
      isPrimary: false,
      sourceState: (seat?.seat_status as 'requested' | 'held' | 'confirmed' | undefined) ?? null,
      targetState: 'held',
      invitationId,
      invitation: {
        token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        nameHint: guestRequests[index]?.nameHint || null,
        contact: guestRequests[index]?.contact || null,
      },
    });
  }

  const reservation: ReservePartySeatsInput = {
    accountId: pending.accountId,
    eventId: pending.eventId,
    participationId: pending.attendeeId,
    sourceState: 'requested',
    targetState: 'confirmed',
    seats,
  };
  const reserved = await reservePartySeats(env, reservation);
  if (!reserved.ok) return seatFailure(reserved);

  await activityLog(env, 'attendee_approved',
    `Approved ${pending.fullName}${pending.approvedGuests ? ` with ${pending.approvedGuests} guest seat(s)` : ''} via MCP`,
    pending.userEmail, 'event_attendee', pending.attendeeId, pending.accountId).run();

  return {
    committed: true, action: 'approve_event_rsvp',
    attendee_id: pending.attendeeId, event_id: pending.eventId,
    status: 'confirmed', guests_held: pending.approvedGuests, seats_taken: 1 + pending.approvedGuests,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Definitions
// ═══════════════════════════════════════════════════════════════════════════

const EVENT_REF = {
  event_id: { type: 'string', description: 'Event id from list_events. Either this or slug.' },
  slug: { type: 'string', description: 'Event slug, e.g. "autumn-shou-night". Either this or event_id.' },
};

const EDITABLE_PROPERTIES: Record<string, unknown> = {
  title: { type: 'string', description: 'The session name.' },
  subtitle: { type: 'string' },
  description: { type: 'string' },
  event_date: { type: 'string', description: 'ISO 8601 start, e.g. 2026-10-04T18:30:00.000Z.' },
  event_end_date: { type: 'string', description: 'ISO 8601 end. Optional.' },
  location_name: { type: 'string' },
  address_text: { type: 'string' },
  map_link: { type: 'string' },
  guidelines_text: { type: 'string' },
  area_hint: { type: 'string', description: 'Rough area shown before someone is confirmed, e.g. "Canggu".' },
  playlist_url: { type: 'string' },
  flyer_image_url: { type: 'string' },
  timezone: { type: 'string', description: 'IANA zone. Defaults to Asia/Taipei on a new event.' },
  total_capacity: { type: 'integer', minimum: 0, description: 'Seats the session holds. Zero means no seat can be held; leave it out entirely rather than passing 0 to mean "unset".' },
  claim_window_minutes: { type: 'integer', minimum: 0, description: 'Minutes a promoted waitlist guest has to claim their seat.' },
  requires_approval: { type: 'boolean', description: 'true (default) means a public RSVP arrives as a request holding no seat.' },
  public_visibility: { type: 'string', enum: ['public', 'unlisted', 'private'] },
  gathering_type: { type: 'string', enum: ['private', 'public', 'invite_only'] },
};

const defs: ToolDefinition[] = [
  {
    name: 'list_events',
    scope: 'inventory:read',
    description: 'Tea sessions for this shop, soonest first, with seats held and seats free. Drafts are included — a session two days out that was never published is the one most likely to need attention. Returns no guest names and no contact details.',
    inputSchema: {
      type: 'object',
      properties: {
        when: { type: 'string', enum: ['upcoming', 'past', 'all'], description: 'Default "upcoming".' },
        lifecycle_status: { type: 'string', enum: [...EVENT_LIFECYCLE_VALUES], description: 'Optional filter.' },
        limit: { type: 'integer', description: 'Default 20, max 100.' },
      },
    },
  },
  {
    name: 'get_event',
    scope: 'inventory:read',
    description: 'One session in full: when and where, capacity and seats free, how many requests are waiting, which lifecycle moves are legal from here, and the tea menu. Guest names are in list_event_rsvps; contact details are in get_customer.',
    inputSchema: { type: 'object', properties: { ...EVENT_REF } },
  },
  {
    name: 'list_event_rsvps',
    scope: 'inventory:read',
    description: "Who is on a session's list: names, status (confirmed / requested / waitlist / denied / cancelled), how many seats each party holds, waitlist position, and whether they turned up. Deliberately returns NO phone numbers or email addresses — use the customer_id with get_customer when you need to reach someone.",
    inputSchema: {
      type: 'object',
      properties: {
        ...EVENT_REF,
        status: { type: 'string', enum: ['confirmed', 'requested', 'waitlist', 'denied', 'cancelled'] },
        limit: { type: 'integer', description: 'Default 200, max 500.' },
      },
    },
  },
  {
    name: 'create_event',
    scope: 'catalog:write',
    description: 'Create a tea session. It is always created as a DRAFT — nobody can see it and no one can RSVP until set_event_lifecycle publishes it. slug, title, event_date and total_capacity are required; the slug is the public URL and is unique across every shop. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Public URL segment, lowercase with hyphens.' },
        ...EDITABLE_PROPERTIES,
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
      required: ['slug', 'title', 'event_date', 'total_capacity'],
    },
  },
  {
    name: 'update_event',
    scope: 'catalog:write',
    description: 'Change a session\'s details. Name only the fields you are changing; to blank an optional one, list it in clear_fields rather than passing an empty string. Capacity cannot be set below the seats already held. Status is not settable here — use set_event_lifecycle. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        ...EVENT_REF,
        ...EDITABLE_PROPERTIES,
        clear_fields: {
          type: 'array', items: { type: 'string' },
          description: `Optional fields to blank: ${[...CLEARABLE].join(', ')}.`,
        },
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
    },
  },
  {
    name: 'set_event_lifecycle',
    scope: 'catalog:write',
    description: 'Move a session through its lifecycle: draft → published → registration_closed → completed → archived, with cancelled reachable from draft, published or registration_closed. There is no unpublish — a live session closes registration or is cancelled. An illegal move is refused and the reply names the moves that are legal from where it is. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        ...EVENT_REF,
        to: { type: 'string', enum: [...EVENT_LIFECYCLE_VALUES], description: 'The state to move to.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
      required: ['to'],
    },
  },
  {
    name: 'record_event_rsvp',
    scope: 'sales:write',
    description: 'Put someone on a published session\'s list — for an RSVP that arrived by message rather than through the site. Needs a name and a phone number or email. By default it follows the event\'s own approval setting; pass hold_for_approval=false to seat them immediately, which is the usual case when you are entering it yourself. Seats are allocated atomically against capacity, so a full session refuses rather than oversells. Returns the guest\'s private RSVP link. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        ...EVENT_REF,
        full_name: { type: 'string' },
        phone_number: { type: 'string', description: 'One of phone_number or email is required.' },
        email: { type: 'string' },
        guests: { type: 'array', items: { type: 'string' }, description: 'Names of people coming with them. Each takes a seat.' },
        hold_for_approval: { type: 'boolean', description: "Omit to follow the event's requires_approval. false seats them now; true files it as a request that holds no seat." },
        show_in_guest_list: { type: 'boolean', description: 'Only true if they said their name may appear publicly. Default false.' },
        notes: { type: 'string' },
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'approve_event_rsvp',
    scope: 'sales:write',
    description: 'Confirm a seat request. The primary guest becomes confirmed; each approved guest seat is held against an invitation for them to pass on. Capacity is enforced atomically — an approval that would oversell is refused and nothing is written. Nobody is messaged; telling them is still yours to do. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        attendee_id: { type: 'string', description: 'From list_event_rsvps.' },
        approve_guests: { type: 'integer', minimum: 0, description: 'How many of their requested guest seats to grant. Default 0.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
      required: ['attendee_id'],
    },
  },
];

export const eventsToolModule: ToolModule = {
  area: 'events',
  defs,
  handlers: {
    list_events: listEvents,
    get_event: getEvent,
    list_event_rsvps: listEventRsvps,
    create_event: createEvent,
    update_event: updateEvent,
    set_event_lifecycle: setEventLifecycle,
    record_event_rsvp: recordEventRsvp,
    approve_event_rsvp: approveEventRsvp,
  },
};

export default eventsToolModule;
