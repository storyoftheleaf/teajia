/**
 * Centralized number formatting for consistent display across the site.
 *
 * All numeric output should go through these helpers so every price,
 * quantity, and year looks the same — clean, aligned, modern.
 *
 * Pair with the CSS class `num` (font-mono tabular-nums lining-nums)
 * for a uniform visual treatment in JetBrains Mono.
 */

/** Format a USD price: "$12.50", "$1,250.00" */
export function fmtPrice(amount: number, decimals = 2): string {
  return '$' + fmtNum(amount, decimals);
}

/** Customer-facing price — always rounded up to whole dollars: "$13", "$1,250" */
export function fmtShopPrice(amount: number): string {
  return '$' + fmtNum(Math.ceil(amount), 0);
}

/** Customer-facing price-per-gram — rounded up to whole cents: "$0.85/g" */
export function fmtShopPricePerGram(amount: number): string {
  const cents = Math.ceil(amount * 100) / 100;
  return '$' + fmtNum(cents, 2) + '/g';
}

/** Format a price-per-gram: "$0.85/g" */
export function fmtPricePerGram(amount: number, decimals = 2): string {
  return fmtPrice(amount, decimals) + '/g';
}

/**
 * Format a plain number with consistent grouping and decimals.
 * "1250" → "1,250.00", "3.5" → "3.50"
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

/** Format a large dollar amount without cents: "$12,500" */
export function fmtDollars(amount: number): string {
  return '$' + fmtNum(amount, 0);
}

/** Format a contextual portion price: "$7.00 / 25g" */
export function fmtPortionPrice(pricePerGram: number, grams = 25): string {
  const total = pricePerGram * grams;
  return fmtPrice(total) + ' / ' + grams + 'g';
}
