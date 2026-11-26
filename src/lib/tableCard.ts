// Launch 5, M3: a card for the table, the evening's teas on one printed page
// with a code for afterward (src/pages/SessionCardPage.tsx). Closed until
// Adrian says "ship", like every other part of Launch 5: closed, Manage offers
// no "Print a card for the table" and its address opens nothing.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_TABLE_CARD_OPEN ('true' or 'false'), the worker reads TABLE_CARD_OPEN.
// The card reads the public session answer; the worker switches only the tea
// menu's year and place, which the card alone asks for.
export const TABLE_CARD_OPEN = false;

/** Whether the card for the table is open, on the site or in the worker. */
export function tableCardOpen(env?: { TABLE_CARD_OPEN?: string } | null): boolean {
  if (env?.TABLE_CARD_OPEN === 'true') return true;
  if (env?.TABLE_CARD_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TABLE_CARD_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return TABLE_CARD_OPEN;
}
