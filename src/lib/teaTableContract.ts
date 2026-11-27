// The Tea Table's answers, shared by the worker (worker/src/teaTable.ts) and
// the site (src/pages/TeaTablePage.tsx). Plan: todo/plans/tea-table.md.
//
// Nothing here carries a score, a count, a rank or anyone's user id. The only
// numbers are a photograph's own width and height. The number of keeps lives
// in one Manage answer, TeaTableManageItem, read by the platform owner alone.
import type { FamilyPersonPhotograph, FamilyPersonWord } from './familyContract';
import type { TeaTableKind } from './teaTable';

export type { TeaTableKind } from './teaTable';

/** A tasting someone shared to their page and the Tea Table: their words and photographs, never the score. */
export interface TeaTableTasting {
  kind: 'tasting';
  id: string;
  /** When it was put on the table. The table is in this order, newest first. */
  at: string;
  person: { name: string; path: string };
  tea: { name: string; chinese_name: string | null; path: string; type: string | null };
  words: FamilyPersonWord[];
  photographs: FamilyPersonPhotograph[];
}

/** A published session recap its host put on the Tea Table. */
export interface TeaTableRecap {
  kind: 'recap';
  id: string;
  at: string;
  slug: string;
  title: string;
  session_date: string;
  host: string | null;
  writing: string;
  teas: string[];
  tea_type: string | null;
}

export type TeaTableItem = TeaTableTasting | TeaTableRecap;

export type TeaTableShow = 'all' | 'tastings' | 'sessions';
export const TEA_TABLE_SHOWS: readonly TeaTableShow[] = ['all', 'tastings', 'sessions'];

/** GET /api/tea-table. `held` sits above the rest on the first page only; `earlier` is the next page's `before`. */
export interface TeaTablePage {
  held: Array<TeaTableItem & { held_until: string }>;
  items: TeaTableItem[];
  earlier: string | null;
}

/** GET /api/tea-table/me: what the caller kept, and which pieces are their own to take off. */
export interface TeaTableMine {
  kept: TeaTableItem[];
  /** `kind:id` of the caller's own pieces on the table. */
  mine: string[];
}

/** GET /api/admin/tea-table, for the platform owner alone. */
export interface TeaTableManageItem {
  kind: TeaTableKind;
  id: string;
  at: string;
  title: string;
  by: string | null;
  path: string;
  /** Hidden by the owner's hand. */
  hidden: boolean;
  /** On the table now: put there, still shared or published, and not hidden. */
  showing: boolean;
  held_until: string | null;
  keeps: number;
}

/** GET, PUT and DELETE /api/admin/tea-table/recaps/:eventId, for the session's host. */
export interface TeaTableRecapState {
  eligible: boolean;
  on_table: boolean;
  held_until: string | null;
}

export const teaTableKey = (item: { kind: TeaTableKind; id: string }) => `${item.kind}:${item.id}`;

/** How long a hold may last, in days. A hold always ends. */
export const TEA_TABLE_HOLD_DAYS = { least: 1, most: 14, usual: 3 } as const;

/** The stored moment as a Date: SQLite writes 'YYYY-MM-DD HH:MM:SS' in UTC. */
export function teaTableMoment(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
}
