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
 * module exists to stop happening twice: the rate and the arithmetic both live
 * here, and `worker/tests/shipping-rate.test.ts` fails if a second answer
 * appears anywhere in the codebase.
 *
 * The rule, in Adrian's words: the default applies unless he specifically
 * enters a rate. So NULL means nobody has said, and takes the default; a
 * number means he said, and is obeyed, zero included.
 */

/** USD per kilo. The one default. */
export const DEFAULT_SHIPPING_RATE_PER_KG_USD = 12;

/**
 * What freight adds to one gram of a tea, in USD.
 *
 * `storedRatePerKg` is the per-product column, written in the tea's OWN cost
 * currency, because a rate entered beside a CNY invoice is a CNY rate. The
 * default is in USD. The two are therefore converted separately rather than
 * added together and divided once.
 *
 * `rateToUsd` is units of the cost currency per USD, as the exchange table
 * holds it: 7.2 for yuan, 1 for dollars.
 *
 * Teaware is the one true zero. It is priced per piece and its freight is
 * already inside that price, so adding a per-gram rate would charge it twice.
 */
export function shippingPerGramUsd(opts: {
  storedRatePerKg: number | null | undefined;
  rateToUsd: number;
  isTeaware: boolean;
}): number {
  if (opts.isTeaware) return 0;
  const rate = opts.rateToUsd || 1;
  const stored = opts.storedRatePerKg;
  const entered = stored !== null && stored !== undefined && Number.isFinite(Number(stored));
  const perKgUsd = entered ? Number(stored) / rate : DEFAULT_SHIPPING_RATE_PER_KG_USD;
  return perKgUsd / 1000;
}
