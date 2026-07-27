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
 * What "low" means depends on what is being counted.
 *
 * The stock column holds grams for loose leaf and whole pieces for teaware, in
 * the same field. Reading it as grams for both is why the teaware card carried
 * its own stock function: under the shared one, three teapots on the shelf read
 * "Low Stock" and so did the last three hundred, because everything below a
 * hundred is low when a hundred is a small bag of tea and a warehouse of pots.
 *
 * One vocabulary, two thresholds, both stated here rather than reinvented per
 * surface. A hundred grams is roughly the smallest bag worth posting; two
 * pieces is the point at which a teaware line is about to end.
 */
export type StockUnit = 'g' | 'piece';

const LOW_THRESHOLD: Record<StockUnit, number> = { g: 100, piece: 3 };

/**
 * The card's version also accepted a written `status` string and treated
 * "Sold Out" as authoritative. `InventoryItem` carries no such field, so that
 * branch had never once been reachable from either surface: the card called it
 * with one argument. The count is the only fact either surface has.
 */
export function getStockStatus(stock: number, unit: StockUnit = 'g'): StockStatus {
  if (stock <= 0) {
    return { label: 'Sold Out', colorClass: 'text-tea-text-dim', level: 'out' };
  }
  if (stock < LOW_THRESHOLD[unit]) {
    return { label: 'Low Stock', colorClass: 'text-tea-gold', level: 'low' };
  }
  return { label: 'In Stock', colorClass: 'text-tea-text-sec', level: 'ok' };
}
