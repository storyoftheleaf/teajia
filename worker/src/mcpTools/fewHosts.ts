/**
 * A few hosts over MCP (Launch 2, slice H12:
 * todo/plans/guests-and-tea-masters-launch-2-run.md, "Sonnet, H12").
 *
 * The same actions a host has on /account/host, so a host can say "Saturday
 * at four at my table", "who is coming on Saturday", "say yes to Mei" and
 * "add the 2015 shou to Saturday" to an agent.
 *
 *  - host_table (write): a new table, through createHostedTable (hostTable.ts).
 *  - list_my_tables (read): the host's own tables, newest first.
 *  - get_table_guests (read): names, status and the photograph wish. Never a
 *    phone, an email, an address, what a guest wrote, or the host's notes.
 *  - answer_guest (write): yes or no to a waiting guest. Yes takes the seats
 *    through the admin approval's own reservation and the guarded allocator
 *    (reservePartySeats), so a full table refuses at the moment of the write.
 *  - add_table_tea (write): a Teajia shop tea, a tea of the host's chest, or a
 *    plain name, saved through saveTableTeas (hostTableTeas.ts).
 *  - set_guest_note / get_guest_notes: the host's private guest book, through
 *    hostGuestNotes.ts only (this file never names its table).
 *  - set_host_approval (write): the platform owner approves or withdraws a
 *    host, through setHostApproval (hostApproval.ts).
 *
 * Two gates stand on every tool, as on every host route: Launch 2's switch
 * (src/lib/fewHosts.ts) and the caller's host approval. The token must be on
 * the caller's own personal account, where their tables live. Anything else
 * answers "not available". A table that is not the caller's own is "not
 * found", the same answer whether it belongs to another host or to a shop.
 *
 * Every write previews first and commits only on confirm, with the ticket
 * from tickets.ts. The confirm re-checks the gates, the table's ownership and
 * the guest's state, and lets the guarded writers decide seats, rather than
 * trusting what the preview saw.
 */
import { fewHostsOpen } from '../../../src/lib/fewHosts';
import { reservePartySeats } from '../eventDomain';
import { anyoneMayHost, hostDoorsFor, hostStanding, setHostApproval, type HostDoor } from '../hostApproval';
import { GUEST_NOTE_MAX, guestNotesFor, saveGuestNote } from '../hostGuestNotes';
import { createHostedTable } from '../hostTable';
import { offerFreedSeats } from '../waitingList';
import { anyoneHostsOpen } from '../../../src/lib/anyoneHosts';
import {
  hostTableGuests, ownHostedTable, sayNoToGuest, seatsTaken, seatsTakenSql, waitingGuest,
  type HostTableGuest, type OwnHostedTable,
} from '../hostTableGuests';
import {
  TABLE_TEA_FROM_MAX, TABLE_TEA_NAME_MAX, chestTeaSql, crossShopTeaSql, hostTableTeas, readTableTeas,
  saveTableTeas, searchTableTeas, type TableTeaMatch,
} from '../hostTableTeas';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET as expiredTicket, consumeTicket, issueTicket, previewEnvelope } from './tickets';

type Base = { accountId: string; userId: string; userEmail: string };
type FewHostsMutation =
  | (Base & {
      kind: 'host_table'; date: string; time: string; timezone: string; seats: number; door: HostDoor; name: string | null;
    })
  | (Base & { kind: 'answer_guest'; tableId: string; attendeeId: string; fullName: string; answer: 'yes' | 'no' })
  | (Base & {
      kind: 'add_table_tea'; tableId: string; source: 'shop' | 'chest' | 'name'; productId: string | null;
      name: string; from: string | null;
    })
  | (Base & { kind: 'set_guest_note'; tableId: string; attendeeId: string; note: string })
  | (Base & { kind: 'set_host_approval'; targetUserId: string; approved: boolean });

const NOT_AVAILABLE = {
  error: 'not_available',
  message: 'Hosting a table is not available to this account.',
} as const;
const TABLE_NOT_FOUND = { error: 'table_not_found' } as const;
const GUEST_NOT_FOUND = { error: 'guest_not_found' } as const;
const TABLE_NAME_MAX = 120;
const DEFAULT_SEATS = 6;

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const appOrigin = (env: ToolEnv) => (env.APP_URL || 'https://www.teajia.com').replace(/\/$/, '');

