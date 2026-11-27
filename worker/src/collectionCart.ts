/**
 * A collection is the shop, filtered down to the teas someone chose for you
 * (Adrian, 2026-11-27: "it's actually just kind of like a filter that was made
 * for them by someone else ... like an Amazon wish list"). So its Add goes to
 * the shop's own cart, and the order goes through the shop's own checkout.
 *
 * Two things differ from a shop line, and both come from the collection, not
 * the client:
 *  - a tea on a private link may be one the shop does not list, so the line is
 *    allowed when the tea is on that live link;
 *  - the price is the one the collection quoted, scaled to the amount chosen,
 *    with no handling amount on top. A blank quote follows the shop's price.
 */

/** The amount a collection's suggested quantity is counted in. Mirrors the link page. */
export function collectionQuantityUnit(row: { product_type?: string | null; form?: string | null; recommended_quantity?: unknown }): 'g' | 'piece' | 'unit' {
  const type = String(row.product_type ?? '').toLowerCase();
  if (type === 'teaware' || type === 'misc') return 'unit';
  const form = String(row.form ?? '').toLowerCase();
  if (form.includes('loose')) return 'g';
  const rec = Number(row.recommended_quantity);
  if (Number.isFinite(rec) && rec > 10) return 'g';
  if (type === 'sheng' || type === 'shou' || type === 'dark') return 'piece';
  return 'g';
}

/**
 * The collection's quoted price for one gram, or null when the collection
 * gives none the cart can use (no quote, teaware, or a piece of unknown weight).
 */
export function collectionPricePerGram(row: {
  product_type?: string | null; form?: string | null;
  recommended_quantity?: unknown; recommended_price_usd?: unknown; piece_weight_g?: unknown;
}): number | null {
  if (row.recommended_price_usd == null || row.recommended_quantity == null) return null;
  const price = Number(row.recommended_price_usd);
  const qty = Number(row.recommended_quantity);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty <= 0) return null;
  const unit = collectionQuantityUnit(row);
  if (unit === 'g') return price / qty;
  if (unit === 'piece') {
    const piece = Number(row.piece_weight_g);
    return Number.isFinite(piece) && piece > 0 ? price / (qty * piece) : null;
  }
  return null;
}

/** A collection line's total: the quoted rate times the grams, to the cent. */
export function collectionLineTotal(pricePerGram: number, grams: number): number {
  return Math.round(pricePerGram * grams * 100) / 100;
}

export interface CollectionCartTea {
  productId: string;
  pricePerGram: number | null;
}

/**
 * The teas a cart may carry from collection links, keyed by product id.
 *
 * A line counts only when its link is live (published, not taken down, its
 * collection not archived) and belongs to the store the order is for, and the
 * tea is on that link. Anything else is not returned, so the line falls back
 * to the shop's own rules and is refused there if the shop does not sell it.
 */
export async function collectionCartTeas(
  db: D1Database,
  accountId: string,
  items: Array<Record<string, unknown>>,
): Promise<Map<string, CollectionCartTea>> {
  const bySlug = new Map<string, Set<string>>();
  for (const item of items) {
    const slug = typeof item.collectionSlug === 'string' ? item.collectionSlug.trim() : '';
    const id = typeof item.id === 'string' ? item.id : '';
    if (!slug || !id || item.custom === true) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug)!.add(id);
  }
  const found = new Map<string, CollectionCartTea>();
  for (const [slug, ids] of bySlug) {
    const productIds = [...ids];
    const { results } = await db.prepare(
      `SELECT ci.product_id, ci.recommended_quantity, ci.recommended_price_usd,
              p.type AS product_type, p.form, p.piece_weight_g
         FROM collection_publications pub
         JOIN collections c ON c.id = pub.collection_id
         JOIN collection_items ci ON ci.collection_id = c.id
         JOIN products p ON p.id = ci.product_id
        WHERE pub.slug = ? AND pub.unpublished_at IS NULL
          AND c.account_id = ? AND c.status <> 'archived'
          AND p.account_id = ? AND p.status = 'Active'
          AND ci.product_id IN (${productIds.map(() => '?').join(',')})`
    ).bind(slug, accountId, accountId, ...productIds).all<Record<string, unknown>>();
    for (const row of results ?? []) {
      found.set(String(row.product_id), { productId: String(row.product_id), pricePerGram: collectionPricePerGram(row) });
    }
  }
  return found;
}
