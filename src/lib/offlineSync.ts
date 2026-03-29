/**
 * Offline Sync Queue — queues API writes when offline, flushes when reconnected.
 * Works with the existing Zustand persisted state for favorites and tasting journal.
 *
 * Usage:
 *   import { enqueueSync, flushSyncQueue } from './offlineSync';
 *   // When saving favorites offline:
 *   enqueueSync({ type: 'favorites', payload: favoriteIds });
 *   // App startup or online event:
 *   flushSyncQueue(api);
 */

interface SyncEntry {
  id: string;
  type: 'favorites' | 'tasting-journal';
  payload: unknown;
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = 'teajia-offline-sync-queue';

function getQueue(): SyncEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — drop oldest entries
    const trimmed = queue.slice(-20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

/** Add an operation to the offline queue */
export function enqueueSync(entry: Omit<SyncEntry, 'id' | 'timestamp' | 'retries'>): void {
  const queue = getQueue();
  // Deduplicate — replace existing entry of same type
  const filtered = queue.filter(e => e.type !== entry.type);
  filtered.push({
    ...entry,
    id: `${entry.type}-${Date.now()}`,
    timestamp: Date.now(),
    retries: 0,
  });
  saveQueue(filtered);
}

/** Check if there are pending sync operations */
export function hasPendingSync(): boolean {
  return getQueue().length > 0;
}

/** Get count of pending operations */
export function pendingSyncCount(): number {
  return getQueue().length;
}

/**
 * Flush the sync queue — call with a handler map that processes each entry type.
 * Returns the number of successfully synced entries.
 */
export async function flushSyncQueue(handlers: {
  favorites?: (payload: string[]) => Promise<void>;
  'tasting-journal'?: (payload: unknown) => Promise<void>;
}): Promise<number> {
  if (!navigator.onLine) return 0;

  const queue = getQueue();
  if (queue.length === 0) return 0;

  const failed: SyncEntry[] = [];
  let synced = 0;

  for (const entry of queue) {
    const handler = handlers[entry.type];
    if (!handler) {
      failed.push(entry);
      continue;
    }

    try {
      await handler(entry.payload as any);
      synced++;
    } catch {
      if (entry.retries < 3) {
        failed.push({ ...entry, retries: entry.retries + 1 });
      }
      // Drop after 3 retries
    }
  }

  saveQueue(failed);
  return synced;
}

/** Clear the entire sync queue */
export function clearSyncQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Hook up automatic flushing when the app comes back online.
 * Call once at app startup.
 */
export function setupOnlineListener(flush: () => void): () => void {
  const handler = () => {
    // Small delay to let the connection stabilize
    setTimeout(flush, 1000);
  };
  window.addEventListener('online', handler);
  // Also try flushing immediately if we're already online
  if (navigator.onLine) {
    setTimeout(flush, 2000);
  }
  return () => window.removeEventListener('online', handler);
}
