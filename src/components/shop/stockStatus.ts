/**
 * One stock vocabulary for the shop card and the product page.
 *
 * These were two functions with the same name, the same three states and two
 * different palettes. The page returned theme tokens; the card returned two
 * literal hex values, `#a65d4e` for Sold Out and `#c09a51` for Low Stock, which
 * the colour lint cannot see because they were handed to an inline style. So
 * the same fact about the same tea was painted in a colour that follows the
 * theme on one surface and a colour that does not on the other, and switching
 * to light mode moved only one of them.
 *
 * Three states, because there are three things worth saying, and the label
 * carries the colour. There is no dot: a coloured dot a gap away from the words
 * "Low Stock", in the colour of those words, encodes what the words already say.
 *
 * Bronze is reserved for the one stock state that asks the reader to act.
 */
export type StockLevel = 'out' | 'low' | 'ok';

export interface StockStatus {
  label: string;
  /** A safe text token, never a literal. */
  colorClass: string;
  level: StockLevel;
}

/**
 * The card's version also accepted a written `status` string and treated
 * "Sold Out" as authoritative. `InventoryItem` carries no such field, so that
 * branch had never once been reachable from either surface: the card called it
 * with one argument. The gram count is the only fact either surface has.
 */
export function getStockStatus(stockG: number): StockStatus {
  if (stockG <= 0) {
    return { label: 'Sold Out', colorClass: 'text-tea-text-dim', level: 'out' };
  }
  if (stockG < 100) {
    return { label: 'Low Stock', colorClass: 'text-tea-gold', level: 'low' };
  }
  return { label: 'In Stock', colorClass: 'text-tea-text-sec', level: 'ok' };
}