type Host = { userId: string; accountId: string; doors: HostDoor[] };

/**
 * The caller, as a host: Launch 2 is open, the token is on the caller's own
 * active personal account, and they may host (hostDoorsFor: Adrian approved
 * them, or Launch 3 lets anyone host by request; never once stopped). Null otherwise.
 * Run on every call, previews and confirms alike.
 */
async function hostOf(env: ToolEnv, auth: ToolAuth): Promise<Host | null> {
  if (!fewHostsOpen(env)) return null;
  const own = await env.DB.prepare(
    `SELECT id FROM accounts WHERE id = ? AND personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id
       AND status = 'active'`,
  ).bind(auth.accountId, auth.userId).first<{ id: string }>();
  if (!own) return null;
  const doors = hostDoorsFor(await hostStanding(env.DB, auth.userId), anyoneMayHost(env));
  return doors ? { userId: auth.userId, accountId: own.id, doors } : null;
}

/** One of the host's own tables, in the token's account, or null. */
async function tableOf(env: ToolEnv, host: Host, tableId: unknown): Promise<OwnHostedTable | null> {
  const id = text(tableId);
  if (!id) return null;
  const table = await ownHostedTable(env.DB, { hostUserId: host.userId, eventId: id });
  return table && table.account_id === host.accountId ? table : null;
}

const tableSummary = (table: OwnHostedTable) =>
  ({ id: table.id, title: table.title, event_date: table.event_date, timezone: table.timezone });

/** What a guest is to an agent: no phone, no email, no address, no words of theirs or the host's. */
const guestView = (guest: HostTableGuest) => ({
  attendee_id: guest.id,
  name: guest.full_name,
  status: guest.status,
  party_guests: Number(guest.plus_one ?? 0),
  came: guest.attended == null ? null : Boolean(guest.attended),
  asked_at: guest.created_at,
  no_photographs: guest.no_photographs,
});

/** A guest by id, or by name among the guests whose status is one of `statuses`. */
async function guestOf(env: ToolEnv, table: OwnHostedTable, args: { attendee_id?: unknown; guest_name?: unknown }, statuses: string[]) {
  const guests = await hostTableGuests(env.DB, table);
  const id = text(args?.attendee_id);
  if (id) {
    const guest = guests.find(row => row.id === id);
    return guest ? { guest } : { error: GUEST_NOT_FOUND };
  }
  const name = text(args?.guest_name)?.toLowerCase();
  if (!name) throw new Error('attendee_id or guest_name is required');
  const pool = guests.filter(row => statuses.includes(row.status));
  const exact = pool.filter(row => row.full_name.trim().toLowerCase() === name);
  const matches = exact.length ? exact
    : pool.filter(row => row.full_name.trim().toLowerCase().split(/\s+/).includes(name));
  if (matches.length === 1) return { guest: matches[0] };
  if (!matches.length) return { error: GUEST_NOT_FOUND };
  return {
    error: {
      error: 'guest_ambiguous',
      message: 'More than one guest has that name. Pass attendee_id.',
      guests: matches.map(guestView),
    },
  };
}

// ── host_table ──────────────────────────────────────────────────────────────

function validZone(zone: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; }
}

function spokenWhen(date: string, time: string, timezone: string) {
  const day = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
  return `${day} at ${time} (${timezone})`;
}

