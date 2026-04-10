import { useEffect, useRef } from 'react';
import { useNotesStore } from '../lib/notesStore';
import { hydrateNotes, syncNotes } from '../lib/notesSync';
import { hasToken } from '../lib/api';

/**
 * Syncs the unified notes thread (notes + sessions) between the local
 * Zustand store and D1.
 *
 * Mirrors the shape of `useCompassSync` / `useTastingJournalSync` /
 * `useFavoritesSync`:
 * - On login (when isAuthenticated becomes true): hydrates from server,
 *   then pushes any local unsynced writes.
 * - When notes or sessions change while authenticated: debounces 2s then
 *   pushes unsynced.
 * - Retries any unsynced writes when the browser transitions back online.
 * - Unauthenticated users keep localStorage only (persist middleware).
 *
 * Before this hook existed, notes hydration + push lived inside an effect
 * on `TeaCompass/index.tsx`, which meant notes only synced while the
 * Compass view was mounted. The move to the app root keeps notes fresh
 * across navigation, matching the other three sync hooks.
 */
export function useNotesSync(isAuthenticated: boolean) {
  const notes = useNotesStore((s) => s.notes);
  const sessions = useNotesStore((s) => s.sessions);
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
      hydrateNotes()
        .then(() => syncNotes())
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Debounced push of unsynced notes / sessions after they change
  useEffect(() => {
    if (!isAuthenticated || !hasToken()) return;
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncNotes().catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [notes, sessions, isAuthenticated]);

  // Retry sync when the browser transitions back online
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleOnline = () => {
      if (hasToken()) syncNotes().catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated]);
}
