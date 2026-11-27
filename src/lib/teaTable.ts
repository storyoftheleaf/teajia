// Launch 4, the Tea Table (todo/plans/tea-table.md, and K1 and K2 of
// todo/plans/guests-and-tea-masters-launch-4-run.md).
//
// One switch for the Tea Table: the page at /tea-table (and /tea-feed, which
// forwards there), the Share step's Tea Table wording, the host's "Put on the
// Tea Table" on a published recap, the keep, the hold, the Manage section, and
// the worker routes under /api/tea-table and /api/admin/tea-table. It replaces
// BREWING_EXPERIENCES_OPEN, the switch for the page's first form. Off until
// Adrian ships Launch 4.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_TEA_TABLE_OPEN ('true' or 'false'), the worker reads the TEA_TABLE_OPEN
// variable. Neither is set on the live site. A test or a local check of the
// open state sets it to 'true'.
export const TEA_TABLE_OPEN = true;

type Env = { TEA_TABLE_OPEN?: string } | null | undefined;

/** Whether the Tea Table is open, on the site or in the worker. */
export function teaTableOpen(env?: Env): boolean {
  if (env?.TEA_TABLE_OPEN === 'true') return true;
  if (env?.TEA_TABLE_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TEA_TABLE_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return TEA_TABLE_OPEN;
}

/** A guest's yes to their photograph on the Tea Table counts only while the Tea Table can be reached. */
export function teaTableConsent(asked: boolean): boolean {
  return teaTableOpen() && asked;
}

/** The kinds of piece on the Tea Table. A casual sit is held for later; it is not on the table yet. */
export type TeaTableKind = 'recap' | 'tasting';
