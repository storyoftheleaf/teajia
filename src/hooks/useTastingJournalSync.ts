import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { hydrateTastingJournal, syncTastingJournal } from '../lib/tastingJournalSync';
import { hasToken } from '../lib/api';

/**
 * Syncs the customer tasting journal between localStorage and D1.
 *
 * - On login: pulls server entries and merges with local (local unsynced wins).
 * - When journal changes while authenticated: debounces 2s then pushes unsynced entries.
 * - Unauthenticated users keep localStorage only.
 */
export function useTastingJournalSync(isAuthenticated: boolean) {
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  const hasFetchedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server on login / first mount when authenticated
  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current || justLoggedIn) {
      hasFetchedRef.current = true;
      hydrateTastingJournal().catch(() => {});
    }
  }, [isAuthenticated]);

  // Debounced push of unsynced entries after journal changes
  useEffect(() => {
    if (!isAuthenticated || !hasToken()) return;
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncTastingJournal().catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tastingJournal, isAuthenticated]);
}
