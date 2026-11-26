/**
 * Numeric scores stay with the person who gave them and the shop that keeps
 * them. Anything read without signing in carries words, never a number: the
 * shop's own score on a tea, a member's review score, a taster's sample score.
 *
 * These are the score keys a tasting object can carry, old and new.
 */
const TASTING_SCORE_KEYS = ['quality', 'rating', 'aromaRating', 'finishRating'] as const;

/** A copy of a tasting object without its numeric scores. Anything that is not an object comes back as it was. */
export function tastingWithoutScores<T>(tasting: T): T {
  if (!tasting || typeof tasting !== 'object' || Array.isArray(tasting)) return tasting;
  const copy: Record<string, unknown> = { ...(tasting as Record<string, unknown>) };
  for (const key of TASTING_SCORE_KEYS) delete copy[key];
  return copy as T;
}

/**
 * The columns of a network review that a signed-out reader may see. The
 * score (`rating`) is not one of them; `tasting` is read through
 * tastingWithoutScores before it leaves.
 */
export const PUBLIC_TEA_REVIEW_COLUMNS = [
  'id', 'tea_key', 'product_id', 'product_account_id', 'author_user_id', 'author_account_id', 'visibility',
  'session_date', 'notes', 'tasting', 'brew_params', 'created_at', 'updated_at', 'profile_id', 'voice_notes',
  'source_sample_id', 'verdict', 'would_buy', 'status',
].map(column => `r.${column}`).join(', ');
