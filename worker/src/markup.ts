/**
 * What the shop multiplies a cost by, and the one place it is written.
 *
 * Adrian's rule is cost plus freight, times three. That number had four homes
 * before this file existed: `costPerUnitUSD * 3.0` in the worker's pricing,
 * `trueCostUSD * 3` in the admin's preview of the same price, a
 * `markup_multiplier` column on products defaulting to 2.5, and a `?? 2.5`
 * fallback in the create path. So the shelf ran at three, a column on every one
 * of those products said two and a half, and nothing reconciled them.
 *
 * This is the freight bug again, on a different number, and it was still live
 * while we were busy fixing freight. That is the whole reason this module is
 * one line of value and twenty of explanation: the failure is never the
 * arithmetic, it is the second copy.
 *
 * A default that is COPIED into rows becomes one independent fact per row, and
 * they drift. A default that is READ at use time stays one fact. Freight moved
 * from a constant to an account setting for that reason; the markup has not
 * been asked to vary, so it stays a constant, but it stays a constant in ONE
 * place.
 */

/** Cost plus freight, times this. Adrian's number. */
export const SHOP_MARKUP_MULTIPLIER = 3;

/**
 * The curator listing path reads `products.markup_multiplier` and falls back to
 * this when a row says nothing. It was 2.5 while the shop ran at three, so the
 * same tea carried two prices depending on which surface asked. Adrian settled
 * it on 2026-09-06: three, everywhere.
 *
 * Kept as a named export rather than deleted so the two call sites still read
 * something that says what it is, and so a future decision to let curators
 * price differently has a place to land instead of a literal typed into a
 * route. It is the shop markup today, and the test pins that.
 */
export const CURATOR_FALLBACK_MARKUP = SHOP_MARKUP_MULTIPLIER;
