// One reviewed display-only lot. The existing Bali owner visibility switch
// still decides whether the listing is public.
export const INWARD_BALI_LOT = {
  accountId: 'acc_teajia_bali',
  id: '82124f03-a6a6-4a40-8a5b-cf1fc715ce8c',
} as const;

export type InwardCountColumns = {
  id?: unknown;
  stock_known_at?: unknown;
  stock_verified_at?: unknown;
  stock_grams?: unknown;
};

const hasTimestamp = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export function inwardOrdersPaused(accountId: unknown, product: InwardCountColumns): boolean {
  if (accountId !== INWARD_BALI_LOT.accountId || product.id !== INWARD_BALI_LOT.id) return false;
  const amount = product.stock_grams;
  return !hasTimestamp(product.stock_known_at) || !hasTimestamp(product.stock_verified_at)
    || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0;
}

// For scoped product queries that already read the legacy product as p.
export const INWARD_ORDERS_PAUSED_SQL = `(
  p.account_id = '${INWARD_BALI_LOT.accountId}' AND p.id = '${INWARD_BALI_LOT.id}'
  AND (TRIM(COALESCE(p.stock_known_at, '')) = ''
    OR TRIM(COALESCE(p.stock_verified_at, '')) = ''
    OR typeof(p.stock_grams) NOT IN ('integer', 'real') OR p.stock_grams < 0)
)`;
