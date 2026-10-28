import { COMPASS_STRUCTURED_CAMEL, COMPASS_STRUCTURED_COLUMNS } from './curateStructuredFields';
import { canonicalCurrency } from './currency';
import { useTeaCompassStore } from './teaCompassStore';
import { api, hasToken, isTokenScopedToAccount, isTransientApiError } from './api';
import { normalizeCompassEntry, type TeaCompassEntry } from '../components/TeaCompass/types';

const BACKGROUND_REQUEST = { background: true } as const;

// ── Case conversion helpers ──

const CAMEL_TO_SNAKE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(COMPASS_STRUCTURED_CAMEL).map(([snake, camel]) => [camel, snake])),
  givenName: 'given_name',
  chineseName: 'chinese_name',
  originRegion: 'origin_region',
  originCountry: 'origin_country',
  clayType: 'clay_type',
  materialNote: 'material_note',
  sellPrice: 'sell_price',
  tastingHistory: 'tasting_history',
  priceAmount: 'price_amount',
  priceCurrency: 'price_currency',
  pricePerUnitGrams: 'price_per_unit_grams',
  teawareCategory: 'teaware_category',
  capacityMl: 'capacity_ml',
  vendorId: 'vendor_id',
  vendorName: 'vendor_name',
  shopName: 'shop_name',
  transportMode: 'transport_mode',
  linkedCustomerId: 'linked_customer_id',
  audioClips: 'audio_clips',
  buyQuantityGrams: 'buy_quantity_grams',
  buyQuantityUnits: 'buy_quantity_units',
  buyTotal: 'buy_total',
  draftProductId: 'draft_product_id',
  sourceEntryId: 'source_entry_id',
  sessionId: 'session_id',
  journeyId: 'journey_id',
  visitId: 'visit_id',
  sampleState: 'sample_state',
  sampleSetId: 'sample_set_id',
  teaKey: 'tea_key',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
);

// Only writable Compass columns cross the sync boundary. Hydrated rows retain
// provenance/lifecycle metadata for reading, and local state keeps its own fields.
// The strict worker codec remains the authority; the sync test pins this list to it.
const COMPASS_SYNC_COLUMNS = new Set<string>([
  'id', ...COMPASS_STRUCTURED_COLUMNS,
  'name', 'given_name', 'chinese_name', 'type', 'form', 'year', 'season', 'storage',
  'origin_country', 'origin_region', 'classification', 'cultivar', 'producer', 'description',
  'tea_key', 'price_amount', 'price_currency', 'price_per_unit_grams',
  'category', 'teaware_category', 'material', 'clay_type', 'material_note', 'sell_price', 'tasting_history', 'capacity_ml', 'quantity', 'era',
  'vendor_id', 'vendor_name', 'shop_name', 'transport_mode', 'linked_customer_id', 'notes',
  'tasting', 'photos', 'audio_clips', 'status', 'buy_quantity_grams', 'buy_quantity_units',
  'buy_total', 'verdict', 'decision', 'sample_state', 'sample_set_id', 'session_id',
  'journey_id', 'visit_id', 'draft_product_id', 'source_entry_id', 'created_at', 'updated_at',
]);

function toSnakeCase(entry: TeaCompassEntry): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'givenName' && Object.prototype.hasOwnProperty.call(entry, 'syncedGivenName') && (value ?? null) === entry.syncedGivenName) continue;
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    if (!COMPASS_SYNC_COLUMNS.has(snakeKey)) continue;

    // `decision` intentionally passes through unchanged: unlike status and
    // verdict it is an independent sourcing choice with matching API/DB naming.

    // Route quotes remain arrays for strict worker validation.
    if (snakeKey === 'route_quotes') {
      result[snakeKey] = value ?? [];
    } else if (snakeKey === 'photos' || snakeKey === 'audio_clips' || snakeKey === 'tasting' || snakeKey === 'tasting_history') {
      result[snakeKey] = value != null ? JSON.stringify(value) : null;
    } else {
      result[snakeKey] = value ?? null;
    }
  }
  return result;
}

