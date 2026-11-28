/** The one discount line an invoice carries ("Discount 10%", no tea, negative amount): its name and the percent in it. One home for the server and the invoice editor. */
const DISCOUNT_NAME = /^Discount (\d+(?:\.\d+)?)%$/;

export function discountLineName(percent: number): string {
  return `Discount ${percent}%`;
}

/** The percent in a discount line, or null when the row is not one. */
export function discountLinePercent(row: { product_id?: unknown; custom_name?: unknown; price_at_sale?: unknown }): number | null {
  if (row.product_id || typeof row.custom_name !== 'string' || !(Number(row.price_at_sale) < 0)) return null;
  const match = row.custom_name.match(DISCOUNT_NAME);
  return match ? Number(match[1]) : null;
}
