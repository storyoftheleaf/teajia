import { useTeaCompassStore } from './teaCompassStore';
import { api, hasToken } from './api';
import type { TeaCompassEntry } from '../components/TeaCompass/types';

// ── Case conversion helpers ──

const CAMEL_TO_SNAKE: Record<string, string> = {
  chineseName: 'chinese_name',
  originRegion: 'origin_region',
  priceAmount: 'price_amount',
  priceCurrency: 'price_currency',
  pricePerUnitGrams: 'price_per_unit_grams',
  teawareCategory: 'teaware_category',
  capacityMl: 'capacity_ml',
  vendorId: 'vendor_id',
  vendorName: 'vendor_name',
  linkedCustomerId: 'linked_customer_id',
  audioClips: 'audio_clips',
  buyQuantityGrams: 'buy_quantity_grams',
  buyQuantityUnits: 'buy_quantity_units',
  buyTotal: 'buy_total',
  draftProductId: 'draft_product_id',
  sourceEntryId: 'source_entry_id',
  sessionId: 'session_id',
  teaKey: 'tea_key',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
);

function toSnakeCase(entry: TeaCompassEntry): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(entry)) {
    // Skip client-only fields
    if (key === 'synced' || key === 'vendorDetails' || key === 'touchedFields' || key === 'draftAccountId') continue;

    const snakeKey = CAMEL_TO_SNAKE[key] || key;

    // `decision` intentionally passes through unchanged: unlike status and
    // verdict it is an independent sourcing choice with matching API/DB naming.

    // Serialize arrays/objects to JSON strings for D1
    if (snakeKey === 'photos' || snakeKey === 'audio_clips' || snakeKey === 'tasting') {
      result[snakeKey] = value != null ? JSON.stringify(value) : null;
    } else {
      result[snakeKey] = value ?? null;
    }
  }
  return result;
}

function toCamelCase(row: Record<string, any>): TeaCompassEntry {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    // Skip DB-only fields
    if (key === 'user_id') continue;

    const camelKey = SNAKE_TO_CAMEL[key] || key;

    // Parse JSON strings back to objects/arrays
    if (key === 'photos' || key === 'audio_clips' || key === 'tasting') {
      try {
        result[camelKey] = value ? JSON.parse(value as string) : (key === 'tasting' ? undefined : []);
      } catch {
        result[camelKey] = key === 'tasting' ? undefined : [];
      }
    } else {
      result[camelKey] = value;
    }
  }
  // Ensure required defaults
  result.synced = true;
  result.priceCurrency = result.priceCurrency || 'NT';
  result.quantity = result.quantity ?? 1;
  result.notes = result.notes || '';
  result.photos = result.photos || [];
  result.audioClips = result.audioClips || [];
  result.status = result.status || 'noted';
  result.category = result.category || 'tea';
  result.createdAt = result.createdAt || new Date().toISOString();
  result.updatedAt = result.updatedAt || new Date().toISOString();

  return result as TeaCompassEntry;
}

// ── Pending-work helpers ──

/** True while anything still needs to reach the server — unsynced entries,
 *  unconfirmed deletes, or unretried draft promotions. Drives the retry
 *  heartbeat in useCompassSync. */
export function compassHasPendingWork(): boolean {
  const s = useTeaCompassStore.getState();
  return s.deletedIds.length > 0
    || s.pendingPromotions.length > 0
    || s.entries.some(e => !e.synced);
}

/** Retry promote-to-draft for entries whose promotion failed at commit time.
 *  Runs after entry sync so the worker can see the entry. Promotion is
 *  idempotent server-side (returns the existing draft), so retries are safe. */
async function retryPendingPromotions(): Promise<void> {
  if (!hasToken()) return;
  const store = useTeaCompassStore.getState();
  for (const id of store.pendingPromotions) {
    // Entry deleted since — nothing left to promote.
    if (!store.entries.some(e => e.id === id)) {
      useTeaCompassStore.getState().removePendingPromotion(id);
      continue;
    }
    try {
      const { id: productId } = await api.compass.promote(id);
      useTeaCompassStore.getState().updateEntry(id, { draftProductId: productId, synced: false });
      useTeaCompassStore.getState().removePendingPromotion(id);
    } catch {
      /* still unreachable — keep queued, next heartbeat retries */
    }
  }
}

/** Retry server deletes for tombstoned ids (deletes whose DELETE call failed —
 *  the "I deleted it and it came back" bug on flaky connections). Each id is
 *  cleared only once its delete confirms; failures keep the tombstone for the
 *  next cycle. Previously this only ran on app-start hydrate, so a delete that
 *  timed out stayed pending until the next full reload. */
export async function retryPendingDeletes(): Promise<void> {
  if (!hasToken()) return;
  const { deletedIds } = useTeaCompassStore.getState();
  for (const id of deletedIds) {
    try {
      await api.compass.remove(id);
      useTeaCompassStore.setState(s => ({
        deletedIds: s.deletedIds.filter(d => d !== id),
        syncError: false,
      }));
    } catch {
      useTeaCompassStore.setState({ syncError: true });
    }
  }
}

// ── Sync unsynced entries to D1 ──

