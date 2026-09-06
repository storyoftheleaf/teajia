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
 * What a curator's own listing multiplies by when its row says nothing.
 *
 * Deliberately NOT the shop markup, and deliberately left at the figure that
 * was already in the code, because changing it would change what curators
 * charge and nobody has asked for that. It is named here rather than left as a
 * bare `?? 2.5` so that the difference is a decision somebody can find and
 * question, instead of a literal two thousand lines into a route.
 *
 * Worth questioning: `products.markup_multiplier` also DEFAULTS to 2.5, so this
 * fallback almost never fires, and the column's default is itself a copied
 * default of exactly the kind this module exists to stop. Recorded in TODO.md.
 */
export const CURATOR_FALLBACK_MARKUP = 2.5;
