// Launch 1, "the first table" (todo/plans/guests-and-tea-masters-launch-1-run.md).
//
// One switch for everything Launch 1 adds: "Keep this tea" on the thank-you,
// a bought tea arriving in the Tea Chest, and a thank-you's tea links carrying
// where an order began. Switched on when Adrian shipped Launch 1 on
// 2026-11-26. To switch it off everywhere, set this constant to false.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_FIRST_TABLE_OPEN ('true' or 'false'), the worker reads the
// FIRST_TABLE_OPEN variable. Neither is set on the live site. A test or a
// local check of the closed state sets it to 'false'.
export const FIRST_TABLE_OPEN = true;

type Env = { FIRST_TABLE_OPEN?: string } | null | undefined;

/** Whether Launch 1 is open, on the site or in the worker. */
export function firstTableOpen(env?: Env): boolean {
  if (env?.FIRST_TABLE_OPEN === 'true') return true;
  if (env?.FIRST_TABLE_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FIRST_TABLE_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return FIRST_TABLE_OPEN;
}
