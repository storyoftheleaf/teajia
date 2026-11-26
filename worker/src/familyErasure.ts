/**
 * What deleting a person does to what they shared with the family.
 *
 * The family tables point at the person (member_tasting_shares,
 * member_photographs, member_tea_covers, tasting_note_candidates, and the
 * page in contributors), so deleting the user row alone fails on a foreign
 * key and the whole deletion rolls back, leaving every share public. These
 * statements run first, in the same batch as the deletion:
 *
 * - their tasting shares, photographs and tea covers are deleted;
 * - quotes they offered, and the approved quotes made from them, are deleted,
 *   so nothing of theirs stays on Home or a tea listing;
 * - the shop's decisions they made on other people's photographs and quotes
 *   keep the decision and lose the name;
 * - their page is unpublished and unlinked from them, so it stops showing and
 *   anything the shop wrote on it stays for the shop to decide.
 *
 * Photograph files are listed by familyPhotoKeysForUser before the batch so the
 * caller can remove them from storage once the rows are gone.
 */
import { teaTableErasureStatements } from './teaTable';
import { knowThisTeaErasureStatements, knowThisTeaPhotoKeys } from './knowThisTea';

/** The storage keys of every photograph the person added to the family. */
export async function familyPhotoKeysForUser(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db.prepare(
    'SELECT full_key, small_key FROM member_photographs WHERE author_user_id = ?',
  ).bind(userId).all<{ full_key: string; small_key: string }>();
  // Their "Does anyone know this tea?" photographs go too.
  const questions = await knowThisTeaPhotoKeys(db, userId);
  return [...(results ?? []).flatMap(row => [row.full_key, row.small_key]), ...questions].filter(Boolean);
}

/** Statements to run before the person's journal and user row are deleted. */
export function familyErasureStatements(db: D1Database, userId: string): D1PreparedStatement[] {
  const theirCandidates = 'SELECT id FROM tasting_note_candidates WHERE author_user_id = ?';
  return [
    db.prepare(`DELETE FROM product_impressions WHERE candidate_id IN (${theirCandidates})`).bind(userId),
    db.prepare('DELETE FROM tasting_note_candidates WHERE author_user_id = ?').bind(userId),
    db.prepare('UPDATE tasting_note_candidates SET promoted_by = NULL WHERE promoted_by = ?').bind(userId),
    db.prepare('UPDATE tasting_note_candidates SET dismissed_by = NULL WHERE dismissed_by = ?').bind(userId),
    // Their keeps and holds, and anyone's keeps and holds on their tastings, go before the shares do.
    ...teaTableErasureStatements(db, userId),
    // Their questions on the Tea Table, the notes on them, and the notes they wrote to others.
    ...knowThisTeaErasureStatements(db, userId),
    db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').bind(userId),
    db.prepare('DELETE FROM member_tea_covers WHERE author_user_id = ?').bind(userId),
    db.prepare(
      'DELETE FROM member_tea_covers WHERE photograph_id IN (SELECT id FROM member_photographs WHERE author_user_id = ?)',
    ).bind(userId),
    db.prepare('DELETE FROM member_photographs WHERE author_user_id = ?').bind(userId),
    db.prepare('UPDATE member_photographs SET shop_decided_by = NULL WHERE shop_decided_by = ?').bind(userId),
    db.prepare(
      `UPDATE contributors
          SET user_id = NULL, is_published = 0, unpublished_at = COALESCE(unpublished_at, datetime('now')), updated_at = datetime('now')
        WHERE user_id = ?`,
    ).bind(userId),
  ];
}

/** Removes the person's photograph files after their rows are gone. A failure leaves files unreachable but stored. */
export async function eraseFamilyPhotoFiles(bucket: R2Bucket | undefined, keys: string[]): Promise<void> {
  if (!bucket || keys.length === 0) return;
  try {
    for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
  } catch {
    // The rows are already gone, so the media door refuses these keys without a signature.
  }
}
