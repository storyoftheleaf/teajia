/**
 * Centralized number formatting for consistent display across the site.
 *
 * All numeric output should go through these helpers so every price,
 * quantity, and year looks the same: clean, aligned, modern.
 *
 * Pair with the CSS class `num` (font-mono tabular-nums lining-nums)
 * for a uniform visual treatment.
 */

/**
 * ── The record-currency formatters ──────────────────────────────────────────
 *
 * `fmtRecordPricePerGram` and `fmtRecordDollars` print dollars,
 * unconditionally, and that is their whole job.
 *
 * The `$` is not a formatting choice here, it is a statement that the figure is
 * in the shop's record currency. That is right for structured data, an
 * operator's books and an order reference, and wrong for anything a shopping
 * reader looks at, because the reader chose a currency and the cart has honoured
 * it since long before the rest of the shop did.
 *
 * Round six gave the product page and the shop card `useShopPrice`. Round seven
 * finished the sweep: the compare view, the saved-teas card, both collection
 * surfaces and the quick-add sheet all called straight into these and so stayed
 * dollar-only, which meant a reader browsing in Rupiah met dollars the moment
 * they saved a tea, compared two, or opened a collection someone had shared
 * with them.
 *
 * Round nine closed the door behind that sweep, because a comment is not a
 * guard. Three things changed:
 *
 *   1. The names say what they are for. `fmtPrice` and `fmtPricePerGram` read
 *      like the default way to print a price, which is exactly how they kept
 *      being picked up. `fmtRecord*` reads like a decision.
 *   2. `fmtPrice` is no longer exported. It has no callers outside this file
 *      and is only the delegate for the per-gram form.
 *   3. lint-colors.sh blocks any import of a `fmtRecord*` name from outside the
 *      record and admin paths (src/admin, src/components/admin-*, the ledger
 *      and PDF surfaces, worker). A customer-facing file that wants one now
 *      fails the commit rather than shipping dollars to someone reading in
 *      Rupiah.
 *
 * Round nine left one hole in that: `fmtDollars` survived as a deprecated alias
 * for `fmtRecordDollars`, because the six call sites that still used it were in
 * the admin tree and out of scope. An alias undoes point 1 by itself. Whoever
 * reaches for a name that reads like the default way to print a total is not
 * making the decision the rename exists to force, and a deprecation comment is
 * not a guard any more than the original comment was. Round ten moved the six
 * (four in admin/DashboardView, one each in the two admin-overlay files) and
 * deleted the alias.
 *
 * If you are writing a price a customer will read, use `useShopPrice` from
 * components/shop/shopPrice. If you are writing a price into markup, a ledger
 * or an invoice, use these.
 */

/** Format a USD price: "$12.50", "$1,250.00". Record currency, module-private. */
function fmtPrice(amount: number, decimals = 2): string {
  return '$' + fmtNum(amount, decimals);
}

/** Customer-facing price, always rounded up to whole dollars: "$13", "$1,250" */
export function fmtShopPrice(amount: number): string {
  return '$' + fmtNum(Math.ceil(amount), 0);
}

/** Customer-facing price-per-gram, rounded up to whole cents: "$0.85/g" */
export function fmtShopPricePerGram(amount: number): string {
  const cents = Math.ceil(amount * 100) / 100;
  return '$' + fmtNum(cents, 2) + '/g';
}

/** Record-currency price-per-gram: "$0.85/g". Books, ledgers, invoices only. */
export function fmtRecordPricePerGram(amount: number, decimals = 2): string {
  return fmtPrice(amount, decimals) + '/g';
}

/**
 * Format a plain number with consistent grouping and decimals.
 * "1250" becomes "1,250.00", "3.5" becomes "3.50".
 */
export function fmtNum(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format grams: "100g", "1,250g" */
export function fmtGrams(grams: number): string {
  return fmtNum(grams, 0) + 'g';
}

/** Format a year without commas: "2023" (not "2,023") */
export function fmtYear(year: number | string | undefined): string {
  if (!year) return '-';
  return String(year);
}

/** Format a percentage: "16.7%" */
export function fmtPct(value: number, decimals = 1): string {
  return fmtNum(value, decimals) + '%';
}

/** Record-currency dollar total without cents: "$12,500". Books and KPIs only. */
export function fmtRecordDollars(amount: number): string {
  return '$' + fmtNum(amount, 0);
}
