/**
 * The shop's freight rate, on the app side.
 *
 * The rate itself is not here. It lives on the account
 * (`default_shipping_rate_per_kg`, quoted in
 * `default_shipping_rate_currency`) so that a better freight deal is a field in
 * Store Settings rather than a code change and a deploy. What lives here is the
 * arithmetic for showing and editing it, and the fallback for a shop that has
 * never set one.
 *
 * The worker owns the same fallback in `worker/src/shippingRate.ts`; the two
 * builds share no module, so it is written twice and
 * `worker/tests/shipping-rate.test.ts` fails if the copies disagree. That test
 * is the reason this is a constant rather than a literal typed into a form,
 * which is how the shop came to hold four different rates at once.
 *
 * The stored per-product column is in the tea's OWN cost currency, so every
 * read converts out to USD and every write converts back in. USD is the display
 * unit throughout the admin, because a single column mixing yuan and dollars
 * cannot be compared down a list.
 */

/** What a shop charges per kilo when it has never set a rate. */
export const FALLBACK_SHIPPING_RATE_PER_KG = 85;
export const FALLBACK_SHIPPING_RATE_CURRENCY = 'Yuan';

/** A shop's freight default, as the admin holds it. */
export interface ShopFreightDefault {
  /** The rate as quoted, in `currency`. */
  perKg: number;
  /** The currency it is quoted in, as an exchange-table key. */
  currency: string;
  /** The same rate in USD, at today's rate. */
  perKgUsd: number;
}

/** The fallback, resolved against live rates. Used when an account has none. */
export function fallbackShopFreightDefault(fallbackRateToUsd: number): ShopFreightDefault {
  const rate = fallbackRateToUsd > 0 ? fallbackRateToUsd : 1;
  return {
    perKg: FALLBACK_SHIPPING_RATE_PER_KG,
    currency: FALLBACK_SHIPPING_RATE_CURRENCY,
    perKgUsd: FALLBACK_SHIPPING_RATE_PER_KG / rate,
  };
}

/**
 * Read an account's freight default, falling back when it has none.
 *
 * `rateToUsd` looks up a currency in the live rate table. A currency it does
 * not carry falls back to the fallback currency's rate rather than to 1,
 * because treating 85 yuan as 85 dollars would multiply freight sevenfold and
 * the markup would triple that.
 */
export function shopFreightDefaultFrom(
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

/** What the shop charges per kilo, in the currency a tea was bought in. */
export function shopRateInCurrency(shopDefaultPerKgUsd: number, rateToUsd: number): number {
  const rate = rateToUsd > 0 ? rateToUsd : 1;
  return shopDefaultPerKgUsd * rate;
}

/**
 * The rate to show and edit for one tea, in USD.
 *
 * A tea with nothing recorded shows the shop default rather than a blank or a
 * zero: it is what the tea is actually being charged, so it is what the
 * operator should see. An entered rate is shown as entered, zero included.
 */
export function shippingRateUsdFor(
  storedRatePerKg: number | null | undefined,
  rateToUsd: number,
  shopDefaultPerKgUsd: number,
): number {
  const rate = rateToUsd > 0 ? rateToUsd : 1;
  if (storedRatePerKg === null || storedRatePerKg === undefined) return shopDefaultPerKgUsd;
  const stored = Number(storedRatePerKg);
  if (!Number.isFinite(stored)) return shopDefaultPerKgUsd;
  return stored / rate;
}
