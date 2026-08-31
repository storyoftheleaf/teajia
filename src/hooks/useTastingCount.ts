import { useMemo } from 'react';
import { useAppStore } from '../lib/store';
import type { CustomerTasting } from '../types';

/**
 * How many times this tea has been tasted (counts the `tastings` array on the
 * single entry per productId). 0 means no entry exists yet.
 */
export function useTastingCount(productId: string): number {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  return useMemo(() => {
    const entry = tastingJournal.find((t) => t.productId === productId && !t.archived);
    return entry ? entry.tastings.length : 0;
  }, [tastingJournal, productId]);
}

/**
 * Map of productId → number of recorded tastings on that entry. Excludes
 * archived entries.
 */
export function useTastingCounts(): Map<string, number> {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of tastingJournal) {
      if (entry.archived) continue;
      counts.set(entry.productId, entry.tastings.length);
    }
    return counts;
  }, [tastingJournal]);
}

/**
 * This tea's tasting entry for the signed-in reader, or null.
 *
 * One entry per (reader, product): the plate on the product page shows what
 * the reader wrote and offers to edit it, rather than offering to write a
 * second one. Archived entries read as absent, the same way the count does.
 */
export function useTastingEntry(productId: string): CustomerTasting | null {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  return useMemo(
    () => tastingJournal.find((t) => t.productId === productId && !t.archived) ?? null,
    [tastingJournal, productId],
  );
}
