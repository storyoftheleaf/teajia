// Launch 4, tea houses as Adrian's portfolio (slice K5 part two of
// todo/plans/guests-and-tea-masters-launch-4-run.md, "Tea Houses as a
// portfolio (Adrian, 2026-11-26)"; the section is in docs/SECTIONS.md).
//
// One switch for the public portfolio: the Overview at /tea-houses, Build at
// /tea-houses/build, Work at /tea-houses/work and each house's page at
// /tea-houses/work/:slug, Visit's line to a house's page, and the worker's
// public routes under /api/tea-houses. The same switch controls the portfolio
// in Manage and the extra directory fields. Off until Adrian ships Launch 4.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_TEA_HOUSES_OPEN ('true' or 'false'), the worker reads the
// TEA_HOUSES_OPEN variable. Neither is set on the live site. A test or a local
// check of the open state sets it to 'true'.
export const TEA_HOUSES_OPEN = false;

/**
 * The section's name on its pages. Not final (Adrian has not said yes to
 * "Tea Houses" as the page title), so it lives here alone and every page reads
 * it from here.
 */
export const TEA_HOUSES_TITLE = 'Tea Houses';

type Env = { TEA_HOUSES_OPEN?: string } | null | undefined;

/** Whether the tea house portfolio is open, on the site or in the worker. */
export function teaHousesOpen(env?: Env): boolean {
  if (env?.TEA_HOUSES_OPEN === 'true') return true;
  if (env?.TEA_HOUSES_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TEA_HOUSES_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return TEA_HOUSES_OPEN;
}
