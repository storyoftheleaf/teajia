// Launch 5, M3: a card for the table, the evening's teas on one printed page
// with a code for afterward (src/pages/SessionCardPage.tsx). Closed until
// Adrian says "ship", like every other part of Launch 5: closed, Manage offers
// no "Print a card for the table" and its address opens nothing.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_TABLE_CARD_OPEN ('true' or 'false'). The card reads only the public
// session answer, so the worker has nothing to switch.
export const TABLE_CARD_OPEN = false;

/** Whether the card for the table is offered in Manage. */
export function tableCardOpen(): boolean {
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
