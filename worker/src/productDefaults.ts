/**
 * The three columns on a product row that no door may leave to the table.
 *
 * `worker/schema.sql` says `products.shipping_rate_per_kg REAL DEFAULT NULL`.
 * The live column, created by migration `0000` and never rebuilt since, says
 * `DEFAULT 0`. Four migrations have written over those zeros (0007, 0010, 0013,
 * 0016) and not one of them could change the default, because SQLite cannot
 * alter a column default in place. So the file describing the database has been
 * wrong for months, in the direction that costs money:
 *
 *   shipping_rate_per_kg  DEFAULT 0    an INSERT that omits it says this tea
 *                                      ships free, which is what Adrian saying
 *                                      "free" looks like. Freight then never
 *                                      enters the cost basis and the x3 never
 *                                      multiplies it.
 *   markup_multiplier     DEFAULT 2.5  the number the shop stopped using. The
 *                                      curator listing path reads the column,
 *                                      so the same tea carries two prices
 *                                      depending on which surface asks.
 *   cost_amount           DEFAULT 0    a free tea, not an unrecorded one. The
 *                                      shelf prices it at zero times three.
 *
 * Every one of those is absence answered with a number, and a number is not
 * distinguishable from a decision once it is in the row. NULL is how a row says
 * nobody entered anything: `shippingRate.ts` then charges the shop rate,
 * `markup.ts` reads SHOP_MARKUP_MULTIPLIER, and a missing cost is findable
 * rather than priced.
 *
 * Ten doors write these two tables and five of them named none of the three, so
 * this is not a fix for one INSERT: it is the rule the next door will need too.
 * Doors that build a column bag call `nameProductColumns`; doors that write the
 * column list into their SQL name the columns there. Either way the row says
 * what it means, whatever the table would have said on its behalf.
 *
 * Migration `0018` clears the defaults themselves. This module is what makes
 * that migration a second line of defence rather than the only one.
 */

/** The columns whose stored default is a policy number nobody chose. */
export const COLUMNS_A_PRODUCT_MUST_NAME = [
  'shipping_rate_per_kg',
  'markup_multiplier',
  'cost_amount',
] as const;

/**
 * State the three columns on a column bag heading for an INSERT.
 *
 * Only absence is filled in. A caller that passed 0 passed a decision (this tea
 * ships free, this tea was a gift) and it survives untouched, which is the same
 * rule `enteredNumber()` holds on the admin edit path.
 *
 * Call this AFTER any step that strips empty keys. The bulk import builds its
 * body by dropping every null, undefined and empty-string value, so it could
 * not send a deliberate NULL even if it wanted to; running afterwards is what
 * turns "the operator left the cell blank" back into "follow the shop".
 */
export function nameProductColumns<T extends Record<string, unknown>>(body: T): T {
  for (const column of COLUMNS_A_PRODUCT_MUST_NAME) {
    if (body[column] === undefined || body[column] === null) {
      (body as Record<string, unknown>)[column] = null;
    }
  }
  return body;
}
