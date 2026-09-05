/**
 * Which currencies the shop refreshes, and under what name.
 *
 * The exchange table does not key by ISO code: CNY is 'Yuan' and TWD is 'NT',
 * for historical reasons that are now load-bearing across the whole catalogue.
 * This map is the join between the feed's codes and the shop's, and it is also
 * the definition of "a currency this shop keeps current".
 *
 * That second job is why it lives in its own module. A currency absent from
 * here still works: a rate can be seeded or set by hand, prices compute, nothing
 * errors. It simply never changes again, while looking exactly like a live rate.
 * HKD sat outside this map for months and twenty-seven Hong Kong lots priced off
 * a seeded figure the entire time. So anything that lets someone *choose* a
 * currency — the shop's freight rate above all, which is converted to USD on
 * every request — checks it against this list first.
 */
export const FX_FEED_CURRENCY_MAP: Record<string, string> = {
  CNY: 'Yuan',
  TWD: 'NT',
  IDR: 'IDR',
  MYR: 'MYR',
  JPY: 'JPY',
  AUD: 'AUD',
  HKD: 'HKD',
  USD: 'USD',
};

/** The shop-side currency names the daily refresh actually keeps current. */
export const REFRESHED_CURRENCIES: ReadonlySet<string> = new Set(Object.values(FX_FEED_CURRENCY_MAP));

/**
 * Is this a currency the shop keeps current?
 *
 * Case-insensitive, because an operator typing 'yuan' means the 'Yuan' row and
 * refusing them on capitalisation would teach them to work around the check.
 */
export function isRefreshedCurrency(currency: string | null | undefined): boolean {
  if (!currency) return false;
  const lc = String(currency).trim().toLowerCase();
  for (const name of REFRESHED_CURRENCIES) {
    if (name.toLowerCase() === lc) return true;
  }
  return false;
}

/** The refreshed name matching a typed one, so what gets stored resolves later. */
export function refreshedCurrencyName(currency: string | null | undefined): string | null {
  if (!currency) return null;
  const lc = String(currency).trim().toLowerCase();
  for (const name of REFRESHED_CURRENCIES) {
    if (name.toLowerCase() === lc) return name;
  }
  return null;
}