const hostTable: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);

  if (!confirm) {
    const date = text(args?.date) ?? '';
    const time = text(args?.time) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      return { error: 'hosted_table_date', message: 'Give the day as a date, YYYY-MM-DD.' };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return { error: 'hosted_table_time', message: 'Give the time as hours and minutes, HH:MM on a 24 hour clock.' };
    }
    // The host's zone, or the zone of their last table when they did not say.
    let timezone = text(args?.timezone);
    if (!timezone) {
      const last = await env.DB.prepare(
        `SELECT timezone FROM events WHERE account_id = ? AND host_user_id = ? AND timezone IS NOT NULL
          ORDER BY created_at DESC LIMIT 1`,
      ).bind(host.accountId, host.userId).first<{ timezone: string }>();
      timezone = last?.timezone ?? null;
    }
    if (!timezone || !validZone(timezone)) {
      return { error: 'hosted_table_timezone', message: 'Give the time zone the table is in, for example Asia/Taipei.' };
    }
    const seats = args?.seats === undefined || args?.seats === null ? DEFAULT_SEATS : args.seats;
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1 || seats > 40) {
      return { error: 'hosted_table_seats', message: 'Seats are a whole number from 1 to 40.' };
    }
    const door = args?.door ?? 'request';
    if (door !== 'request' && door !== 'link') {
      return { error: 'hosted_table_door', message: 'A table opens by request or by link.' };
    }
    if (!host.doors.includes(door)) {
      return { error: 'hosted_table_door_needs_approval', message: 'A table by link opens once Teajia has approved you as a host.' };
    }
    if (args?.name !== undefined && args?.name !== null && typeof args.name !== 'string') {
      return { error: 'hosted_table_name', message: 'Give the table\'s name as words.' };
    }
    const name = text(args?.name);
    if (name && name.length > TABLE_NAME_MAX) {
      return { error: 'hosted_table_name', message: `Keep the table's name under ${TABLE_NAME_MAX} characters.` };
    }
    const token = await issueTicket<FewHostsMutation>(env, {
      kind: 'host_table', accountId: auth.accountId, userId: auth.userId, userEmail: auth.userEmail,
      date, time, timezone, seats, door, name,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'host_table',
      when: spokenWhen(date, time, timezone),
      seats,
      door: door === 'link' ? 'by link: a guest with the link takes a seat with a name' : 'by request: you say yes to each guest',
      name: name ?? 'named for the day and your first name',
      effect: 'Makes a new table and gives you its link. Nothing is sent to anyone.',
    }, token);
  }

  const pending = await consumeTicket<FewHostsMutation, 'host_table'>(env, confirm, 'host_table', auth);
  if (!pending || pending.userId !== auth.userId) return expiredTicket;
  if (!host.doors.includes(pending.door)) return NOT_AVAILABLE;
  const person = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(host.userId).first<{ name: string | null }>();
  const table = await createHostedTable(env.DB, {
    accountId: host.accountId, hostUserId: host.userId, hostName: person?.name ?? '',
    date: pending.date, time: pending.time, timezone: pending.timezone,
    seats: pending.seats, door: pending.door, name: pending.name, appOrigin: appOrigin(env),
  });
  if ('refused' in table) return { error: table.refused.code, message: table.refused.error };
  return { committed: true, action: 'host_table', table_id: table.id, link: table.link };
};

// ── list_my_tables ──────────────────────────────────────────────────────────

const listMyTables: ToolHandler = async (env, auth) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const { results } = await env.DB.prepare(`
    SELECT e.id, e.slug, e.title, e.event_date, e.timezone, e.door, e.total_capacity AS seats, e.lifecycle_status,
           ${seatsTakenSql('e')} AS seats_taken,
           (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id AND ea.account_id = e.account_id AND ea.status = 'confirmed') AS confirmed,
           (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id AND ea.account_id = e.account_id AND ea.status = 'requested') AS waiting
      FROM events e
     WHERE e.account_id = ? AND e.host_user_id = ?
     ORDER BY e.event_date DESC, e.created_at DESC
     LIMIT 100
  `).bind(host.accountId, host.userId).all<Record<string, unknown>>();
  const origin = appOrigin(env);
  return {
    tables: results.map(row => ({
      id: row.id, title: row.title, event_date: row.event_date, timezone: row.timezone, door: row.door,
      seats: row.seats, seats_taken: Number(row.seats_taken ?? 0), lifecycle_status: row.lifecycle_status,
      guests: { confirmed: Number(row.confirmed ?? 0), waiting: Number(row.waiting ?? 0) },
      link: `${origin}/event/${row.slug}`,
    })),
    count: results.length,
  };
};

// ── get_table_guests ────────────────────────────────────────────────────────

const getTableGuests: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const table = await tableOf(env, host, args?.table_id);
  if (!table) return TABLE_NOT_FOUND;
  const [guests, taken] = await Promise.all([hostTableGuests(env.DB, table), seatsTaken(env.DB, table)]);
  return {
    table: { ...tableSummary(table), seats: table.total_capacity, seats_taken: taken },
    guests: guests.map(guestView),
  };
};

