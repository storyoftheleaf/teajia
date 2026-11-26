// Launch 4, slice K4, "Add your table"
// (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
//
// One switch for everything K4 adds: a host naming one of their saved places
// as their table, and the public pages of their sessions there describing it
// by area only. Closed until Adrian opens it. It rests on Launch 2's saved
// places, so it also needs src/lib/fewHosts.ts open.
//
// A table is a saved place in the host's own account, never an account, so it
// is never a tea house and never appears in Visit.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_YOUR_TABLE_PLACE_OPEN ('true' or 'false'), the worker reads the
// YOUR_TABLE_PLACE_OPEN variable. Neither is set on the live site.
export const YOUR_TABLE_PLACE_OPEN = false;

type Env = { YOUR_TABLE_PLACE_OPEN?: string } | null | undefined;

/** Whether "Add your table" is open, on the site or in the worker. */
export function yourTablePlaceOpen(env?: Env): boolean {
  if (env?.YOUR_TABLE_PLACE_OPEN === 'true') return true;
  if (env?.YOUR_TABLE_PLACE_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_YOUR_TABLE_PLACE_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return YOUR_TABLE_PLACE_OPEN;
}

/**
 * The one line a public session page shows for a session at the host's own
 * table: whose table and the area, never more. Undefined when the session is
 * not at a table (the answer then carries no `your_table`).
 */
export function yourTableLine(table: unknown, hostName?: unknown): string | undefined {
  if (!table || typeof table !== 'object') return undefined;
  const area = (table as { area?: unknown }).area;
  const name = typeof hostName === 'string' && hostName.trim() ? hostName.trim() : '';
  const whose = name ? `${name}’s table` : 'The host’s table';
  return typeof area === 'string' && area.trim() ? `${whose}, ${area.trim()}` : whose;
}
