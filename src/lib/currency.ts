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
 * The shop's own spelling for each key it stores money under.
 *
 * Casing is part of the answer for two of them. The exchange table holds the
 * literal strings 'Yuan' and 'NT', and a rate lookup is a match on that column,
 * so 'yuan' is not the same row and 'nt' is not the same row. That is why this
 * list exists rather than an uppercase call: uppercasing is what wrote 'YUAN'
 * onto 22 teas.
 *
 * 'UNK' is not a currency. It is this codebase's sentinel for one nobody
 * recorded, and it is here so that a lower-cased 'unk' does not become a
 * spelling the sentinel check misses.
 */
export const SHOP_CURRENCY_KEYS: readonly string[] = [
  'USD', 'Yuan', 'NT', 'HKD', 'IDR', 'JPY', 'MYR', 'AUD', 'UNK',
];

/**
 * Every spelling of a currency that means one of the shop's keys.
 *
 * Lower-cased on the key side, so casing is not part of the question: 'CNY',
 * 'cny' and 'Cny' are all the same instruction. The value side is the shop's
 * own spelling, which IS the answer, because that is the string the exchange
 * table is keyed by.
 *
 * The symbol and shorthand rows came in from the two spreadsheet importers,
 * which each kept their own copy of this knowledge. A currency column reading
 * 'RM', 'Rp', 'HK$' or 'NTD' is a person naming money, and where it is named is
 * not what it means, so it is named once, here.
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
  ntd: 'NT',
  'nt$': 'NT',
  mop: 'HKD', // the Macau pataca trades near the HK dollar
  hk: 'HKD',
  'hk$': 'HKD',
  yen: 'JPY',
  en: 'JPY', // a sheet writing 'EN' in a currency column means yen
  rm: 'MYR',
  rp: 'IDR',
  'a$': 'AUD',
  $: 'USD',
  'us$': 'USD',
};

/** Lower-cased spelling to the shop's own, aliases and shop keys together. */
const CANONICAL_BY_LOWER: Readonly<Record<string, string>> = {
  ...Object.fromEntries(SHOP_CURRENCY_KEYS.map((k) => [k.toLowerCase(), k])),
  ...CURRENCY_ALIASES,
};

/**
 * The shop key this spelling names, or null when the shop has no key for it.
 *
 * The strict half of `canonicalCurrency`: it answers only for money the shop
 * actually recognises, which is what a spreadsheet importer needs before it
 * decides a cell is unreadable.
 */
export function knownCurrency(cur: string | null | undefined): string | null {
  if (!cur) return null;
  const trimmed = String(cur).trim();
  if (!trimmed) return null;
  return CANONICAL_BY_LOWER[trimmed.toLowerCase()] ?? null;
}

/**
 * The stored spelling turned into the key the exchange table uses.
 *
 * A recognised spelling comes back in the shop's own casing whatever was typed,
 * so 'hkd' is stored as 'HKD' and 'cny' as 'Yuan'. That matters because the
 * doors write this answer into `products.cost_currency` and read it back with a
 * string match: for a while the doors uppercased first and this function only
 * translated aliases, so 'hkd' was saved as 'hkd', a spelling no rate row
 * carries and no migration covers.
 *
 * An unrecognised spelling is uppercased and passed through. It is not silently
 * lower-cased and it is not invented: uppercase is the one shape that keeps a
 * new currency arriving in a form the table can later be taught, and the
 * surfaces still decline to price it because `rateToUsd` finds no row.
 */
export function canonicalCurrency(cur: string | null | undefined): string | null {
  if (!cur) return null;
  const trimmed = String(cur).trim();
  if (!trimmed) return null;
  return CANONICAL_BY_LOWER[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

/**
 * Did anybody write down what this cost was paid in?
 *
 * Blank, missing and the 'UNK' sentinel all mean nobody did, which by this
 * shop's older convention is dollars and converts at 1. That is a different
 * thing from a named currency the shop has no rate for, which converts at
 * nothing at all and prints a dash. Both readings look like "no rate" from a
 * distance, and telling them apart is the whole job of this function.
 */
export function isUnrecordedCurrency(cur: string | null | undefined): boolean {
  if (cur === null || cur === undefined) return true;
  const trimmed = String(cur).trim();
  return trimmed === '' || trimmed.toUpperCase() === 'UNK';
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

/**
 * Where a currency may be read out of free text, and never what it means.
 *
 * A spreadsheet writes money in prose: a price cell reading "700 NT$", a column
 * header reading "Unit Price (HK$)". Finding a spelling inside a sentence needs
 * care that an exact lookup does not, because 'NT' sits inside "internal" and
 * 'RM' inside "warm", so each spelling carries the boundary that makes it safe
 * to find. What each one MEANS is still `knownCurrency`'s answer and nobody
 * else's, which is why this sits beside the map rather than inside the two
 * importers that used to keep a copy of it each.
 *
 * Order is the order they are tried, and it is load-bearing: 'NT$' before
 * 'NT', so a Taiwan dollar sign is not read as a bare NT and then re-read.
 *
 * A bare '$' is deliberately absent. In free text it is as likely to be a US,
 * Hong Kong, Taiwan or Australian dollar, so it is read only from a currency
 * column, where somebody chose it as the whole answer.
 */
const FREE_TEXT_SPELLINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/NT\$/, 'NT$'],
  [/\bNTD?\b/, 'NT'],
  [/\bTWD\b/, 'TWD'],
  [/RMB/, 'RMB'],
  [/CNY/, 'CNY'],
  [/YUAN/, 'YUAN'],
  [/[¥￥]/, '¥'],
  [/HK\$/, 'HK$'],
  [/\bHKD\b/, 'HKD'],
  [/\bJPY\b/, 'JPY'],
  [/YEN/, 'YEN'],
  [/\bMYR\b/, 'MYR'],
  [/\bRM\b/, 'RM'],
  [/\bIDR\b/, 'IDR'],
  [/\bRP\b/, 'RP'],
  [/\bAUD\b/, 'AUD'],
  [/A\$/, 'A$'],
  [/US\$/, 'US$'],
  [/\bUSD\b/, 'USD'],
];

/** The shop key named somewhere inside a piece of text, or null. */
export function currencyInText(text: unknown): string | null {
  if (!text) return null;
  const haystack = String(text).toUpperCase();
  for (const [pattern, spelling] of FREE_TEXT_SPELLINGS) {
    if (pattern.test(haystack)) return knownCurrency(spelling);
  }
  return null;
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