// ── answer_guest ────────────────────────────────────────────────────────────

const answerGuest: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);

  if (!confirm) {
    const answer = args?.answer;
    if (answer !== 'yes' && answer !== 'no') throw new Error('answer must be "yes" or "no"');
    const table = await tableOf(env, host, args?.table_id);
    if (!table) return TABLE_NOT_FOUND;
    const found = await guestOf(env, table, args, ['requested', 'waitlist']);
    if ('error' in found) return found.error;
    const guest = found.guest;
    if (answer === 'yes' && guest.status !== 'requested') {
      return { error: 'state_conflict', message: `${guest.full_name} is not waiting for your yes.`, status: guest.status };
    }
    if (answer === 'no' && guest.status !== 'requested' && guest.status !== 'waitlist') {
      return { error: 'state_conflict', message: `${guest.full_name} is not waiting for your answer.`, status: guest.status };
    }
    const waiting = await waitingGuest(env.DB, table, guest.id);
    if (!waiting) return GUEST_NOT_FOUND;
    const taken = await seatsTaken(env.DB, table);
    const party = 1 + (Number(waiting.requested_guests) || 0);
    if (answer === 'yes' && taken + party > table.total_capacity) {
      return { error: 'capacity_conflict', message: 'The table is full. Add a seat first, or say no.' };
    }
    const token = await issueTicket<FewHostsMutation>(env, {
      kind: 'answer_guest', accountId: auth.accountId, userId: auth.userId, userEmail: auth.userEmail,
      tableId: table.id, attendeeId: guest.id, fullName: guest.full_name, answer,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'answer_guest',
      table: tableSummary(table),
      guest: guest.full_name,
      answer,
      seats: { taken, total: table.total_capacity, this_answer_takes: answer === 'yes' ? party : 0 },
      effect: answer === 'yes'
        ? `${guest.full_name} gets a seat at "${table.title}" and can now see the way to the house.`
        : `${guest.full_name} is told there is no seat this time.`,
    }, token);
  }

  const pending = await consumeTicket<FewHostsMutation, 'answer_guest'>(env, confirm, 'answer_guest', auth);
  if (!pending || pending.userId !== auth.userId) return expiredTicket;
  // Ownership and the guest's state are read again: the preview proved nothing that lasts.
  const table = await tableOf(env, host, pending.tableId);
  if (!table) return TABLE_NOT_FOUND;
  const attendee = await waitingGuest(env.DB, table, pending.attendeeId);
  if (!attendee) return GUEST_NOT_FOUND;

  if (pending.answer === 'no') {
    if (!(await sayNoToGuest(env.DB, table, attendee.id))) {
      return { error: 'state_conflict', message: 'This guest is no longer waiting for your answer. Nothing was written.' };
    }
    await activity(env, 'attendee_denied', `Host said no to ${attendee.full_name} via MCP`, pending, attendee.id, table.account_id);
    // Main's no offered nothing, so while Launch 3 is closed neither does this.
    if (anyoneHostsOpen(env)) await offerFreedSeats(env.DB, { eventId: table.id, accountId: table.account_id });
    return { committed: true, action: 'answer_guest', attendee_id: attendee.id, status: 'denied' };
  }

  if (attendee.status !== 'requested') {
    return { error: 'state_conflict', message: 'This guest is no longer waiting for your yes. Nothing was written.' };
  }
  if (!env.hostSeats) return NOT_AVAILABLE;
  const reservation = await env.hostSeats.reservationFor(attendee, Number(attendee.requested_guests) || 0);
  if (!reservation) {
    return { error: 'state_conflict', message: 'This guest\'s request is incomplete. Ask them to take a seat again.' };
  }
  const reserved = await reservePartySeats(env, reservation);
  if (!reserved.ok) {
    if (reserved.code === 'capacity_conflict') {
      return { error: 'capacity_conflict', message: 'The table is full. Nothing was written. Add a seat first, or say no.' };
    }
    if (reserved.code === 'event_not_reservable') {
      return { error: 'event_not_reservable', message: 'This table is no longer taking guests. Nothing was written.' };
    }
    return { error: 'state_conflict', message: 'This guest\'s seat changed while you were looking. Nothing was written.' };
  }
  await activity(env, 'attendee_approved', `Host said yes to ${attendee.full_name} via MCP`, pending, attendee.id, table.account_id);
  return { committed: true, action: 'answer_guest', attendee_id: attendee.id, status: 'confirmed' };
};

