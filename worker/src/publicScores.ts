/**
 * A score is personal: it stays with the person who gave it. Anything read by
 * someone else carries words, never a number or a verdict: the shop's own
 * score on a tea, a member's review score, a taster's sample score.
 *
 * The scrubber itself lives in src/lib/tastingScores.ts so the app and the
 * Worker strip the same keys.
 */
export { TASTING_SCORE_KEYS, tastingWithoutScores, tastingJsonWithoutScores, tastingScoresOnly } from '../../src/lib/tastingScores';

/**
 * The columns of a network review that someone other than its writer may see.
 * The score (`rating`) and the verdict words (`verdict`, `would_buy`) are not
 * among them; `tasting` is read through tastingWithoutScores before it leaves.
 */
export const PUBLIC_TEA_REVIEW_COLUMNS = [
  'id', 'tea_key', 'product_id', 'product_account_id', 'author_user_id', 'author_account_id', 'visibility',
  'session_date', 'notes', 'tasting', 'brew_params', 'created_at', 'updated_at', 'profile_id', 'voice_notes',
  'source_sample_id', 'status',
].map(column => `r.${column}`).join(', ');

/**
 * Whether this person is the shop's owner, whose score a shop's own tea
 * carries. Anything unreadable answers no, so a score stays where it was given.
 */
export async function isShopOwner(db: D1Database, accountId: string, userId: unknown): Promise<boolean> {
  if (typeof userId !== 'string' || !userId) return false;
  try {
    const row = await db.prepare('SELECT owner_user_id FROM accounts WHERE id = ?').bind(accountId).first<{ owner_user_id: string | null }>();
    return row?.owner_user_id === userId;
  } catch {
    return false;
  }
}
