/** A first name only, and only when the photographer allowed it. */
export function photographBy(row: { credit_name_shown?: number | null }, authorName: string | null | undefined): string | null {
  if (Number(row.credit_name_shown) !== 1) return null;
  return (authorName ?? '').trim().split(/\s+/)[0] || null;
}
