// Launch 4, Your Table as a page (todo/plans/guests-and-tea-masters-launch-4-run.md,
// K8; todo/plans/your-table.md, decisions 1, 3 and 4).
//
// One switch for everything the page adds: /account as a real page with the
// tiles in their quiet groups, the sessions view at /account/sessions, the
// table switcher at /account/tea-houses, the glyph opening the page instead of
// the overlay, and the share line on each tasting in the journal (with its
// read, GET /api/family/tasting-shares). Off until Adrian says yes at the
// gate. Closed, /account opens the overlay panel exactly as before, the two
// new addresses do not exist, the journal shows no share lines, and the read
// answers 404.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_YOUR_TABLE_PAGE_OPEN ('true' or 'false'), the worker reads the
// YOUR_TABLE_PAGE_OPEN variable. Neither is set on the live site. A test or a
// local check of the open state sets it to 'true'.
export const YOUR_TABLE_PAGE_OPEN = true;

type Env = { YOUR_TABLE_PAGE_OPEN?: string } | null | undefined;

/** Whether Your Table is a page, on the site or in the worker. */
export function yourTablePageOpen(env?: Env): boolean {
  if (env?.YOUR_TABLE_PAGE_OPEN === 'true') return true;
  if (env?.YOUR_TABLE_PAGE_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_YOUR_TABLE_PAGE_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return YOUR_TABLE_PAGE_OPEN;
}

/** The addresses that are Your Table itself (not the pages its tiles open). */
export const YOUR_TABLE_PATHS = ['/account', '/account/sessions', '/account/tea-houses'] as const;

export function isYourTablePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (YOUR_TABLE_PATHS as readonly string[]).includes(path);
}
