import { useMemo } from 'react';
import { useAppStore } from '../lib/store';

/**
 * Returns how many times a given tea has been tasted,
 * based on the local tasting journal in the app store.
 * Purely client-side — no backend needed.
 */
export function useTastingCount(teaId: string): number {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  return useMemo(
    () => tastingJournal.filter((t) => t.teaId === teaId).length,
    [tastingJournal, teaId]
  );
}

/**
 * Returns a Map of teaId → tasting count for all teas in the journal.
 * More efficient than calling useTastingCount per-card in a list.
 */
export function useTastingCounts(): Map<string, number> {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of tastingJournal) {
      counts.set(entry.teaId, (counts.get(entry.teaId) || 0) + 1);
    }
    return counts;
  }, [tastingJournal]);
}