export function toCamelCase(row: Record<string, any>): TeaCompassEntry {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    // Skip DB-only fields
    if (key === 'user_id') continue;

    const camelKey = SNAKE_TO_CAMEL[key] || key;

    // Parse JSON strings back to objects/arrays
    if (key === 'photos' || key === 'audio_clips' || key === 'tasting' || key === 'route_quotes' || key === 'tasting_history') {
      try {
        result[camelKey] = typeof value === 'string' ? (value ? JSON.parse(value) : (key === 'tasting' ? undefined : [])) : value ?? (key === 'tasting' ? undefined : []);
      } catch {
        result[camelKey] = key === 'tasting' ? undefined : [];
      }
    } else {
      result[camelKey] = value;
    }
  }
  // Ensure required defaults
  result.synced = true;
  result.syncedGivenName = result.givenName ?? null;
  result.priceCurrency = canonicalCurrency(result.priceCurrency) || 'Yuan';
  result.quantity = result.quantity ?? 1;
  result.notes = result.notes || '';
  result.photos = result.photos || [];
  result.audioClips = result.audioClips || [];
  result.status = result.status || 'noted';
  result.category = result.category || 'tea';
  result.createdAt = result.createdAt || new Date().toISOString();
  result.updatedAt = result.updatedAt || new Date().toISOString();
  // Canonical durable lifecycle drives identity; retain the boolean only as a
  // compatibility mirror for older consumers during migration.
  if (result.sampleState != null) result.isSample = true;

  return normalizeCompassEntry(result as TeaCompassEntry);
}

// ── Pending-work helpers ──

/** True while anything still needs to reach the server, unsynced entries,
 *  unconfirmed deletes, or unretried draft promotions. Drives the retry
 *  heartbeat in useCompassSync. */
export function compassHasPendingWork(accountId?: string | null): boolean {
  const s = useTeaCompassStore.getState();
  if (!accountId || s.accountScopeId !== accountId) return false;
  return s.deletedIds.length > 0
    || s.pendingPromotions.length > 0
    || s.entries.some(e => !e.synced);
}

/** Retry explicit Inventory creation requests that failed after the user chose it.
 *  Runs after entry sync so the worker can see the entry. Promotion is
 *  idempotent server-side (returns the existing draft), so retries are safe. */
async function retryPendingPromotions(accountId: string): Promise<void> {
  if (!hasToken()) return;
  if (!isTokenScopedToAccount(accountId)) return;
  const store = useTeaCompassStore.getState();
  const accountRevision = store.accountScopeRevision;
  if (store.accountScopeId !== accountId) return;
  for (const id of store.pendingPromotions) {
    const before = useTeaCompassStore.getState();
    if (before.accountScopeId !== accountId || before.accountScopeRevision !== accountRevision) return;
    // Entry deleted since, nothing left to promote.
    if (!store.entries.some(e => e.id === id)) {
      useTeaCompassStore.getState().removePendingPromotion(id);
      continue;
    }
    try {
      const { id: productId } = await api.compass.promote(id, BACKGROUND_REQUEST);
      const current = useTeaCompassStore.getState();
      if (current.accountScopeId !== accountId || current.accountScopeRevision !== accountRevision) return;
      useTeaCompassStore.getState().updateEntry(id, { draftProductId: productId, synced: false });
      useTeaCompassStore.getState().removePendingPromotion(id);
    } catch (error) {
      // A permanent authorization/validation/not-found response cannot heal
      // on a heartbeat. Drop it instead of retrying forever.
      if (
        useTeaCompassStore.getState().accountScopeId === accountId &&
        useTeaCompassStore.getState().accountScopeRevision === accountRevision &&
        !isTransientApiError(error)
      ) useTeaCompassStore.getState().removePendingPromotion(id);
    }
  }
}

/** Retry server deletes for tombstoned ids (deletes whose DELETE call failed,
 *  the "I deleted it and it came back" bug on flaky connections). Each id is
 *  cleared only once its delete confirms; failures keep the tombstone for the
 *  next cycle. Previously this only ran on app-start hydrate, so a delete that
 *  timed out stayed pending until the next full reload. */
export async function retryPendingDeletes(accountId?: string): Promise<void> {
  if (!hasToken()) return;
  const initial = useTeaCompassStore.getState();
  const requestedAccountId = accountId ?? initial.accountScopeId;
  const requestedRevision = initial.accountScopeRevision;
  if (!requestedAccountId || initial.accountScopeId !== requestedAccountId) return;
  if (!isTokenScopedToAccount(requestedAccountId)) return;
  const { deletedIds } = initial;
  for (const id of deletedIds) {
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId !== requestedAccountId || current.accountScopeRevision !== requestedRevision) return;
    try {
      await api.compass.remove(id, BACKGROUND_REQUEST);
      useTeaCompassStore.setState(s => s.accountScopeId === requestedAccountId && s.accountScopeRevision === requestedRevision
        ? { deletedIds: s.deletedIds.filter(d => d !== id), syncError: false }
        : s);
    } catch {
      const current = useTeaCompassStore.getState();
      if (current.accountScopeId === requestedAccountId && current.accountScopeRevision === requestedRevision) {
        useTeaCompassStore.setState({ syncError: true });
      }
    }
  }
}

// ── Sync unsynced entries to D1 ──

const syncQueues = new Map<string, Promise<number>>();

