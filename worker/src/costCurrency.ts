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
