import { shelfPricesFor } from './productPricing';

/**
 * Collections and the shelf price.
 *
 * Collections used to read only `fixed_retail_price_usd`, so every tea priced
 * from its cost showed no price on a shared collection, 0.00 in the editor,
 * and went onto the invoice at nothing. These read the live shelf price
 * (`shelfPricesFor`) instead. Nothing is copied into `collection_items`: a
 * blank quote follows cost, freight and rate changes.
 */

/** Adds `catalog_price_usd` (per gram, per piece for teaware) to each row, in place. */
export async function withShelfPrices<T extends Record<string, any>>(env: { DB: D1Database }, accountId: string, rows: T[]): Promise<T[]> {
  const prices = await shelfPricesFor(env, accountId, rows.map(row => String(row.product_id)));
  for (const row of rows) (row as Record<string, any>).catalog_price_usd = prices.get(String(row.product_id)) ?? null;
  return rows;
}

/** Fills a blank quote with the shelf price for the recommended amount, in place. */
export async function fillBlankQuotes<T extends Record<string, any>>(env: { DB: D1Database }, accountId: string, rows: T[]): Promise<T[]> {
  await withShelfPrices(env, accountId, rows);
  for (const row of rows as Record<string, any>[]) {
    const qty = Number(row.recommended_quantity);
    if (row.recommended_price_usd == null && row.catalog_price_usd != null && Number.isFinite(qty) && qty > 0) {
      row.recommended_price_usd = Math.round(row.catalog_price_usd * qty * 100) / 100;
    }
    delete row.catalog_price_usd;
  }
  return rows;
}