/** Serialize writes for an account so a late request cannot overwrite a newer snapshot. */
export function syncCompassEntries(accountId?: string): Promise<number> {
  const initial = useTeaCompassStore.getState();
  const scope = accountId ?? initial.accountScopeId;
  if (!scope) return Promise.resolve(0);
  const revision = initial.accountScopeRevision;
  const previous = syncQueues.get(scope);
  const next = (previous ? previous.catch(() => 0) : Promise.resolve(0)).then(() => {
    const current = useTeaCompassStore.getState();
    return current.accountScopeId === scope && current.accountScopeRevision === revision ? pushCompassEntries(scope) : 0;
  });
  syncQueues.set(scope, next);
  void next.finally(() => { if (syncQueues.get(scope) === next) syncQueues.delete(scope); });
  return next;
}

async function pushCompassEntries(accountId?: string): Promise<number> {
  if (!hasToken()) return 0;
  const initial = useTeaCompassStore.getState();
  const requestedAccountId = accountId ?? initial.accountScopeId;
  const requestedRevision = initial.accountScopeRevision;
  if (!requestedAccountId || initial.accountScopeId !== requestedAccountId) return 0;
  if (!isTokenScopedToAccount(requestedAccountId)) return 0;

  // Deletes ride every sync cycle, not just hydrate, a failed delete must
  // not wait for the next app reload to retry.
  await retryPendingDeletes(requestedAccountId);

  const store = useTeaCompassStore.getState();
  if (store.accountScopeId !== requestedAccountId || store.accountScopeRevision !== requestedRevision) return 0;
  const unsynced = store.entries.filter(e => !e.synced);

  if (unsynced.length === 0) {
    // Nothing to push, but an explicit Inventory creation may still be queued.
    await retryPendingPromotions(requestedAccountId);
    return 0;
  }

  // What each entry looked like when it was sent. An edit typed while this
  // request is in the air changes updatedAt, and that entry must stay unsynced
  // so the edit goes out next time: marking it synced here is how a note typed
  // during a save used to be shown as saved and then lost to the server copy.

  try {
    const payload = unsynced.map(toSnakeCase);
    const result = await api.compass.sync(payload, BACKGROUND_REQUEST);
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId !== requestedAccountId || current.accountScopeRevision !== requestedRevision) return 0;
    const attemptedIds = new Set(unsynced.map(entry => entry.id));
    const attemptedEntries = new Map(unsynced.map(entry => [entry.id, entry]));
    const acknowledgedIds = new Set(
      Array.isArray(result.syncedIds)
        ? result.syncedIds.filter(id => attemptedIds.has(id))
        : [],
    );
    const hasUnacknowledged = acknowledgedIds.size !== unsynced.length;

    // Only explicit per-id acknowledgements are allowed to clear local dirty
    // state. A protected id collision remains unsynced and retries visibly.
    useTeaCompassStore.setState((state) => ({
      entries: state.accountScopeId === requestedAccountId
        ? state.entries.map(e => acknowledgedIds.has(e.id) && attemptedEntries.get(e.id) === e ? { ...e, synced: true, syncedGivenName: e.givenName ?? null } : e)
        : state.entries,
      syncError: state.accountScopeId === requestedAccountId ? hasUnacknowledged : state.syncError,
    }));

    // Entries are on the server now, safe to retry any queued promotions.
    await retryPendingPromotions(requestedAccountId);

    // The server may have chosen canonical vendor sets, reused a shelf sample,
    // or reconciled lifecycle while accepting these writes. Read those facts
    // back through the guarded merge; a read failure cannot revoke the save.
    const afterPromotions = useTeaCompassStore.getState();
    if (acknowledgedIds.size > 0 && afterPromotions.accountScopeId === requestedAccountId
      && afterPromotions.accountScopeRevision === requestedRevision) {
      await hydrateCompassEntries(requestedAccountId).catch(() => {});
      if (hasUnacknowledged) useTeaCompassStore.setState((state) =>
        state.accountScopeId === requestedAccountId && state.accountScopeRevision === requestedRevision
          ? { syncError: true } : state);
    }

    return acknowledgedIds.size;
  } catch (err) {
    // Offline or error, do NOT mark entries as synced; they will retry next cycle.
    // Flag it so the UI can say "couldn't save" rather than leaving the user to
    // assume a local-only change persisted.
    console.warn('[TeaCompass] Sync failed:', err);
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId === requestedAccountId && current.accountScopeRevision === requestedRevision) {
      useTeaCompassStore.setState({ syncError: true });
    }
    return 0;
  }
}

// ── Hydrate from D1 on app start ──

