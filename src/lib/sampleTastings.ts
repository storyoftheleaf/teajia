/**
 * Put a tasting into a sample's list: replace the record with the same id (keeping
 * its original createdAt), otherwise append. A second save in one opening of the
 * tasting then updates the tasting instead of adding another.
 */
export function upsertTastingById<T extends { id: string; createdAt: string }>(list: readonly T[] | undefined, tasting: T): T[] {
  const current = list ?? [];
  const index = current.findIndex(t => t.id === tasting.id);
  if (index < 0) return [...current, tasting];
  return current.map((t, i) => i === index ? { ...tasting, createdAt: t.createdAt } : t);
}
