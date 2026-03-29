import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { api } from '../lib/api';
import { enqueueSync, flushSyncQueue, setupOnlineListener } from '../lib/offlineSync';

/**
 * Watches for offline state and queues favorites syncs.
 * Automatically flushes when the connection is restored.
 * Call once in the app root.
 */
export function useOfflineSync(isAuthenticated: boolean): void {
  const prevFavoritesRef = useRef<string[]>([]);

  // Set up the online listener to auto-flush
  useEffect(() => {
    if (!isAuthenticated) return;

    const flush = async () => {
      await flushSyncQueue({
        favorites: async (payload) => {
          await api.favorites.put(payload as string[]);
        },
      });
    };

    const cleanup = setupOnlineListener(flush);
    return cleanup;
  }, [isAuthenticated]);

  // Watch favorites changes — if offline, enqueue for later sync
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsub = useAppStore.subscribe((state) => {
      const current = state.favoriteTeas;
      if (current !== prevFavoritesRef.current) {
        prevFavoritesRef.current = current;
        if (!navigator.onLine) {
          enqueueSync({ type: 'favorites', payload: current });
        }
      }
    });

    return unsub;
  }, [isAuthenticated]);
}
