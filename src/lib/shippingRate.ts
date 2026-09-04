/**
 * The shop's freight rate, on the app side.
 *
 * The worker owns this number in `worker/src/shippingRate.ts`; the two builds
 * do not share a module, so it is written twice and
 * `worker/tests/shipping-rate.test.ts` fails if the copies disagree. That test
 * is the reason this file is a constant rather than a literal typed into a
 * form, which is how the shop came to hold four different rates at once.
 *
 * USD per kilo, because that is how Adrian quotes and enters it. The stored
 * per-product column is in the tea's OWN cost currency, so every read converts
 * out and every write converts back in, with the two helpers below.
 */
export const DEFAULT_SHIPPING_RATE_PER_KG_USD = 12;

/** What the shop charges per kilo, in the currency a tea was bought in. */
export function defaultShippingRateInCurrency(rateToUsd: number): number {
  const rate = rateToUsd > 0 ? rateToUsd : 1;
  return DEFAULT_SHIPPING_RATE_PER_KG_USD * rate;
}

/**
 * The rate to show and edit, in USD.
 *
 * A tea with nothing recorded shows the shop default rather than a blank or a
 * zero: it is what the tea is actually being charged, so it is what the
 * operator should see. An entered rate is shown as entered, zero included.
 */
export function shippingRateUsdFor(
  storedRatePerKg: number | null | undefined,
  rateToUsd: number,
): number {
  const rate = rateToUsd > 0 ? rateToUsd : 1;
  if (storedRatePerKg === null || storedRatePerKg === undefined) return DEFAULT_SHIPPING_RATE_PER_KG_USD;
  const stored = Number(storedRatePerKg);
  if (!Number.isFinite(stored)) return DEFAULT_SHIPPING_RATE_PER_KG_USD;
  return stored / rate;
}
