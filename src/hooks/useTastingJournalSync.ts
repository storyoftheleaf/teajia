import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { retryPendingJournalSync, syncTastingJournal } from '../lib/tastingJournalSync';
import { useJournalHydration } from './useJournalHydration';

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
  const { canRead: canSync, scopeKey } = useJournalHydration(isAuthenticated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced push of unsynced entries after journal changes
  useEffect(() => {
    if (!canSync) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncTastingJournal().catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tastingJournal, canSync, scopeKey]);

  // Retry a failed push on reconnect and on focus. Guests have no listener,
  // and the retry itself also refuses without a token.
  useEffect(() => {
    if (!canSync) return;
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
  }, [canSync, scopeKey]);
}
