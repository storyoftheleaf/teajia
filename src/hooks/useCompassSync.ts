import { useEffect, useRef } from 'react';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { hydrateCompassEntries, syncCompassEntries, compassHasPendingWork } from '../lib/teaCompassSync';
import { hasToken } from '../lib/api';

/**
 * Syncs the Tea Compass entries between local Zustand store and D1.
 *
 * Mirrors the shape of `useFavoritesSync` / `useTastingJournalSync`:
 * - On login (when isAuthenticated becomes true): hydrates from the server and
 *   merges with local (local unsynced wins).
 * - When entries change while authenticated: debounces 2s then pushes unsynced.
 * - Also re-tries any unsynced entries when the browser transitions back online.
 * - Unauthenticated users keep localStorage only (persist middleware).
 *
 * Account-switch behavior (X-Teajia-Account header scoping):
 * Account switches go through `AccountSwitcher` which refreshes the JWT and
 * calls `queryClient.invalidateQueries()`. `api.compass.*` calls read the
 * active account from the fresh JWT on every request, so the next sync/hydrate
 * cycle that fires naturally under the new account is already scoped correctly.
 * Compass entries are user-scoped within an account (per MULTI_STORE_PLAN.md),
 * so localStorage is fine as a cross-switch cache. If cross-account bleed ever
 * becomes a concern, this hook is the single place to add an activeAccountId
 * dependency that clears the store on change.
 */
export function useCompassSync(isAuthenticated: boolean) {
  const entries = useTeaCompassStore((s) => s.entries);
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
      hydrateCompassEntries()
        .then(() => syncCompassEntries())
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Debounced push of unsynced entries after entries change
  useEffect(() => {
    if (!isAuthenticated || !hasToken()) return;
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncCompassEntries().catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [entries, isAuthenticated]);

  // Retry sync when the browser transitions back online
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleOnline = () => {
      if (hasToken()) syncCompassEntries().catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated]);

  // Retry heartbeat — the 'online' event never fires on a GFW-style connection
  // that stays "up" but times out, so a failed save/delete used to sit pending
  // until the user happened to edit something else. While ANY work is pending
  // (unsynced entries or unconfirmed deletes), retry every 30s and immediately
  // when the tab regains focus (phone unlocked between tastings at a fair).
  // No-ops entirely when everything is synced.
  useEffect(() => {
    if (!isAuthenticated) return;

    const retryIfPending = () => {
      if (hasToken() && compassHasPendingWork()) {
        syncCompassEntries().catch(() => {});
      }
    };
    const interval = setInterval(retryIfPending, 30_000);
    const handleVisible = () => {
      if (document.visibilityState === 'visible') retryIfPending();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [isAuthenticated]);
}
