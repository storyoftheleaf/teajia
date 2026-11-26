import { teaTableOpen } from '../../src/lib/teaTable';

/**
 * Quiet acknowledgement ("Photograph by", "Poured with", "Pours at tables")
 * opens with the Tea Table (A4 review, finding 11): while TEA_TABLE_OPEN is
 * off, no public answer carries photograph_by, poured_with or pours, and the
 * photographer's credit choice cannot be changed.
 */
export function acknowledgementOpen(env?: { TEA_TABLE_OPEN?: string } | null): boolean {
  return teaTableOpen(env);
}

/** A first name only, and only when the photographer allowed it. */
export function photographBy(row: { credit_name_shown?: number | null }, authorName: string | null | undefined): string | null {
  if (Number(row.credit_name_shown) !== 1) return null;
  return (authorName ?? '').trim().split(/\s+/)[0] || null;
}
