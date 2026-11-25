// A personal offer is one pack. Once another buyer holds it (a live stock
// hold on someone else's order) or it has sold, a second buyer is told so in
// one plain sentence instead of being filed a draft request that can never be
// filled (Adrian, 2026-11-25).

export const PERSONAL_OFFER_TAKEN = 'This tea has just been taken by another buyer.';

/** True when any requested personal offer has no pack left to sell. */
export async function personalOfferTaken(db: D1Database, accountId: string, productIds: string[]): Promise<boolean> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return false;
  const row = await db.prepare(
    `SELECT 1 AS taken FROM products p
      WHERE p.account_id = ? AND p.id IN (${ids.map(() => '?').join(',')})
        AND p.personal_offer_source_id IS NOT NULL AND p.personal_offer_withdrawn_at IS NULL
        AND COALESCE(p.stock_grams, 0) - COALESCE((
          SELECT SUM(h.held_grams) FROM stock_holds h
           WHERE h.account_id = p.account_id AND h.product_id = p.id
             AND (h.expires_at IS NULL OR julianday(h.expires_at) > julianday('now'))
        ), 0) < COALESCE(NULLIF(p.piece_weight_g, 0), 1)
      LIMIT 1`,
  ).bind(accountId, ...ids).first<{ taken: number }>();
  return Boolean(row?.taken);
}
