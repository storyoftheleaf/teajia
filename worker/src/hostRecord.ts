// The host's record (Launch 2, slice H11:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Free, and your record
// is yours"). Adrian, 2026-11-26: "Free to host, and your record is yours."
//
// One JSON file, made for the signed-in host and for nobody else: their own
// tables (the sessions in their own personal account that name them as host),
// the names their guests gave, the teas poured, and the host's own private
// guest-book lines (read through hostGuestNotes.ts, the one module that may
// name that table). Never a zip.
//
// What is never in it: another host's tables, a shop's sessions, a guest's
// phone number or email, a guest's private page link, what a guest wrote when
// asking for a seat, and any address or way to a house. A guest's name is
// what the guest typed; nothing else about them leaves.

import { guestNotesFor } from './hostGuestNotes';
import { hostTableTeas } from './hostTableTeas';

export const HOST_RECORD_KIND = 'teajia-host-record';
export const HOST_RECORD_VERSION = 1;

export type HostRecordGuest = {
  name: string;
  status: string;
  came: boolean | null;
  /** Whether the guest asked to bring one more, and the name they gave for them. */
  plus_one: boolean;
  plus_one_name: string | null;
  /** The host's own private line about this guest, or null. */
  my_note: string | null;
};

export type HostRecordTea = { name: string; from: string | null; pour_order: number | null; photo_url: string | null };

export type HostRecordTable = {
  title: string;
  date: string;
  timezone: string | null;
  door: string | null;
  seats: number;
  status: string;
  link: string;
  guests: HostRecordGuest[];
  teas: HostRecordTea[];
};

export type HostRecord = {
  kind: typeof HOST_RECORD_KIND;
  version: typeof HOST_RECORD_VERSION;
  made_at: string;
  host: { name: string };
  tables: HostRecordTable[];
};

type TableRow = {
  id: string; account_id: string; slug: string; title: string; event_date: string;
  timezone: string | null; door: string | null; total_capacity: number; lifecycle_status: string;
};

/**
 * The tables this person hosts in their own personal account. The same rule
 * as ownHostedTable (hostTableGuests.ts) and the guest book: the account's
 * owner and personal_inventory_user_id are the caller, and the session names
 * the caller as its host.
 */
async function ownTables(db: D1Database, hostUserId: string): Promise<TableRow[]> {
  const { results } = await db.prepare(`
    SELECT e.id, e.account_id, e.slug, e.title, e.event_date, e.timezone, e.door, e.total_capacity, e.lifecycle_status
      FROM events e
      JOIN accounts a ON a.id = e.account_id
     WHERE e.host_user_id = ?
       AND a.personal_inventory_user_id = ? AND a.owner_user_id = a.personal_inventory_user_id
       AND a.status = 'active'
     ORDER BY e.event_date ASC, e.created_at ASC, e.id ASC
  `).bind(hostUserId, hostUserId).all<TableRow>();
  return results;
}

/** Whether this person hosts any table of their own, so a stopped host still takes their record. */
export async function hostsAnyTable(db: D1Database, hostUserId: string): Promise<boolean> {
  if (!hostUserId) return false;
  return (await ownTables(db, hostUserId)).length > 0;
}

/** The guests of one table: only the names they gave and how it went. */
async function tableGuests(db: D1Database, table: TableRow) {
  const { results } = await db.prepare(`
    SELECT id, full_name, status, attended, plus_one, plus_one_name
      FROM event_attendees WHERE event_id = ? AND account_id = ?
     ORDER BY created_at ASC, id ASC
  `).bind(table.id, table.account_id).all<{
    id: string; full_name: string | null; status: string; attended: number | null; plus_one: number | null; plus_one_name: string | null;
  }>();
  return results;
}

export async function hostRecord(
  db: D1Database,
  host: { userId: string; name: string },
  options: { appOrigin: string; now?: Date },
): Promise<HostRecord> {
  const tables = await ownTables(db, host.userId);
  const out: HostRecordTable[] = [];
  for (const table of tables) {
    const scope = { hostUserId: host.userId, accountId: table.account_id, eventId: table.id };
    const [guests, teas, notes] = await Promise.all([
      tableGuests(db, table),
      hostTableTeas(db, table),
      guestNotesFor(db, scope),
    ]);
    const lines = new Map(('notes' in notes ? notes.notes : []).map(n => [n.attendee_id, n.note]));
    out.push({
      title: table.title,
      date: table.event_date,
      timezone: table.timezone,
      door: table.door,
      seats: Number(table.total_capacity),
      status: table.lifecycle_status,
      link: `${options.appOrigin}/event/${table.slug}`,
      guests: guests.map(guest => ({
        name: String(guest.full_name ?? '').trim(),
        status: guest.status,
        came: guest.attended == null ? null : guest.attended === 1,
        plus_one: Number(guest.plus_one) > 0,
        plus_one_name: Number(guest.plus_one) > 0 && guest.plus_one_name?.trim() ? guest.plus_one_name.trim() : null,
        my_note: lines.get(guest.id) ?? null,
      })),
      teas: teas.map(tea => ({ name: tea.name, from: tea.from, pour_order: tea.brew_order, photo_url: tea.photo_url })),
    });
  }
  return {
    kind: HOST_RECORD_KIND,
    version: HOST_RECORD_VERSION,
    made_at: (options.now ?? new Date()).toISOString(),
    host: { name: host.name },
    tables: out,
  };
}

/** The download's file name, by the day it was made. */
export function hostRecordFileName(now = new Date()): string {
  return `teajia-record-${now.toISOString().slice(0, 10)}.json`;
}
