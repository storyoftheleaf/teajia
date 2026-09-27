/**
 * The server's cost refusals, in the words Adrian reads.
 *
 * The rule that a tea is not added without saying what it cost is enforced in
 * the worker, and the worker answers in the worker's vocabulary: column names,
 * and a `(missing: amount)` marker naming which half of the cost was not sent.
 * That marker is exactly right as a contract between two pieces of code and
 * exactly wrong on a screen. Column names are not words, and an operator told
 * that `cost_amount` is missing has been handed the bug report rather than the
 * thing to do next.
 *
 * So the server's string stays the source of truth for WHICH half is missing,
 * because that is a fact only the server has, and this is where it becomes a
 * sentence. The register is the Add Product form's: "What did this cost? Enter
 * 0 if it was a gift." A question, then the answer that is easy to miss.
 *
 * Anything that is not a cost refusal passes through untouched. The other
 * reason a row comes back refused is that the shop already has that tea, which
 * the server already says in plain words, and rewriting it here would put two
 * authors on one sentence.
 */

/** A tea arrived with no price at all. */
const NO_AMOUNT = 'What did this cost? Enter the price, or 0 if it was a gift.';

/** A price arrived with nothing to say what the number is in. */
const NO_CURRENCY = 'What currency was that price paid in? Pick one and try again.';

export function plainCostWords(serverMessage: unknown): string {
  const said = typeof serverMessage === 'string' ? serverMessage : '';
  /* The named half first, because the refusal for a missing amount quotes both
     column names in the same sentence and would otherwise match either test. */
  if (said.includes('missing: currency')) return NO_CURRENCY;
  if (said.includes('missing: amount')) return NO_AMOUNT;
  // Older refusals, and the update path, which names no half.
  if (said.includes('cost_currency alongside cost_amount')) return NO_CURRENCY;
  if (said.includes('cost_amount')) return NO_AMOUNT;
  return said;
}