async function activity(env: ToolEnv, action: string, details: string, who: Base, attendeeId: string, accountId: string) {
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, 'event_attendee', ?, ?)`,
  ).bind(crypto.randomUUID(), action, details, who.userEmail, attendeeId, accountId).run();
}

// ── add_table_tea ───────────────────────────────────────────────────────────

type ResolvedTea = { source: 'shop' | 'chest'; id: string; name: string };

/** A shop tea any table may point at, or a tea of the table's own chest. Null for anything else. */
async function teaById(env: ToolEnv, table: OwnHostedTable, productId: string): Promise<ResolvedTea | null> {
  const name = (p: string) => `COALESCE(NULLIF(trim(${p}.given_name), ''), NULLIF(trim(${p}.product_name), ''))`;
  const shop = await env.DB.prepare(
    `SELECT p.id, ${name('p')} AS name FROM products p WHERE p.id = ? AND p.account_id <> ? AND ${crossShopTeaSql('p')}`,
  ).bind(productId, table.account_id).first<{ id: string; name: string | null }>();
  if (shop?.name) return { source: 'shop', id: shop.id, name: shop.name };
  const chest = await env.DB.prepare(
    `SELECT p.id, ${name('p')} AS name FROM products p WHERE p.id = ? AND p.account_id = ? AND ${chestTeaSql('p')}`,
  ).bind(productId, table.account_id).first<{ id: string; name: string | null }>();
  return chest?.name ? { source: 'chest', id: chest.id, name: chest.name } : null;
}

const matchView = (match: TableTeaMatch) =>
  ({ product_id: match.id, source: match.source, name: match.name, type: match.type, year: match.year });

const addTableTea: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);

  if (!confirm) {
    const table = await tableOf(env, host, args?.table_id);
    if (!table) return TABLE_NOT_FOUND;
    const from = text(args?.from);
    if (from && from.length > TABLE_TEA_FROM_MAX) {
      return { error: 'table_teas_invalid', message: `Keep "where it is from" under ${TABLE_TEA_FROM_MAX} characters.` };
    }
    let tea: { source: 'shop' | 'chest' | 'name'; productId: string | null; name: string };
    const productId = text(args?.product_id);
    if (productId) {
      const found = await teaById(env, table, productId);
      if (!found) {
        return {
          error: 'tea_not_found',
          message: 'That is not a tea of Teajia\'s shop or of your Tea Chest. Give the tea\'s name instead.',
        };
      }
      tea = { source: found.source, productId: found.id, name: found.name };
    } else {
      const name = text(args?.name);
      if (!name) throw new Error('product_id or name is required');
      if (name.length > TABLE_TEA_NAME_MAX) {
        return { error: 'table_teas_invalid', message: `Keep a tea's name under ${TABLE_TEA_NAME_MAX} characters.` };
      }
      const matches = args?.as_typed === true ? [] : await searchTableTeas(env.DB, table, name);
      if (matches.length > 1) {
        return {
          error: 'choose_tea',
          message: 'Several teas match. Pass product_id for one of them, or as_typed true to keep the words as a plain name.',
          matches: matches.map(matchView),
        };
      }
      tea = matches.length === 1
        ? { source: matches[0].source, productId: matches[0].id, name: matches[0].name }
        : { source: 'name', productId: null, name };
    }
    const current = await hostTableTeas(env.DB, table);
    const token = await issueTicket<FewHostsMutation>(env, {
      kind: 'add_table_tea', accountId: auth.accountId, userId: auth.userId, userEmail: auth.userEmail,
      tableId: table.id, source: tea.source, productId: tea.productId, name: tea.name, from,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'add_table_tea',
      table: tableSummary(table),
      tea: tea.name,
      kind: tea.source === 'shop' ? 'a tea of Teajia\'s shop, linked to its page'
        : tea.source === 'chest' ? 'a tea of your Tea Chest' : 'a plain name',
      ...(from ? { from } : {}),
      position: current.length + 1,
      teas_now: current.map(row => row.name),
      ...(tea.source !== 'name' && args?.product_id === undefined
        ? { note: 'Matched by name. Call again with as_typed true to keep the words as a plain name instead.' } : {}),
    }, token);
  }

  const pending = await consumeTicket<FewHostsMutation, 'add_table_tea'>(env, confirm, 'add_table_tea', auth);
  if (!pending || pending.userId !== auth.userId) return expiredTicket;
  const table = await tableOf(env, host, pending.tableId);
  if (!table) return TABLE_NOT_FOUND;
  // The list as it is now, with the new tea last. saveTableTeas decides again
  // whether a shop or chest tea may still be linked; one that may not stays its name.
  const current = await hostTableTeas(env.DB, table);
  const teas = readTableTeas(table, {
    teas: [
      ...current.map(row => ({ id: row.id, source: row.source, product_id: row.product_id, name: row.name, from: row.from, photo_url: row.photo_url })),
      { source: pending.source, product_id: pending.productId, name: pending.name, from: pending.from },
    ],
  });
  if ('refused' in teas) return { error: teas.refused.code, message: teas.refused.error };
  const saved = await saveTableTeas(env.DB, table, teas);
  if ('refused' in saved) return { error: saved.refused.code, message: saved.refused.error };
  const added = saved.teas[saved.teas.length - 1];
  return {
    committed: true, action: 'add_table_tea', table_id: table.id,
    tea: added ? { id: added.id, name: added.name, source: added.source } : null,
    ...(added && pending.source !== 'name' && added.source === 'name'
      ? { note: 'That tea can no longer be linked, so it was kept as its name.' } : {}),
    teas: saved.teas.map(row => row.name),
  };
};

