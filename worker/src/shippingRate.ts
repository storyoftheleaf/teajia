/**
 * Freight, and the one place that decides what it costs.
 *
 * Every tea carries freight into its cost basis, and the markup multiplies it
 * along with everything else, because it is money out. A shop that recovers
 * postage at 1x while the rest of the shelf runs at 3x is selling its own
 * shipping at cost.
 *
 * The shop used to hold four answers for one number. Products defaulted to 0,
 * the intake batch to 10, the Add Product form filled in 13, and the agent
 * tool documented 10 while writing whatever it was handed. The same tea landed
 * at a different cost depending on which door it came through, and a product
 * entered by hand sold with no freight in its price at all. That is what this
 * module exists to stop happening twice: the arithmetic lives here, the rate
 * lives on the account, and `worker/tests/shipping-rate.test.ts` fails if a
 * second answer appears anywhere in the codebase.
 *
 * The rate is quoted in the currency it is actually paid in. Adrian pays his
 * forwarder in yuan, so the shop default is 85 CNY per kilo and the dollar
 * figure is derived from it live, not the other way round. It is a column on
 * `accounts`, editable in Store Settings, so a better freight deal is a field
 * rather than a deploy.
 *
 * The rule, in Adrian's words: the default applies unless he specifically
 * enters a rate. So NULL means nobody has said, and takes the default; a
 * number means he said, and is obeyed, zero included. That holds at both
 * levels — a product with no rate takes the shop's, and a shop with no rate
 * takes the fallback below.
 */

/**
 * The rate a shop charges when it has never set one of its own.
 *
 * Not "the shop rate": that is `accounts.default_shipping_rate_per_kg`, and it
 * is what every existing shop actually reads. This pair is the floor under a
 * brand-new account, so that a shop nobody has configured still charges for
 * freight rather than shipping at a loss in silence.
 */
export const FALLBACK_SHIPPING_RATE_PER_KG = 85;
export const FALLBACK_SHIPPING_RATE_CURRENCY = 'Yuan';

export interface ShopFreightDefault {
  /** The rate as quoted, in `currency`. */
  perKg: number;
  /** The currency it is quoted in, as an `exchange_rates` key. */
  currency: string;
  /** The same rate in USD, at today's rate. Everything downstream uses this. */
  perKgUsd: number;
}

/**
 * Resolve a shop's freight default to USD, at today's rate.
 *
 * `rateToUsd` looks a currency up in the exchange table; pass a function that
 * has already applied `canonicalCurrency`, since the table keys CNY as 'Yuan'.
 * A currency the table does not carry falls back to the rate for the fallback
 * currency rather than to 1, because treating 85 yuan as 85 dollars would
 * multiply freight sevenfold and the markup would triple that.
 */
export function resolveShopFreightDefault(
  account: { default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null } | null | undefined,
  rateToUsd: (currency: string) => number | undefined,
): ShopFreightDefault {
  const stored = account?.default_shipping_rate_per_kg;
  const set = stored !== null && stored !== undefined && Number.isFinite(Number(stored));
  const perKg = set ? Number(stored) : FALLBACK_SHIPPING_RATE_PER_KG;
  const currency = (set && account?.default_shipping_rate_currency)
    ? String(account.default_shipping_rate_currency)
    : FALLBACK_SHIPPING_RATE_CURRENCY;
  const looked = rateToUsd(currency);
  const rate = looked && looked > 0 ? looked : (rateToUsd(FALLBACK_SHIPPING_RATE_CURRENCY) || 1);
  return { perKg, currency, perKgUsd: perKg / rate };
}

/**
 * What freight adds to one gram of a tea, in USD.
 *
 * `storedRatePerKg` is the per-product column, written in the tea's OWN cost
 * currency, because a rate entered beside a CNY invoice is a CNY rate. The
 * shop default arrives already converted, in `shopDefaultPerKgUsd`. The two are
 * therefore converted separately rather than added together and divided once.
 *
 * `rateToUsd` is units of the cost currency per USD, as the exchange table
 * holds it: 7.1 for yuan, 1 for dollars.
 *
 * Teaware is the one true zero. It is priced per piece and its freight is
 * already inside that price, so adding a per-gram rate would charge it twice.
 */
export function shippingPerGramUsd(opts: {
  storedRatePerKg: number | null | undefined;
  rateToUsd: number;
  isTeaware: boolean;
  shopDefaultPerKgUsd: number;
}): number {
  if (opts.isTeaware) return 0;
  const rate = opts.rateToUsd || 1;
  const stored = opts.storedRatePerKg;
  const entered = stored !== null && stored !== undefined && Number.isFinite(Number(stored));
  const perKgUsd = entered ? Number(stored) / rate : opts.shopDefaultPerKgUsd;
  return perKgUsd / 1000;
}
