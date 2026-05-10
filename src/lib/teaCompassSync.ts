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
    if (key === 'synced' || key === 'vendorDetails') continue;

    const snakeKey = CAMEL_TO_SNAKE[key] || key;

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

// ── Sync unsynced entries to D1 ──

export async function syncCompassEntries(): Promise<number> {
  if (!hasToken()) return 0;

  const store = useTeaCompassStore.getState();
  const unsynced = store.entries.filter(e => !e.synced);

  if (unsynced.length === 0) return 0;

  try {
    const payload = unsynced.map(toSnakeCase);
    const result = await api.compass.sync(payload);

    // Mark as synced in store
    for (const entry of unsynced) {
      store.updateEntry(entry.id, { synced: true });
      // updateEntry sets synced=false, so we need to force it back
    }
    // Direct state update to set synced=true without triggering the synced=false logic
    useTeaCompassStore.setState((state) => ({
      entries: state.entries.map(e =>
        unsynced.some(u => u.id === e.id) ? { ...e, synced: true } : e
      ),
    }));

    return result.synced;
  } catch (err) {
    // Offline or error — do NOT mark entries as synced; they will retry next cycle
    console.warn('[TeaCompass] Sync failed:', err);
    return 0;
  }
}

// ── Hydrate from D1 on app start ──

export async function hydrateCompassEntries(): Promise<void> {
  if (!hasToken()) return;

  try {
    const data = await api.compass.list();
    const serverEntries: TeaCompassEntry[] = (data.entries || []).map(toCamelCase);

    const store = useTeaCompassStore.getState();
    const localEntries = store.entries;
    const localById = new Map(localEntries.map(e => [e.id, e]));

    const merged: TeaCompassEntry[] = [];
    const seenIds = new Set<string>();

    // Local unsynced entries take priority
    for (const local of localEntries) {
      seenIds.add(local.id);
      if (!local.synced) {
        // Local change not yet pushed — keep local version
        merged.push(local);
      } else {
        // Synced locally — prefer server version if it exists (may have newer data)
        const server = serverEntries.find(s => s.id === local.id);
        merged.push(server || local);
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

    useTeaCompassStore.setState({ entries: merged });
  } catch (err) {
    // Offline or error — local data is fine
    console.warn('[TeaCompass] Hydration failed:', err);
  }
}
