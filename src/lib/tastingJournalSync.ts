import { useAppStore } from './store';
import { api, hasToken } from './api';
import type { CustomerTasting } from '../types';

// Convert CustomerTasting → API payload shape (snake_case)
function toApiPayload(entry: CustomerTasting): Record<string, any> {
  return {
    id: entry.id,
    product_id: entry.teaId,
    product_name: entry.teaName,
    product_type: entry.teaType,
    product_image: entry.teaImage ?? null,
    tasting: JSON.stringify(entry.tasting),
    personal_note: entry.personalNote ?? null,
    rating: entry.rating ?? null,
    event_id: entry.eventId ?? null,
    event_title: entry.eventTitle ?? null,
    source_type: entry.sourceType ?? 'product',
    compass_entry_id: entry.compassEntryId ?? null,
    created_at: entry.createdAt,
  };
}

// Convert API response row → CustomerTasting
function fromApiRow(row: Record<string, any>): CustomerTasting {
  return {
    id: row.id,
    teaId: row.product_id,
    teaName: row.product_name,
    teaType: row.product_type || '',
    teaImage: row.product_image ?? undefined,
    tasting: (() => {
      try { return row.tasting ? JSON.parse(row.tasting) : {}; }
      catch { return {}; }
    })(),
    personalNote: row.personal_note ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    eventId: row.event_id ?? undefined,
    eventTitle: row.event_title ?? undefined,
    sourceType: row.source_type ?? 'product',
    compassEntryId: row.compass_entry_id ?? undefined,
    synced: true,
  };
}

/**
 * Syncs unsynced tasting journal entries to D1.
 * Entries without a `synced` flag are unsynced.
 */
export async function syncTastingJournal(): Promise<number> {
  if (!hasToken()) return 0;

  const { tastingJournal } = useAppStore.getState();
  const unsynced = tastingJournal.filter(e => !e.synced);
  if (unsynced.length === 0) return 0;

  try {
    const payload = unsynced.map(toApiPayload);
    await api.tastingJournal.sync(payload);

    // Mark as synced — direct state update to avoid triggering unsynced flag
    useAppStore.setState(state => ({
      tastingJournal: state.tastingJournal.map(e =>
        unsynced.some(u => u.id === e.id) ? { ...e, synced: true } : e
      ),
    }));

    return unsynced.length;
  } catch (err) {
    // Offline or error — entries stay unsynced, will retry next cycle
    console.warn('[TastingJournal] Sync failed:', err);
    return 0;
  }
}

/**
 * Hydrates the tasting journal from D1 on login/app start.
 * Server wins for synced entries; local unsynced entries take priority.
 */
export async function hydrateTastingJournal(): Promise<void> {
  if (!hasToken()) return;

  try {
    const data = await api.tastingJournal.list();
    const serverEntries: CustomerTasting[] = (data.entries || data || []).map(fromApiRow);

    useAppStore.setState(state => {
      const local = state.tastingJournal;
      const merged: CustomerTasting[] = [];
      const seenIds = new Set<string>();

      // Local unsynced entries take priority
      for (const entry of local) {
        seenIds.add(entry.id);
        if (!entry.synced) {
          // Local change not yet pushed — keep local version
          merged.push(entry);
        } else {
          // Synced locally — prefer server version if it exists (may have newer data)
          const server = serverEntries.find(s => s.id === entry.id);
          merged.push(server ? { ...server, synced: true } : entry);
        }
      }

      // Add server entries that don't exist locally
      for (const server of serverEntries) {
        if (!seenIds.has(server.id)) {
          merged.push({ ...server, synced: true });
        }
      }

      // Sort by createdAt DESC
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { tastingJournal: merged };
    });
  } catch (err) {
    // Offline or error — local data is fine
    console.warn('[TastingJournal] Hydration failed:', err);
  }
}