// ── the host's private guest book ───────────────────────────────────────────

const setGuestNote: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);

  if (!confirm) {
    const table = await tableOf(env, host, args?.table_id);
    if (!table) return TABLE_NOT_FOUND;
    if (args?.note !== null && args?.note !== undefined && typeof args.note !== 'string') {
      return { error: 'guest_note_invalid', message: 'Write the note as words.' };
    }
    if (args?.note === undefined) throw new Error('note is required: the words, or an empty string to clear it');
    const note = (args.note ?? '').trim();
    if (note.length > GUEST_NOTE_MAX) {
      return { error: 'guest_note_too_long', message: `Keep the note to ${GUEST_NOTE_MAX} characters.` };
    }
    const found = await guestOf(env, table, args, ['confirmed', 'requested', 'waitlist', 'cancelled', 'denied']);
    if ('error' in found) return found.error;
    const book = await guestNotesFor(env.DB, { hostUserId: host.userId, accountId: table.account_id, eventId: table.id });
    const existing = 'notes' in book ? book.notes.find(row => row.attendee_id === found.guest.id)?.note ?? null : null;
    const token = await issueTicket<FewHostsMutation>(env, {
      kind: 'set_guest_note', accountId: auth.accountId, userId: auth.userId, userEmail: auth.userEmail,
      tableId: table.id, attendeeId: found.guest.id, note,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_guest_note',
      table: tableSummary(table),
      guest: found.guest.full_name,
      note: note || 'no note',
      replaces: existing ?? 'no note',
      effect: 'Kept in your own guest book. Nobody else ever reads it, the guest included.',
    }, token);
  }

  const pending = await consumeTicket<FewHostsMutation, 'set_guest_note'>(env, confirm, 'set_guest_note', auth);
  if (!pending || pending.userId !== auth.userId) return expiredTicket;
  const table = await tableOf(env, host, pending.tableId);
  if (!table) return TABLE_NOT_FOUND;
  const saved = await saveGuestNote(env.DB, {
    hostUserId: host.userId, accountId: table.account_id, eventId: table.id, attendeeId: pending.attendeeId, note: pending.note,
  });
  if ('notFound' in saved) return GUEST_NOT_FOUND;
  if ('refused' in saved) return { error: saved.refused.code, message: saved.refused.error };
  return { committed: true, action: 'set_guest_note', attendee_id: pending.attendeeId, note: saved.note?.note ?? null };
};

