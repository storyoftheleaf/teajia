// One reviewed display-only lot. The existing Bali owner visibility switch
// still decides whether the listing is public.
export const INWARD_BALI_LOT = {
  accountId: 'acc_teajia_bali',
  id: '82124f03-a6a6-4a40-8a5b-cf1fc715ce8c',
} as const;

// THE RULE FOR REOPENING ORDERS. true: the lot stays paused until its price
// and its sell sizes are set as well as the count. false: a verified count
// alone reopens it. Flip this one line to change the behaviour everywhere.
export const REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES = true;

export type InwardCountColumns = {
  id?: unknown;
  stock_known_at?: unknown;
  stock_verified_at?: unknown;
  stock_grams?: unknown;
  fixed_retail_price_usd?: unknown;
  sold_in_whole_units?: unknown;
  piece_weight_g?: unknown;
};

const hasTimestamp = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// A price is a number, zero included. A sell size is either the loose-tea
// ladder (nothing sold by the piece) or a piece weight for a tea sold whole.
// A row read without these columns says nothing about them, so it is not
// held back for them.
function priceAndSizesSet(product: InwardCountColumns): boolean {
  if (!('fixed_retail_price_usd' in product)) return true;
  if (!isNumber(product.fixed_retail_price_usd) || product.fixed_retail_price_usd < 0) return false;
  return !product.sold_in_whole_units || (isNumber(product.piece_weight_g) && product.piece_weight_g > 0);
}

export function inwardOrdersPaused(
  accountId: unknown,
  product: InwardCountColumns,
  needsPriceAndSizes: boolean = REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES,
): boolean {
  if (accountId !== INWARD_BALI_LOT.accountId || product.id !== INWARD_BALI_LOT.id) return false;
  const amount = product.stock_grams;
  return !hasTimestamp(product.stock_known_at) || !hasTimestamp(product.stock_verified_at)
    || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
    || (needsPriceAndSizes && !priceAndSizesSet(product));
}

// For scoped product queries that already read the legacy product as p.
export function inwardOrdersPausedSql(needsPriceAndSizes: boolean): string {
  const priceAndSizes = `
    OR typeof(p.fixed_retail_price_usd) NOT IN ('integer', 'real') OR p.fixed_retail_price_usd < 0
    OR (COALESCE(p.sold_in_whole_units, 0) <> 0 AND COALESCE(p.piece_weight_g, 0) <= 0)`;
  return `(
  p.account_id = '${INWARD_BALI_LOT.accountId}' AND p.id = '${INWARD_BALI_LOT.id}'
  AND (TRIM(COALESCE(p.stock_known_at, '')) = ''
    OR TRIM(COALESCE(p.stock_verified_at, '')) = ''
    OR typeof(p.stock_grams) NOT IN ('integer', 'real') OR p.stock_grams < 0${needsPriceAndSizes ? priceAndSizes : ''}
  )
)`;
}

export const INWARD_ORDERS_PAUSED_SQL = inwardOrdersPausedSql(REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES);
