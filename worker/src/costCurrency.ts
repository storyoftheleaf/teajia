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

/**
 * A tea cannot be added without saying what it cost.
 *
 * `costNeedsCurrency` above answers a narrower question: an amount that is
 * being written needs a unit. It deliberately lets a write with NO amount
 * through, because most edits do not touch the cost. On CREATE that leniency is
 * the whole problem, because the column is `cost_amount REAL DEFAULT 0`: a
 * create that simply omits the field does not fail, it stores ZERO, and zero is
 * a free tea. The shelf then prices it at zero times three.
 *
 * Nothing about that reads as a fault. A missing cost looks exactly like a
 * cheap tea, which is why the identical shape went unnoticed on freight until
 * it had cost real money. Adrian's instruction is that the price is not
 * optional when he adds a tea, and that the agent door is not allowed a lesser
 * requirement than the form.
 *
 * WHAT IS REFUSED IS ABSENCE, NOT ZERO. A tea that genuinely cost nothing is a
 * real thing: a gift, a sample sent by a vendor. Typing 0 says so and is
 * accepted. Leaving the field alone says nothing and is refused. That is the
 * same rule `enteredNumber()` enforces on every admin edit, applied at the one
 * moment a row comes into existence, and it is the reason a door may not
 * convert a blank into a number on the way here: `parseFloat(x) || 0` turns
 * "he did not say" into "it was free" before this function ever sees it.
 *
 * The three intake doors are deliberately NOT held to this. A receipt proposal,
 * a cellar placement and an inbound import each land a tea whose cost this shop
 * genuinely does not know, and forcing them to invent one would be worse than
 * the bug. They must write NULL, which means "not recorded", rather than let
 * the column's default answer 0, which means "free".
 */
export const COST_REQUIRED_ON_CREATE =
  'A tea needs what it cost. Send cost_amount (0 is a valid answer for a gift; leaving it out is not) '
  + 'and cost_currency.';

/** Which half is missing, or null when the create may proceed. */
export function createMissingCost(opts: {
  amount: unknown;
  currency: unknown;
}): 'amount' | 'currency' | null {
  const { amount } = opts;
  /* Absent, or a blank that a form would have turned into 0. Number('') is 0
     and so is Number(null), so the check has to happen before the conversion,
     not after it. */
  if (amount === null || amount === undefined) return 'amount';
  if (typeof amount === 'string' && amount.trim() === '') return 'amount';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return 'amount';
  if (numeric < 0) return 'amount';
  if (!currencyStated(opts.currency)) return 'currency';
  return null;
}