const getGuestNotes: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const table = await tableOf(env, host, args?.table_id);
  if (!table) return TABLE_NOT_FOUND;
  const [book, guests] = await Promise.all([
    guestNotesFor(env.DB, { hostUserId: host.userId, accountId: table.account_id, eventId: table.id }),
    hostTableGuests(env.DB, table),
  ]);
  if ('notFound' in book) return TABLE_NOT_FOUND;
  const names = new Map(guests.map(guest => [guest.id, guest.full_name]));
  return {
    table: tableSummary(table),
    notes: book.notes.map(row => ({ attendee_id: row.attendee_id, name: names.get(row.attendee_id) ?? null, note: row.note, updated_at: row.updated_at })),
  };
};

// ── set_host_approval (the platform owner only) ─────────────────────────────

type Person = { id: string; name: string | null; email: string | null; host_approved_at: string | null };

async function personOf(env: ToolEnv, args: { user_id?: unknown; email?: unknown }): Promise<Person | null> {
  const id = text(args?.user_id);
  const email = text(args?.email);
  if (!id && !email) throw new Error('user_id or email is required');
  return env.DB.prepare(
    `SELECT id, name, email, host_approved_at FROM users WHERE ${id ? 'id = ?' : 'lower(email) = lower(?)'}`,
  ).bind(id ?? email).first<Person>();
}

const setHostApprovalTool: ToolHandler = async (env, auth, args) => {
  if (!fewHostsOpen(env) || auth.creatorTier !== 'platform_owner') return NOT_AVAILABLE;
  const confirm = text(args?.confirm);

  if (!confirm) {
    if (typeof args?.approved !== 'boolean') throw new Error('approved must be true or false');
    const person = await personOf(env, args);
    if (!person) return { error: 'user_not_found' };
    const token = await issueTicket<FewHostsMutation>(env, {
      kind: 'set_host_approval', accountId: auth.accountId, userId: auth.userId, userEmail: auth.userEmail,
      targetUserId: person.id, approved: args.approved,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_host_approval',
      person: { id: person.id, name: person.name, email: person.email },
      approved_now: Boolean(person.host_approved_at),
      approved: args.approved,
      effect: args.approved
        ? `${person.name || person.email || 'This person'} may host their own table, by request or by link.`
        : `${person.name || person.email || 'This person'} may no longer host. Their tables stop opening by link at once; their guests and notes stay as they are.`,
    }, token);
  }

  const pending = await consumeTicket<FewHostsMutation, 'set_host_approval'>(env, confirm, 'set_host_approval', auth);
  if (!pending || pending.userId !== auth.userId) return expiredTicket;
  const result = await setHostApproval(env.DB, pending.targetUserId, pending.approved, auth.userId);
  if (!result) return { error: 'user_not_found' };
  try {
    await env.DB.prepare(
      `INSERT INTO platform_audit_log (action, actor_id, actor_email, target_type, target_id, details, account_id, actor_account_id)
       VALUES ('host.approval_changed', ?, ?, 'user', ?, ?, NULL, ?)`,
    ).bind(auth.userId, auth.userEmail, pending.targetUserId, JSON.stringify({ approved: pending.approved, via: 'mcp' }), auth.accountId).run();
  } catch { /* the audit line never fails the change, as logPlatformAction */ }
  return { committed: true, action: 'set_host_approval', user_id: pending.targetUserId, may_host: pending.approved };
};

// ── definitions ─────────────────────────────────────────────────────────────

const tableId = { type: 'string', description: 'A table id from list_my_tables.' };
const confirmArg = { type: 'string', description: 'Confirmation token from the preview.' };
const guestArgs = {
  attendee_id: { type: 'string', description: 'A guest id from get_table_guests.' },
  guest_name: { type: 'string', description: 'The guest\'s name, when no attendee_id is given. Two guests with that name are refused.' },
};
const HOSTS_ONLY = 'For a host Teajia has approved, with a token on their own Tea Chest account; anyone else is told it is not available.';

