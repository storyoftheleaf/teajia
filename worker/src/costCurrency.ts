/**
 * A cost is an amount and a currency, or it is not a cost.
 *
 * This lives in its own module because the rule has to hold at every door, and
 * the doors cannot import each other: `index.ts` imports `mcp.ts`, so the shared
 * rule has to sit below both. It was written first in the REST path only, which
 * left `create_tea` free to invent dollars — the agent door being exactly the
 * one Adrian wanted to add teas through.
 *
 * `cost_currency` carries `DEFAULT 'USD'` in the schema, so a row that never
 * stated a currency is indistinguishable from one that chose dollars. Absence
 * answered with a guess, and the guess is worth whatever the exchange rate is: a
 * ¥1,200 invoice stored as $1,200 prices the tea sevenfold, and nothing objects,
 * because 1200 is a perfectly good number.
 */

/** The message every door gives, so the same refusal reads the same way. */
export const COST_CURRENCY_REQUIRED =
  'A cost needs the currency it was paid in. Send cost_currency alongside cost_amount.';

/**
 * Has a currency actually been stated?
 *
 * `UNK` is this codebase's sentinel for a currency nobody recorded, so it is not
 * an answer to "what is this cost in". Accepting it would make the rule a
 * formality that types dollars on your behalf.
 */
export function currencyStated(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed !== '' && trimmed.toUpperCase() !== 'UNK';
}

/**
 * Is this write setting an amount without anything to denominate it in?
 *
 * The row's existing currency counts: most edits move an amount on a tea whose
 * currency was settled long ago. What is refused is only the case where neither
 * the write nor the row has ever said, which is the only one that can quietly
 * invent a unit.
 *
 * A zero amount is not a cost, so it passes: clearing a cost should not require
 * naming a currency for the nothing that is left.
 */
export function costNeedsCurrency(opts: {
  amount: unknown;
  payloadCurrency: unknown;
  existingCurrency?: string | null;
}): boolean {
  const { amount } = opts;
  const settingAmount = amount !== null && amount !== undefined && Number(amount) !== 0;
  if (!settingAmount) return false;
  return !currencyStated(opts.payloadCurrency) && !currencyStated(opts.existingCurrency);
}

/**
 * What `cost_currency_source` records (migration 0014).
 *
 * `cost_currency` carries `DEFAULT 'USD'`, so on every row written before this
 * rule existed, "Adrian chose dollars" and "nobody was ever asked" are the same
 * three letters. That is not repairable from the row, and Adrian's own reading
 * of the shelf is that MOST of those teas were not paid for in dollars. So the
 * column does not try to fix the past; it makes the past legible, by marking
 * every row written from here forward as an actual answer. What is left
 * unmarked is the backlog, and it can then be found, counted and corrected.
 */
export const CURRENCY_SOURCE_STATED = 'stated';
/** Reconciled against a record of what was actually paid, not merely typed. */
export const CURRENCY_SOURCE_RECOVERED = 'recovered';

/**
 * Mark a write as having stated its currency.
 *
 * Server-side only, and the caller's own value is dropped first: provenance a
 * caller can set is not provenance. `'stated'` has to mean "a currency arrived
 * with this write", which is a fact this process observed, not a claim it was
 * handed. The parallel `tasting_source` is deliberately caller-settable because
 * community aggregation needs to say whose voice a tasting is; nothing needs to
 * say that on Adrian's behalf about a currency.
 */
export function stampCostCurrencySource(body: Record<string, unknown>): void {
  delete body.cost_currency_source;
  if (currencyStated(body.cost_currency)) body.cost_currency_source = CURRENCY_SOURCE_STATED;
}
