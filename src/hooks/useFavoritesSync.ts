import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { api, hasToken } from '../lib/api';

/**
 * Syncs the favoriteTeas list between local Zustand store and the server.
 *
 * - On login (when isAuthenticated becomes true): fetches server favorites,
 *   merges with local (union of both sets).
 * - On favorite toggle (when authenticated): debounces 1s, then PUTs to server.
 * - Unauthenticated users keep localStorage as fallback (handled by Zustand persist).
 */
export function useFavoritesSync(isAuthenticated: boolean) {
  const favoriteTeas = useAppStore((s) => s.favoriteTeas);
  const mergeFavorites = useAppStore((s) => s.mergeFavorites);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);

  // Fetch and merge on login
  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      return;
    }

    // Fetch on first mount when authenticated, or when auth state transitions to true
    if (!hasFetchedRef.current || justLoggedIn) {
      hasFetchedRef.current = true;
      fetchAndMerge();
    }
  }, [isAuthenticated]);

  const fetchAndMerge = useCallback(async () => {
    if (!hasToken()) return;
    try {
      const data = await api.favorites.get();
      if (data.favorites && Array.isArray(data.favorites)) {
        mergeFavorites(data.favorites);
      }
    } catch {
      // Silently fail, localStorage remains the source of truth
    }
  }, [mergeFavorites]);

  // Debounced push to server on changes (when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !hasToken()) return;
    // Skip the initial sync, only push after user actions
    if (!hasFetchedRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      api.favorites.put(favoriteTeas).catch(() => {
        // Silently fail, will retry on next change
      });
    }, 1000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [favoriteTeas, isAuthenticated]);
}