const defs: ToolDefinition[] = [
  {
    name: 'host_table',
    scope: 'catalog:write',
    description: `Make a new table of your own: a day and a time, and optionally seats (default 6), a door and a name. Returns the table's link to give your guests. ${HOSTS_ONLY} Two-step preview/confirm.`,
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The day, YYYY-MM-DD. Today or later.' },
        time: { type: 'string', description: 'The time, HH:MM on a 24 hour clock.' },
        timezone: { type: 'string', description: 'The IANA time zone the table is in, for example Asia/Taipei. Defaults to the zone of your last table.' },
        seats: { type: 'integer', minimum: 1, maximum: 40 },
        door: { type: 'string', enum: ['request', 'link'], description: 'request: you say yes to each guest (default). link: a guest with the link takes a seat with a name.' },
        name: { type: 'string', description: 'What to call the table. Defaults to the weekday and your first name.' },
        confirm: confirmArg,
      },
      required: ['date', 'time'],
    },
  },
  {
    name: 'list_my_tables',
    scope: 'inventory:read',
    description: `Your own tables, newest first: day, door, seats taken, how many guests are confirmed or waiting, and the link. ${HOSTS_ONLY} Read only.`,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_table_guests',
    scope: 'customers:read',
    description: `Who is coming to one of your tables: each guest's name, status (confirmed, requested, waitlist, cancelled, denied), the guests they bring, whether they came, and whether they asked not to be photographed. Never a phone, an email, an address or a note. ${HOSTS_ONLY} Read only.`,
    inputSchema: { type: 'object', properties: { table_id: tableId }, required: ['table_id'] },
  },
  {
    name: 'answer_guest',
    scope: 'sales:write',
    description: `Say yes or no to a guest waiting for a seat at one of your tables. A yes takes the seats then and is refused when the table is full; only then does the guest see the way to the house. ${HOSTS_ONLY} Two-step preview/confirm.`,
    inputSchema: {
      type: 'object',
      properties: { table_id: tableId, ...guestArgs, answer: { type: 'string', enum: ['yes', 'no'] }, confirm: confirmArg },
      required: ['table_id'],
    },
  },
  {
    name: 'add_table_tea',
    scope: 'catalog:write',
    description: `Add a tea to one of your tables, poured last. Give product_id for a tea of Teajia's shop or your Tea Chest, or a name: a name that matches one tea links to it, several matches are listed to choose from, and as_typed true keeps the words as a plain name. No price is ever shown. ${HOSTS_ONLY} Two-step preview/confirm.`,
    inputSchema: {
      type: 'object',
      properties: {
        table_id: tableId,
        product_id: { type: 'string', description: 'A tea of Teajia\'s shop or of your Tea Chest.' },
        name: { type: 'string', description: 'The tea\'s name, searched in Teajia\'s shop and your Tea Chest first.' },
        as_typed: { type: 'boolean', description: 'Keep the name as typed, without looking for a match.' },
        from: { type: 'string', description: 'Where it is from, in your words.' },
        confirm: confirmArg,
      },
      required: ['table_id'],
    },
  },
  {
    name: 'set_guest_note',
    scope: 'customers:write',
    description: `Keep one private line about a guest of one of your tables, or clear it with an empty note. Read by you alone, never by the guest or anyone else. ${HOSTS_ONLY} Two-step preview/confirm.`,
    inputSchema: {
      type: 'object',
      properties: { table_id: tableId, ...guestArgs, note: { type: 'string', maxLength: GUEST_NOTE_MAX }, confirm: confirmArg },
      required: ['table_id'],
    },
  },
  {
    name: 'get_guest_notes',
    scope: 'customers:read',
    description: `The private lines you keep about the guests of one of your tables. ${HOSTS_ONLY} Read only.`,
    inputSchema: { type: 'object', properties: { table_id: tableId }, required: ['table_id'] },
  },
  {
    name: 'set_host_approval',
    scope: 'admin:write',
    description: 'Approve a person to host their own table, or withdraw it. For the platform owner only. Withdrawing stops their tables opening by link at once; their guests and notes stay. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        email: { type: 'string', description: 'The person\'s email, when no user_id is given.' },
        approved: { type: 'boolean' },
        confirm: confirmArg,
      },
    },
  },
];

export const fewHostsToolModule: ToolModule = {
  area: 'few_hosts',
  defs,
  handlers: {
    host_table: hostTable,
    list_my_tables: listMyTables,
    get_table_guests: getTableGuests,
    answer_guest: answerGuest,
    add_table_tea: addTableTea,
    set_guest_note: setGuestNote,
    get_guest_notes: getGuestNotes,
    set_host_approval: setHostApprovalTool,
  },
};

export default fewHostsToolModule;