export async function hydrateCompassEntries(accountId?: string): Promise<void> {
  if (!hasToken()) return;
  const initial = useTeaCompassStore.getState();
  const requestedAccountId = accountId ?? initial.accountScopeId;
  const requestedRevision = initial.accountScopeRevision;
  if (!requestedAccountId || initial.accountScopeId !== requestedAccountId) return;
  if (!isTokenScopedToAccount(requestedAccountId)) return;

  useTeaCompassStore.getState().setHydrationStatus('loading');

  try {
    const listRequestedAt = Date.now();
    const data = await api.compass.list(undefined, BACKGROUND_REQUEST);
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId !== requestedAccountId || current.accountScopeRevision !== requestedRevision) return;
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

    // Fields that live ONLY on this device, the compass tables have no
    // columns for them (see migration 082's "localStorage-only" note), so a
    // server row never carries them. Naively replacing a synced local entry
    // with the server row wiped them all on every app start: vendor details
    // vanished, sample verdicts reset, tasting history disappeared from the
    // Library. Carry them over from the local copy whenever the server
    // version wins the merge.
    const CLIENT_ONLY_FIELDS = [
      'vendorDetails', 'tastingHistory', 'isSample',
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
      // value erase a real local key, notes are anchored by it.
      if (out.teaKey == null && local.teaKey != null) out.teaKey = local.teaKey;
      return out as TeaCompassEntry;
    };

    // Local unsynced entries take priority
    for (const local of localEntries) {
      seenIds.add(local.id);
      if (!local.synced) {
        // Local change not yet pushed, keep local version
        merged.push(local);
      } else {
        // Synced locally, prefer server version if it exists (may have newer
        // data), but preserve this device's client-only fields.
        const server = serverEntries.find(s => s.id === local.id);
        // A synced tea the server no longer lists was deleted, archived or
        // merged elsewhere (another device, another Curate, an agent): the
        // list is the account's whole set, unpaged and unfiltered. Keeping the
        // local copy showed a deleted tea on every device that had seen it.
        // The server already refuses writes to such a row, so dropping it here
        // loses nothing; an entry with unsent local changes is kept above.
        // Only a tea untouched here for a minute before this read began is
        // dropped: a tea saved moments ago can be missing from a list that was
        // read just before its save landed, and must not blink out.
        const touchedAt = new Date(local.updatedAt || local.createdAt).getTime();
        const recentlyTouched = !Number.isFinite(touchedAt) || touchedAt > listRequestedAt - 60_000;
        if (server) merged.push(withClientFields(server, local));
        else if (recentlyTouched) merged.push(local);
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
    useTeaCompassStore.setState((state) => state.accountScopeId === requestedAccountId && state.accountScopeRevision === requestedRevision
      ? { entries: merged, syncError: false, hydrationStatus: 'ready' }
      : state);

    // Reconcile tombstones: a tombstoned id the server no longer has is confirmed
    // gone, forget it. One it still has means an earlier delete didn't land, so
    // retry it, and forget it only once that retry succeeds.
    if (store.deletedIds.length > 0) {
      const confirmedGone = store.deletedIds.filter(id => !rawServerIds.has(id));
      if (confirmedGone.length) {
        useTeaCompassStore.setState(s => s.accountScopeId === requestedAccountId && s.accountScopeRevision === requestedRevision
          ? { deletedIds: s.deletedIds.filter(id => !confirmedGone.includes(id)) }
          : s);
      }
      for (const id of store.deletedIds.filter(id => rawServerIds.has(id))) {
        const current = useTeaCompassStore.getState();
        if (current.accountScopeId !== requestedAccountId || current.accountScopeRevision !== requestedRevision) return;
        api.compass.remove(id, BACKGROUND_REQUEST)
          .then(() => useTeaCompassStore.setState(s => ({
            deletedIds: s.accountScopeId === requestedAccountId && s.accountScopeRevision === requestedRevision
              ? s.deletedIds.filter(d => d !== id)
              : s.deletedIds,
          })))
          .catch(() => { /* still unreachable, keep tombstone, retry next hydrate */ });
      }
    }
  } catch (err) {
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId === requestedAccountId && current.accountScopeRevision === requestedRevision) {
      current.setHydrationStatus('error');
    }
    // Offline or error, local data remains available, but the UI must say so.
    console.warn('[TeaCompass] Hydration failed:', err);
  }
}

/** Acquisition must refer to an acknowledged encounter, without closing its capture editor. */
export async function ensureCompassEncounterSaved(entryId: string): Promise<void> {
  const initial = useTeaCompassStore.getState();
  const scope = initial.accountScopeId;
  const revision = initial.accountScopeRevision;
  if (!scope || !hasToken() || !isTokenScopedToAccount(scope)) throw new Error('Sign in to save this purchase with the shop.');
  initial.retainEntry(entryId);
  await syncCompassEntries(scope);
  const current = useTeaCompassStore.getState();
  if (current.accountScopeId !== scope || current.accountScopeRevision !== revision) throw new Error('The active shop changed. Open this purchase in its original shop.');
  const entry = current.entries.find(entry => entry.id === entryId);
  if (!entry?.synced) throw new Error('Your capture is kept on this device. Retry once its latest changes have saved.');
}
