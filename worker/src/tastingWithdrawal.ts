/**
 * Taking a shared tasting back (A4 review, findings 1 and 3, 2026-11-26).
 *
 * Adrian's rule: "A person can take their own item off and the owner can hide
 * any item", and a withdrawn item is gone from every place. One batch does it,
 * used by Keep private on the Share step and by taking a tasting off the Tea
 * Table when the table was the only reason it was public:
 * - the tasting goes private, and off the Tea Table, with its holds;
 * - every photograph of it still on the person's page goes private, and one
 *   the shop placed or made the lead steps back off the tea page;
 * - its offered and approved quotes leave Home and the tea listing.
 */

/**
 * Takes one tasting's offered quotes back, as DELETE
 * /api/tasting-journal/:id/offers/:noteKey does for one: the approved quote
 * leaves Home and the tea listing, and the offer leaves the shop's pile.
 */
export function withdrawTastingQuotes(db: D1Database, journalEntryId: string, authorUserId: string): D1PreparedStatement[] {
  const offered = `SELECT id FROM tasting_note_candidates WHERE journal_entry_id = ? AND author_user_id = ? AND offered_at IS NOT NULL`;
  return [
    db.prepare(`DELETE FROM product_impressions WHERE candidate_id IN (${offered})`).bind(journalEntryId, authorUserId),
    db.prepare(`DELETE FROM tasting_note_candidates WHERE id IN (${offered})`).bind(journalEntryId, authorUserId),
  ];
}

/** Statements that make one shared tasting private everywhere. The share row must already exist. */
export function withdrawTastingShare(
  db: D1Database, journalEntryId: string, authorUserId: string, productId: string,
): D1PreparedStatement[] {
  return [
    db.prepare(
      `UPDATE member_tasting_shares
          SET share_state = 'private', tea_table_at = NULL, tea_table_sittings = NULL, page_alone_at = NULL,
              updated_at = datetime('now')
        WHERE journal_entry_id = ? AND author_user_id = ?`,
    ).bind(journalEntryId, authorUserId),
    db.prepare(
      `UPDATE member_photographs
          SET share_state = 'private',
              shop_use = CASE WHEN shop_use IN ('placed', 'lead') THEN 'none' ELSE shop_use END,
              shop_use_before_lead = NULL,
              journal_entry_id = COALESCE(journal_entry_id, ?1),
              updated_at = datetime('now')
        WHERE author_user_id = ?2 AND product_id = ?3 AND removed_by_member_at IS NULL`,
    ).bind(journalEntryId, authorUserId, productId),
    db.prepare(`DELETE FROM tea_table_holds WHERE item_kind = 'tasting' AND item_id = ?`).bind(journalEntryId),
    ...withdrawTastingQuotes(db, journalEntryId, authorUserId),
  ];
}
