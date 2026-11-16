/** AddProductModal opens the tasting for a product that does not exist yet with the
 *  id 'new'. A tasting with no real id has nothing to file under in the personal
 *  journal, or every such tasting lands in one entry. */
export const UNSAVED_ITEM_ID = 'new';

export function hasJournalItemId(id: string | null | undefined): boolean {
  const trimmed = id?.trim();
  return !!trimmed && trimmed !== UNSAVED_ITEM_ID;
}
