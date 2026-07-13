import { useEffect, useRef } from 'react';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { hydrateCompassEntries, syncCompassEntries, compassHasPendingWork } from '../lib/teaCompassSync';
import { hasToken } from '../lib/api';
import { useAppStore } from '../lib/store';
import { useSampleStore } from '../samples/sampleStore';
import { useSampleCartStore } from '../samples/sampleCartStore';

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
 * Account-switch behavior (X-Teajia-Account header scoping): all local Curate
 * stores switch their visible account facade before hydration. Every async
 * sync/hydrate call carries that account id and refuses to apply a stale
 * response after another account becomes active.
 */
export function useCompassSync(isAuthenticated: boolean) {
  const activeAccountId = useAppStore((s) => s.activeAccountId);
  const entries = useTeaCompassStore((s) => s.entries);
  const hasFetchedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep every local Curate surface on the same explicit account facade.
  // Null is intentional: signed-out/unknown account state must expose nothing.
  useEffect(() => {
    useTeaCompassStore.getState().switchAccount(activeAccountId);
    useSampleStore.getState().switchAccount(activeAccountId);
    useSampleCartStore.getState().switchAccount(activeAccountId);
    hasFetchedRef.current = false;
  }, [activeAccountId]);

  // Hydrate from server on login / first mount when authenticated
  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!isAuthenticated || !activeAccountId) {
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current || justLoggedIn) {
      hasFetchedRef.current = true;
      hydrateCompassEntries(activeAccountId)
        .then(() => syncCompassEntries(activeAccountId))
        .catch(() => {});
    }
  }, [activeAccountId, isAuthenticated]);

  // Debounced push of unsynced entries after entries change
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId || !hasToken()) return;
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncCompassEntries(activeAccountId).catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeAccountId, entries, isAuthenticated]);

  // Retry sync when the browser transitions back online
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId) return;

    const handleOnline = () => {
      if (hasToken()) syncCompassEntries(activeAccountId).catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activeAccountId, isAuthenticated]);

  // Retry heartbeat — the 'online' event never fires on a GFW-style connection
  // that stays "up" but times out, so a failed save/delete used to sit pending
  // until the user happened to edit something else. While ANY work is pending
  // (unsynced entries or unconfirmed deletes), retry every 30s and immediately
  // when the tab regains focus (phone unlocked between tastings at a fair).
  // No-ops entirely when everything is synced.
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId) return;

    const retryIfPending = () => {
      if (hasToken() && compassHasPendingWork(activeAccountId)) {
        syncCompassEntries(activeAccountId).catch(() => {});
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
  }, [activeAccountId, isAuthenticated]);
}
