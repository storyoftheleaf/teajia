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

/**
 * A stored per-product rate, on its way from the API into the admin's model.
 *
 * NULL means nobody entered one and the tea follows the shop rate. A number
 * means Adrian entered it and it is obeyed, zero included. Those two have to
 * stay tellable apart at this boundary, because the gold dot in the inventory
 * list is drawn from exactly this being null or not, and the dot is the only
 * thing separating a rate a tea owns from one it is borrowing.
 *
 * It exists as a named function because the obvious way to write it is
 * `Number(p.shipping_rate_per_kg) || 0`, which is what the admin did: every tea
 * following the shop rate arrived in the model pinned at zero, so the whole
 * shelf rendered with a gold dot and a title claiming a rate nobody had set.
 * `Number(null)` is 0 and 0 is falsy, so the natural code says "free" twice
 * over for a column whose honest answer is "nobody said".
 */
export function storedRatePerKg(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  rateToUsd: (currency: string) => number | null | undefined,
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
 * What the shop charges per kilo, in the currency a tea was bought in.
 *
 * Null when the tea's currency has no rate, because there is no honest figure
 * to give: multiplying by 1 would hand back a dollar number wearing a yuan
 * label, and the caller would store it.
 */
export function shopRateInCurrency(shopDefaultPerKgUsd: number, rateToUsd: number | null): number | null {
  if (rateToUsd === null || !(rateToUsd > 0)) return null;
  return shopDefaultPerKgUsd * rateToUsd;
}

/**
 * The rate to show and edit for one tea, in USD.
 *
 * A tea with nothing recorded shows the shop default rather than a blank or a
 * zero: it is what the tea is actually being charged, so it is what the
 * operator should see, and the shop default is already in dollars, so it needs
 * no rate at all. An entered rate is shown as entered, zero included.
 *
 * Null when the tea owns a rate and its currency has no rate to convert it
 * through. The stored figure is in the tea's own currency, so under a column
 * labelled in dollars the only honest output is a dash. Dividing by 1 printed
 * a pinned 85 yuan as $85.00, which is nearly seven times what it costs.
 */
export function shippingRateUsdFor(
  storedRatePerKg: number | null | undefined,
  rateToUsd: number | null,
  shopDefaultPerKgUsd: number,
): number | null {
  if (storedRatePerKg === null || storedRatePerKg === undefined) return shopDefaultPerKgUsd;
  const stored = Number(storedRatePerKg);
  if (!Number.isFinite(stored)) return shopDefaultPerKgUsd;
  if (rateToUsd === null || !(rateToUsd > 0)) return null;
  return stored / rateToUsd;
}
