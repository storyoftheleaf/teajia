/**
 * The shop's markup, on the app side.
 *
 * The worker owns this number in `worker/src/markup.ts`; the two builds share
 * no module, so it is written twice and `worker/tests/markup.test.ts` fails if
 * the copies disagree. Same arrangement as the freight fallback, for the same
 * reason: the admin previews a price the worker will compute, and a preview
 * that disagrees with the shelf is worse than no preview.
 */

/** The leaf's cost times this, then freight added at cost (Adrian, 2026-11-27). */
export const SHOP_MARKUP_MULTIPLIER = 3;
