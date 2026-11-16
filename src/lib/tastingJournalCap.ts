import type { CustomerTasting } from '../types';

/**
 * The local journal is kept to about 100 teas so localStorage stays small, but
 * the cap only ever removes entries the shop already holds (`synced`), which
 * come back on the next pull. An unsynced entry, and every entry a guest has
 * (a guest never syncs), is kept however long the list grows: dropping one
 * would delete a tasting that exists nowhere else.
 *
 * The list is newest first, so synced entries are dropped from the end.
 */
export const TASTING_JOURNAL_SYNCED_CAP = 100;

export function capTastingJournal(journal: CustomerTasting[], cap = TASTING_JOURNAL_SYNCED_CAP): CustomerTasting[] {
  let excess = journal.length - cap;
  if (excess <= 0) return journal;
  const kept: CustomerTasting[] = [];
  for (let i = journal.length - 1; i >= 0; i--) {
    const entry = journal[i];
    if (excess > 0 && entry.synced) { excess--; continue; }
    kept.push(entry);
  }
  return kept.reverse();
}
