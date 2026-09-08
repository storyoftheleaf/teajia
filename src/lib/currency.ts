/**
 * One alias map, and one way to turn a stored currency into a rate.
 *
 * The exchange table does not key by ISO code: CNY is 'Yuan' and TWD is 'NT',
 * for historical reasons that are now load-bearing across the whole catalogue.
 * So a cost recorded as 'CNY' is the same money as a cost recorded as 'Yuan',
 * and anything that compares the two as strings gets it wrong.
 *
 * The worker already knew this and canonicalised. The admin did not: it looked
 * the currency up with an exact `===` and fell back to a rate of 1, at eleven
 * separate sites. A rate of 1 does not fail. It reads a yuan cost as dollars,
 * hands back a figure nearly seven times too big, and the markup triples it.
 * That is why this module refuses to return 1 for a currency it cannot resolve:
 * `rateToUsd` returns null, and the surface shows a dash. A dash is the one
 * honest thing to show when the alternative is a wrong number.
 *
 * It lives under `src/` and the worker imports it, which is the direction this
 * build already allows: eight worker modules import from `src/` today and
 * nothing in `src/` imports from `worker/`. So this is one home, not a second
 * copy kept in step by a guard test, which is what the markup and the freight
 * fallback have to do.
 */

/**
 * Every spelling of a currency that means one of the shop's keys.
 *
 * Lower-cased on both sides, so casing is not part of the answer: 'CNY',
 * 'cny' and 'Cny' are all the same instruction. Anything absent from here is
 * passed through unchanged, because a currency the shop keys under its own
 * name (USD, HKD, AUD) needs no translation.
 */
export const CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  cny: 'Yuan',
  rmb: 'Yuan',
  renminbi: 'Yuan',
  yuan: 'Yuan',
  'yuán': 'Yuan',
  '¥': 'Yuan',
  '￥': 'Yuan',
  'cn¥': 'Yuan',
  cnh: 'Yuan', // offshore yuan, same rate family
  twd: 'NT',
  'nt$': 'NT',
  mop: 'HKD', // the Macau pataca trades near the HK dollar
};

/** The stored spelling turned into the key the exchange table uses. */
export function canonicalCurrency(cur: string | null | undefined): string | null {
  if (!cur) return null;
  const trimmed = String(cur).trim();
  if (!trimmed) return null;
  return CURRENCY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** Do two stored currencies name the same money, whatever they are spelled? */
export function sameCurrency(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = canonicalCurrency(a);
  const right = canonicalCurrency(b);
  if (left === null || right === null) return left === right;
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * The ISO code for a shop key, for anything that formats money.
 *
 * `Intl.NumberFormat` refuses 'Yuan' and 'NT' outright, which is a thrown
 * RangeError inside a PDF render, not a wrong number. The shop keys those two
 * under its own names, so this is the translation back out for display, and
 * for a currency with no ISO code at all it says USD, which is what the figure
 * beside it will be.
 */
export function isoCurrencyCode(currency: string | null | undefined): string {
  const key = canonicalCurrency(currency);
  if (!key) return 'USD';
  if (key === 'NT') return 'TWD';
  if (key === 'Yuan') return 'CNY';
  if (key === 'UNK') return 'USD';
  return /^[A-Za-z]{3}$/.test(key) ? key.toUpperCase() : 'USD';
}

/** The shape every rate list in the app shares. */
export interface RateRow {
  currency: string;
  rateToUSD: number;
}

/**
 * Units of `currency` per one US dollar, or null.
 *
 * Null means the shop has no rate for this money, and the caller must show a
 * dash rather than a number. It must never be read as 1. Exact key first, then
 * case-insensitively, then through the alias map, which is the same order the
 * worker's `lookupRateToUsd` uses so the admin's preview and the shelf agree.
 */
export function rateToUsd(
  rates: readonly RateRow[] | null | undefined,
  currency: string | null | undefined,
): number | null {
  const canonical = canonicalCurrency(currency);
  if (!canonical || !rates) return null;
  const usable = (row: RateRow | undefined) =>
    row && Number.isFinite(row.rateToUSD) && row.rateToUSD > 0 ? row.rateToUSD : null;
  const exact = usable(rates.find((r) => r.currency === canonical));
  if (exact !== null) return exact;
  const lc = canonical.toLowerCase();
  return usable(rates.find((r) => String(r.currency).toLowerCase() === lc));
}
