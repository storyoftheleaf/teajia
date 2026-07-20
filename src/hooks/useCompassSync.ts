import { useEffect, useRef, useState } from 'react';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { hydrateCompassEntries, syncCompassEntries, compassHasPendingWork } from '../lib/teaCompassSync';
import { AUTH_TOKEN_CHANGED_EVENT, hasToken, isTokenScopedToAccount } from '../lib/api';
import { useAppStore } from '../lib/store';
import { selectSampleSyncPending, useSampleStore } from '../samples/sampleStore';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { sampleRepository } from '../samples/sampleRepository';

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
  const samplesPending = useSampleStore((state) => (
    state.accountScopeId === activeAccountId && selectSampleSyncPending(state)
  ));
  const hasFetchedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tokenRevision, setTokenRevision] = useState(0);

  useEffect(() => {
    const handleTokenChange = () => setTokenRevision((revision) => revision + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
  }, []);

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

    if (!isAuthenticated || !activeAccountId || !isTokenScopedToAccount(activeAccountId)) {
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current || justLoggedIn) {
      hasFetchedRef.current = true;
      hydrateCompassEntries(activeAccountId)
        .then(() => syncCompassEntries(activeAccountId))
        .catch(() => {});
      sampleRepository.hydrate(activeAccountId)
        .then((result) => {
          if (result.status === 'hydrated') return sampleRepository.sync(activeAccountId);
        })
        .catch(() => {});
    }
  }, [activeAccountId, isAuthenticated, tokenRevision]);

  // Debounced push of unsynced entries after entries change
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId || !hasToken() || !isTokenScopedToAccount(activeAccountId)) return;
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncCompassEntries(activeAccountId).catch(() => {});
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeAccountId, entries, isAuthenticated]);

  // Existing Samples UI writes only to the store. This durable outbox bridge
  // observes those unchanged actions and persists them after the same quiet
  // period as Compass entries.
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId || !hasToken() || !isTokenScopedToAccount(activeAccountId)) return;
    if (!hasFetchedRef.current) return;
    if (!samplesPending) return;
    if (sampleDebounceRef.current) clearTimeout(sampleDebounceRef.current);
    sampleDebounceRef.current = setTimeout(() => {
      sampleRepository.sync(activeAccountId).catch(() => {});
    }, 2000);
    return () => {
      if (sampleDebounceRef.current) clearTimeout(sampleDebounceRef.current);
    };
  }, [activeAccountId, isAuthenticated, samplesPending]);

  // Retry sync when the browser transitions back online
  useEffect(() => {
    if (!isAuthenticated || !activeAccountId) return;

    const handleOnline = () => {
      if (hasToken()) {
        syncCompassEntries(activeAccountId).catch(() => {});
        sampleRepository.sync(activeAccountId).catch(() => {});
      }
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
      const sampleState = useSampleStore.getState();
      const hasPendingSamples = sampleState.accountScopeId === activeAccountId
        && selectSampleSyncPending(sampleState);
      if (hasToken() && hasPendingSamples) sampleRepository.sync(activeAccountId).catch(() => {});
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
