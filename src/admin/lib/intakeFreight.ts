/**
 * Who carries a share of the shipping, and who cannot be given one.
 *
 * An intake spreads one shipping total across the staged lines by size, and
 * each line's share has to be expressed in that line's own currency before it
 * can be folded into its cost. When the shop has no rate for one of those two
 * currencies, there is no honest figure to fold in, and what the workspace must
 * not do is fold in nothing and say nothing.
 *
 * It did. The converter answered NaN, with a comment saying that surfaces as a
 * dash; the only reader was `stagedToProduct(it, extra)`, which takes
 * `extraCost || 0`, and NaN is falsy. So the line was stored at its bare
 * purchase price with its whole share of the freight missing, cheaper than it
 * was bought, in silence. That is the shape of every money bug in this shop: a
 * missing cost looks exactly like a cheap tea.
 *
 * So the answer is a refusal the caller has to handle, and it lives out here
 * rather than inside the workspace because a rule nothing can call is a rule
 * nothing can check. `src/admin/lib/csvImportRows.ts` says the same thing about
 * the same class of bug, and for the same reason.
 */

import { rateToUsd, sameCurrency, type RateRow } from '../../lib/currency';

/** A line that can carry its share, and the share in its own currency. */
export interface PricedLine<T> {
  it: T;
  extra: number;
}

export interface FreightSplit<T> {
  /** The lines to send, each with the share it carries. */
  priced: PricedLine<T>[];
  /** Currency to how many lines were refused for want of a rate for it. */
  unconvertible: Map<string, number>;
}

/**
 * One amount of money read in another currency, or null when it cannot be.
 *
 * Nothing to convert and the same money either side both answer without asking
 * for a rate, which is what carries the ordinary single-currency import when
 * the rates have not loaded yet, and the `UNK` case, where the share stays in
 * the shipping currency because nobody said what the tea was paid in.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: readonly RateRow[] | null | undefined,
): number | null {
  if (!amount) return 0;
  if (sameCurrency(from, to)) return amount;
  const fromRate = rateToUsd(rates, from);
  const toRate = rateToUsd(rates, to);
  if (fromRate === null || toRate === null) return null;
  return (amount / fromRate) * toRate;
}

/**
 * Split staged lines into the ones that can carry their freight and the rest.
 *
 * A line with `UNK` for a currency takes its share in the shipping currency,
 * which is this shop's older reading of a cost nobody wrote a currency on and
 * is left exactly as it was.
 */
export function splitByConvertibleFreight<T extends { costCurrency: string }>(
  items: readonly T[],
  shipCurrency: string,
  shareOf: (it: T) => number,
  rates: readonly RateRow[] | null | undefined,
): FreightSplit<T> {
  const priced: PricedLine<T>[] = [];
  const unconvertible = new Map<string, number>();
  for (const it of items) {
    const target = it.costCurrency === 'UNK' ? shipCurrency : it.costCurrency;
    const extra = convertAmount(shareOf(it), shipCurrency, target, rates);
    if (extra === null) unconvertible.set(target, (unconvertible.get(target) ?? 0) + 1);
    else priced.push({ it, extra });
  }
  return { priced, unconvertible };
}

/** What to tell the operator, in the words of the thing they have to fix. */
export function freightRefusalWords(unconvertible: ReadonlyMap<string, number>): string {
  const named = [...unconvertible.entries()]
    .map(([cur, n]) => `${n} ${n === 1 ? 'line' : 'lines'} in ${cur}`)
    .join(', ');
  return `The shop has no exchange rate for ${named}, so their share of the shipping could not be worked out. `
    + 'Set a rate on the Currency page, or correct the currency on those lines, then import them again.';
}
