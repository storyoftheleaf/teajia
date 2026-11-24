// Who may sell from their own Tea Chest (Adrian, 2026-11-24: "Only people I
// approve"). A shop account is never affected. A personal account sells only
// while it carries Adrian's approval: until then nothing of theirs is buyable
// or priced in public, and a tea of theirs poured at a sit shows unpriced.
// Every public door reads the same rule from here.

/** True for a shop account, and for a personal account Adrian approved. */
export const personalSellerApprovedSql = (account: string) =>
  `(${account}.personal_inventory_user_id IS NULL OR ${account}.personal_seller_approved_at IS NOT NULL)`;

/** What an unapproved person sees when they try to offer a tea. Calm, never an error. */
export { PERSONAL_SELLER_WAITING } from '../../shared/personalSeller';
export const PERSONAL_SELLER_WAITING_CODE = 'personal_seller_not_approved';

export async function personalSellerApproved(db: D1Database, accountId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 FROM accounts a WHERE a.id = ? AND ${personalSellerApprovedSql('a')}`)
    .bind(accountId).first();
  return Boolean(row);
}

/**
 * Approve or withdraw one person. The caller has already checked that the
 * actor is the platform owner. Every public door reads the mark, so on
 * withdrawal their offers leave public view at once; holdings, offers,
 * orders and the shop setting stay as they were.
 */
export async function setPersonalSellerApproval(db: D1Database, userId: string, approved: boolean, actorId: string) {
  // The approval lives on the person (0121), so it can be given before they
  // open a Tea Chest; any Tea Chest they already have gets the same mark.
  const now = new Date().toISOString();
  const [person] = await db.batch([
    db.prepare(approved
      ? 'UPDATE users SET seller_approved_at = COALESCE(seller_approved_at, ?), seller_approved_by = COALESCE(seller_approved_by, ?) WHERE id = ?'
      : 'UPDATE users SET seller_approved_at = NULL, seller_approved_by = NULL WHERE id = ?',
    ).bind(...(approved ? [now, actorId, userId] : [userId])),
    db.prepare(approved
      ? `UPDATE accounts SET personal_seller_approved_at = COALESCE(personal_seller_approved_at, ?), personal_seller_approved_by = COALESCE(personal_seller_approved_by, ?)
         WHERE personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id`
      : `UPDATE accounts SET personal_seller_approved_at = NULL, personal_seller_approved_by = NULL
         WHERE personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id`,
    ).bind(...(approved ? [now, actorId, userId] : [userId])),
  ]);
  if (!person.meta?.changes) return null;
  return { approved };
}