export async function syncCompassEntries(): Promise<number> {
  if (!hasToken()) return 0;

  // Deletes ride every sync cycle, not just hydrate — a failed delete must
  // not wait for the next app reload to retry.
  await retryPendingDeletes();

  const store = useTeaCompassStore.getState();
  const unsynced = store.entries.filter(e => !e.synced);

  if (unsynced.length === 0) {
    // Nothing to push, but a failed promote may still be queued.
    await retryPendingPromotions();
    return 0;
  }

  try {
    const payload = unsynced.map(toSnakeCase);
    const result = await api.compass.sync(payload);

    // Mark as synced in store
    for (const entry of unsynced) {
      store.updateEntry(entry.id, { synced: true });
      // updateEntry sets synced=false, so we need to force it back
    }
    // Direct state update to set synced=true without triggering the synced=false logic.
    // Also clear any prior sync-error flag — we just reached the server.
    useTeaCompassStore.setState((state) => ({
      entries: state.entries.map(e =>
        unsynced.some(u => u.id === e.id) ? { ...e, synced: true } : e
      ),
      syncError: false,
    }));

    // Entries are on the server now — safe to retry any queued promotions.
    await retryPendingPromotions();

    return result.synced;
  } catch (err) {
    // Offline or error — do NOT mark entries as synced; they will retry next cycle.
    // Flag it so the UI can say "couldn't save" rather than leaving the user to
    // assume a local-only change persisted.
    console.warn('[TeaCompass] Sync failed:', err);
    useTeaCompassStore.setState({ syncError: true });
    return 0;
  }
}

// ── Hydrate from D1 on app start ──

export async function hydrateCompassEntries(): Promise<void> {
  if (!hasToken()) return;

  try {
    const data = await api.compass.list();
    const rawServerIds = new Set<string>((data.entries || []).map((r: any) => r.id));

    const store = useTeaCompassStore.getState();
    // Tombstoned ids: locally deleted but not yet confirmed gone on the server.
    // Drop them from BOTH the server set and local state so a not-yet-deleted
    // row can't reappear here (the "I deleted it and it came back" bug).
    const deleted = new Set(store.deletedIds);
    const serverEntries: TeaCompassEntry[] = (data.entries || [])
      .map(toCamelCase)
      .filter((e: TeaCompassEntry) => !deleted.has(e.id));
    const localEntries = store.entries.filter(e => !deleted.has(e.id));

    const merged: TeaCompassEntry[] = [];
    const seenIds = new Set<string>();

    // Fields that live ONLY on this device — the compass tables have no
    // columns for them (see migration 082's "localStorage-only" note), so a
    // server row never carries them. Naively replacing a synced local entry
    // with the server row wiped them all on every app start: vendor details
    // vanished, sample verdicts reset, tasting history disappeared from the
    // Library. Carry them over from the local copy whenever the server
    // version wins the merge.
    const CLIENT_ONLY_FIELDS = [
      'vendorDetails', 'tastingHistory', 'isSample', 'sampleSetId',
      'sampleGrams', 'sampleVerdict', 'sampleWouldBuy', 'tasteOrder',
    ] as const;
    const withClientFields = (server: TeaCompassEntry, local: TeaCompassEntry): TeaCompassEntry => {
      const out: any = { ...server };
      for (const field of CLIENT_ONLY_FIELDS) {
        const val = (local as any)[field];
        if (val !== undefined && out[field] === undefined) out[field] = val;
      }
      // teaKey IS a server column, but the bulk-sync handler historically
      // dropped it, so old server rows carry null. Never let a null server
      // value erase a real local key — notes are anchored by it.
      if (out.teaKey == null && local.teaKey != null) out.teaKey = local.teaKey;
      return out as TeaCompassEntry;
    };

    // Local unsynced entries take priority
    for (const local of localEntries) {
      seenIds.add(local.id);
      if (!local.synced) {
        // Local change not yet pushed — keep local version
        merged.push(local);
      } else {
        // Synced locally — prefer server version if it exists (may have newer
        // data), but preserve this device's client-only fields.
        const server = serverEntries.find(s => s.id === local.id);
        merged.push(server ? withClientFields(server, local) : local);
      }
    }

    // Add server entries that don't exist locally
    for (const server of serverEntries) {
      if (!seenIds.has(server.id)) {
        merged.push(server);
      }
    }

    // Sort by createdAt DESC
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Reaching the server clears any stale "couldn't save" flag.
    useTeaCompassStore.setState({ entries: merged, syncError: false });

    // Reconcile tombstones: a tombstoned id the server no longer has is confirmed
    // gone — forget it. One it still has means an earlier delete didn't land —
    // retry it, and forget it only once that retry succeeds.
    if (store.deletedIds.length > 0) {
      const confirmedGone = store.deletedIds.filter(id => !rawServerIds.has(id));
      if (confirmedGone.length) {
        useTeaCompassStore.setState(s => ({
          deletedIds: s.deletedIds.filter(id => !confirmedGone.includes(id)),
        }));
      }
      for (const id of store.deletedIds.filter(id => rawServerIds.has(id))) {
        api.compass.remove(id)
          .then(() => useTeaCompassStore.setState(s => ({ deletedIds: s.deletedIds.filter(d => d !== id) })))
          .catch(() => { /* still unreachable — keep tombstone, retry next hydrate */ });
      }
    }
  } catch (err) {
    // Offline or error — local data is fine
    console.warn('[TeaCompass] Hydration failed:', err);
  }
}
