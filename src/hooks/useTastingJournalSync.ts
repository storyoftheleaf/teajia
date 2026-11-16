import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { hydrateTastingJournal, retryPendingJournalSync, syncTastingJournal } from '../lib/tastingJournalSync';
import { hasToken } from '../lib/api';

/**
 * Syncs the customer tasting journal between localStorage and D1.
 *
 * - On login: pulls server entries and merges with local (local unsynced wins).
 * - When journal changes while authenticated: debounces 2s then pushes unsynced entries.
 * - A push that failed is tried again when the browser comes back online and
 *   when the tab regains focus.
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

  // Retry a failed push on reconnect and on focus. Guests have no listener,
  // and the retry itself also refuses without a token.
  useEffect(() => {
    if (!isAuthenticated) return;
    const retry = () => { retryPendingJournalSync().catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);
}
