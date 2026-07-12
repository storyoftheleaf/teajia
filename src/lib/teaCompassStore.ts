import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaCompassEntry, CompassCategory, BrowseGrouping, BrowseFilter, BrowseSort, BrowseLayout, LibraryFilters } from '../components/TeaCompass/types';
import { createEmptyEntry } from '../components/TeaCompass/types';
import type { Currency } from '../admin/types';
import { api, hasToken } from './api';
import { useNotesStore } from './notesStore';
import { useAppStore } from './store';

interface TeaCompassState {
  // Committed entries (persisted to localStorage + server)
  entries: TeaCompassEntry[];
  // Pending entries — created but not yet committed (NOT persisted, lost on refresh)
  pendingEntries: TeaCompassEntry[];

  // Session
  activeEntryId: string | null;
  sessionEntryIds: string[]; // IDs of entries created in current session
  draftAccountScopeId: string | null;
  draftsByAccount: Record<string, Required<PersistedCompassDrafts>>;
  switchDraftAccount: (accountId: string | null) => void;

  // Vendor persistence
  lastVendorId: string | null;
  lastVendorName: string | null;
  lastCurrency: Currency;

  // Optional encounter context. Separate from capture-session grouping.
  encounterContextByAccount: Record<string, { journeyId: string | null; visitId: string | null }>;
  setEncounterContext: (entryId: string, journeyId: string | null, visitId: string | null) => void;
  clearJourneyReferences: (journeyId: string) => void;
  clearVisitReferences: (visitId: string) => void;

  // Browse state
  browseGrouping: BrowseGrouping;
  browseFilter: BrowseFilter;
  browseSort: BrowseSort;
  browseLayout: BrowseLayout;
  libraryFilters: LibraryFilters;

  // Capture session — entries created in one contiguous run share this id.
  // A fresh id is minted when a capture starts after SESSION_GAP_MS of idle,
  // so a "review the batch I just tasted" surface can group a sitting.
  currentSessionId: string | null;
  lastCaptureAt: number | null;

  // Sync health — true when the most recent server write (entry sync OR delete)
  // failed to reach D1. Lets the UI say "couldn't save, check connection" instead
  // of silently pretending a local-only change persisted (the China/offline trap).
  syncError: boolean;
  setSyncError: (failed: boolean) => void;

  // Tombstones — ids deleted locally whose server delete hasn't been confirmed.
  // Hydrate filters these out so a still-on-server row can't reappear before the
  // delete lands (the "I deleted it and it came back" bug), and retries the delete.
  deletedIds: string[];

  // Entries whose promote-to-draft call failed (offline/timeout at commit time).
  // The sync heartbeat retries these until the draft exists — previously a
  // failed promotion was silent and the tea just never appeared in
  // /admin/capture. Persisted so a page reload doesn't lose the intent.
  pendingPromotions: string[];
  addPendingPromotion: (id: string) => void;
  removePendingPromotion: (id: string) => void;

  // Pricing formula — shipping rate used in retail preview (same currency as entry cost)
  shippingRatePerKg: number;
  setShippingRatePerKg: (rate: number) => void;

  // User-added teaware eras (e.g. "Song Dynasty"). Appear in the Era picker
  // alongside the standard TEAWARE_ERAS list.
  customEras: string[];
  addCustomEra: (era: string) => void;

  // Actions
  addEntry: (entry: TeaCompassEntry) => void;
  updateEntry: (id: string, updates: Partial<TeaCompassEntry>) => void;
  removeEntry: (id: string) => void;
  setActiveEntry: (id: string | null) => void;

  // Session
  startNewCapture: (category?: CompassCategory) => string; // returns new entry ID
  commitEntry: (id: string) => void; // finalize entry: if has content → moves to entries; else discards

  // Vendor
  setLastVendor: (vendorId: string | null, vendorName: string | null) => void;
  setLastCurrency: (currency: Currency) => void;

  // Browse
  setBrowseGrouping: (grouping: BrowseGrouping) => void;
  setBrowseFilter: (filter: BrowseFilter) => void;
  setBrowseSort: (sort: BrowseSort) => void;
  setBrowseLayout: (layout: BrowseLayout) => void;
  setLibraryFilters: (filters: LibraryFilters) => void;

  // Discard a pending capture without saving. For committed entries being re-edited, just exits the session.
  discardEntry: (id: string) => void;

  // Helpers
  getEntry: (id: string) => TeaCompassEntry | undefined;
  getBuyingEntries: () => TeaCompassEntry[]; // legacy
  getSessionEntries: () => TeaCompassEntry[];
}

const NON_DELIBERATE_UPDATE_FIELDS = new Set<keyof TeaCompassEntry>([
  'category', 'createdAt', 'draftAccountId', 'draftProductId', 'sessionId',
  'sourceEntryId', 'synced', 'teaKey', 'touchedFields', 'updatedAt',
]);

function touchedFieldsAfterUpdate(
  entry: TeaCompassEntry,
  updates: Partial<TeaCompassEntry>,
): string[] | undefined {
  const deliberateKeys = Object.keys(updates).filter(
    (field) => !NON_DELIBERATE_UPDATE_FIELDS.has(field as keyof TeaCompassEntry),
  );
  if (entry.touchedFields === undefined && deliberateKeys.length === 0) return undefined;
  return Array.from(new Set([...(entry.touchedFields ?? []), ...deliberateKeys]));
}

/** The single capture-retention contract. New entries use explicit touch
 * metadata so inherited defaults never become content. Legacy rows without
 * metadata fall back to their stored values so existing fragments stay safe. */
export function entryHasDeliberateInput(entry: TeaCompassEntry): boolean {
  const touched = entry.touchedFields;
  if (Array.isArray(touched) && touched.some(
    (field) => !NON_DELIBERATE_UPDATE_FIELDS.has(field as keyof TeaCompassEntry),
  )) return true;

  // Direct constructors (sample sets/importers) can assign real fields without
  // calling updateEntry. Inherited vendor/currency and structural defaults are
  // intentionally omitted so an untouched field shell remains empty.
  if (
    entry.name.trim().length > 0 || entry.photos.length > 0 || entry.notes.trim().length > 0 ||
    entry.audioClips.length > 0 || !!entry.chineseName?.trim() ||
    entry.priceAmount != null || entry.sellPrice != null || entry.type != null ||
    entry.form != null || entry.year != null || entry.season != null || entry.storage != null ||
    !!entry.originRegion?.trim() || entry.status !== 'noted' || entry.buyQuantityGrams != null ||
    entry.buyQuantityUnits != null || entry.buyTotal != null || entry.teawareCategory != null ||
    entry.material != null || entry.clayType != null || !!entry.materialNote?.trim() ||
    entry.capacityMl != null || entry.quantity !== 1 || entry.era != null ||
    entry.verdict != null || entry.isSample === true || entry.sampleGrams != null ||
    entry.sampleVerdict != null || entry.sampleWouldBuy != null || entry.tasteOrder != null ||
    (touched === undefined && (!!entry.vendorName?.trim() || !!entry.vendorId)) ||
    (entry.tasting != null && Object.values(entry.tasting).some((value) =>
      Array.isArray(value) ? value.length > 0 : value != null
    ))
  ) return true;

  // Notes typed in the NoteThread are stored in the notes store keyed by the
  // entry id (and/or its teaKey), NOT on entry.notes — so an entry whose only
  // content is thread notes must still count as having content, or committing
  // it would discard the entry and orphan those notes.
  const ns = useNotesStore.getState();
  if (ns.getNotesForCompassEntry(entry.id).length > 0) return true;
  if (entry.teaKey && ns.getNotesForTea(entry.teaKey).length > 0) return true;
  return false;
}

/** Backward-compatible alias for consumers outside the retention flow. */
export const entryHasContent = entryHasDeliberateInput;

interface PersistedCompassDrafts {
  pendingEntries?: TeaCompassEntry[];
  activeEntryId?: string | null;
  sessionEntryIds?: string[];
}

function activeAccountScope(): string | null {
  const fromAppStore = useAppStore.getState().activeAccountId;
  if (fromAppStore) return fromAppStore;
  if (typeof localStorage === 'undefined') return null;
  try {
    const token = localStorage.getItem('teajia_token');
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { active_account_id?: string };
    return decoded.active_account_id ?? null;
  } catch {
    return null;
  }
}

export function restoreCompassDraftsForAccount(
  persisted: PersistedCompassDrafts,
  activeAccountId: string | null,
): Required<PersistedCompassDrafts> {
  if (!activeAccountId) return { pendingEntries: [], activeEntryId: null, sessionEntryIds: [] };
  const pendingEntries = (persisted.pendingEntries ?? []).filter((entry) =>
    entry.draftAccountId === activeAccountId && entryHasDeliberateInput(entry)
  );
  const ids = new Set(pendingEntries.map((entry) => entry.id));
  const sessionEntryIds = (persisted.sessionEntryIds ?? []).filter((id) => ids.has(id));
  const requestedActive = persisted.activeEntryId && ids.has(persisted.activeEntryId)
    ? persisted.activeEntryId
    : null;
  return {
    pendingEntries,
    activeEntryId: requestedActive ?? sessionEntryIds[0] ?? pendingEntries[0]?.id ?? null,
    sessionEntryIds,
  };
}

function snapshotCompassDrafts(state: PersistedCompassDrafts): Required<PersistedCompassDrafts> {
  const pendingEntries = (state.pendingEntries ?? []).filter(entryHasDeliberateInput);
  const ids = new Set(pendingEntries.map((entry) => entry.id));
  return {
    pendingEntries,
    activeEntryId: state.activeEntryId && ids.has(state.activeEntryId) ? state.activeEntryId : null,
    sessionEntryIds: (state.sessionEntryIds ?? []).filter((id) => ids.has(id)),
  };
}

// New capture run starts after this much idle time. Keeps a single sitting
// (back-to-back captures) grouped under one sessionId for batch review.
const SESSION_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours

export const useTeaCompassStore = create<TeaCompassState>()(
  persist(
    (set, get) => ({
      entries: [],
      pendingEntries: [],
      activeEntryId: null,
      sessionEntryIds: [],
      draftAccountScopeId: activeAccountScope(),
      draftsByAccount: {},
      lastVendorId: null,
      lastVendorName: null,
      lastCurrency: 'NT',
      encounterContextByAccount: {},
      browseGrouping: 'date',
      browseFilter: 'all',
      browseSort: 'recent',
      browseLayout: 'list',
      libraryFilters: {},
      currentSessionId: null,
      lastCaptureAt: null,
      syncError: false,
      deletedIds: [],
      pendingPromotions: [],
      shippingRatePerKg: 0,
      customEras: [],

      setSyncError: (failed) => set({ syncError: failed }),

      switchDraftAccount: (accountId) => set((state) => {
        if (state.draftAccountScopeId === accountId) return state;
        const draftsByAccount = { ...state.draftsByAccount };
        if (state.draftAccountScopeId) {
          draftsByAccount[state.draftAccountScopeId] = snapshotCompassDrafts(state);
        }
        const target = accountId
          ? restoreCompassDraftsForAccount(draftsByAccount[accountId] ?? {}, accountId)
          : { pendingEntries: [], activeEntryId: null, sessionEntryIds: [] };
        return { ...target, draftsByAccount, draftAccountScopeId: accountId };
      }),

      addPendingPromotion: (id) =>
        set((s) => (s.pendingPromotions.includes(id)
          ? s
          : { pendingPromotions: [...s.pendingPromotions, id] })),

      removePendingPromotion: (id) =>
        set((s) => ({ pendingPromotions: s.pendingPromotions.filter((p) => p !== id) })),

      setShippingRatePerKg: (rate) => set({ shippingRatePerKg: rate }),

      addCustomEra: (era) => {
        const trimmed = era.trim();
        if (!trimmed) return;
        set((s) => (s.customEras.includes(trimmed)
          ? s
          : { customEras: [...s.customEras, trimmed] }));
      },

      addEntry: (entry) =>
        set((state) => ({
          entries: [entry, ...state.entries],
        })),

      updateEntry: (id, updates) =>
        set((state) => {
          const inPending = state.pendingEntries.some((e) => e.id === id);
          if (inPending) {
            return {
              pendingEntries: state.pendingEntries.map((e) =>
                e.id === id ? {
                  ...e,
                  ...updates,
                  touchedFields: touchedFieldsAfterUpdate(e, updates),
                  updatedAt: new Date().toISOString(),
                  synced: false,
                } : e
              ),
            };
          }
          return {
            entries: state.entries.map((e) =>
              e.id === id ? {
                ...e,
                ...updates,
                touchedFields: touchedFieldsAfterUpdate(e, updates),
                updatedAt: new Date().toISOString(),
                synced: false,
              } : e
            ),
          };
        }),

      removeEntry: (id) => {
        // Drop it from local state immediately so the UI responds at once...
        const existed = get().entries.some((e) => e.id === id);
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
          pendingEntries: state.pendingEntries.filter((e) => e.id !== id),
          sessionEntryIds: state.sessionEntryIds.filter((sid) => sid !== id),
          pendingPromotions: state.pendingPromotions.filter((p) => p !== id),
          activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
          // Tombstone a committed entry so hydrate won't re-add the still-on-server
          // row before the delete confirms. Cleared the moment the delete succeeds.
          deletedIds: existed && !state.deletedIds.includes(id)
            ? [...state.deletedIds, id]
            : state.deletedIds,
        }));
        // ...then delete it on the server. Without this the row reappears from
        // D1 on the next sync/refresh — the bug that made "Clean up" and the
        // per-card delete look broken. Fired unconditionally for any committed
        // entry: a row that never reached D1 just no-ops the DELETE (the
        // worker's WHERE clause matches nothing), which is harmless.
        if (existed && hasToken()) {
          // A row that never reached D1 no-ops the DELETE harmlessly (WHERE matches
          // nothing → 200). A thrown error means we genuinely couldn't reach the
          // server, so flag it: otherwise the row silently reappears on next
          // hydrate and the delete looks like it "didn't take".
          void api.compass.remove(id)
            .then(() => set((s) => ({ syncError: false, deletedIds: s.deletedIds.filter((d) => d !== id) })))
            .catch(() => set({ syncError: true })); // keep the tombstone — hydrate retries
        }
      },

      setActiveEntry: (id) => set({ activeEntryId: id }),

      startNewCapture: (category = 'tea') => {
        const state = get();
        // Continue the current sitting if recent; otherwise start a fresh
        // session so the batch-review surface can group one run's tastings.
        const now = Date.now();
        const continueSession =
          state.currentSessionId != null &&
          state.lastCaptureAt != null &&
          now - state.lastCaptureAt < SESSION_GAP_MS;
        const sessionId = continueSession ? state.currentSessionId! : crypto.randomUUID();
        const entry = createEmptyEntry(category, {
          vendorId: state.lastVendorId || undefined,
          vendorName: state.lastVendorName || undefined,
          priceCurrency: state.lastCurrency,
        });
        entry.draftAccountId = state.draftAccountScopeId ?? activeAccountScope() ?? 'guest';
        entry.sessionId = sessionId;
        const context = state.encounterContextByAccount[entry.draftAccountId];
        entry.journeyId = context?.journeyId ?? null;
        entry.visitId = context?.visitId ?? null;
        // Add to pendingEntries (NOT entries) — won't appear in Library until committed
        set((s) => ({
          pendingEntries: [entry, ...s.pendingEntries],
          activeEntryId: entry.id,
          sessionEntryIds: [...s.sessionEntryIds, entry.id],
          currentSessionId: sessionId,
          lastCaptureAt: now,
        }));
        return entry.id;
      },

      commitEntry: (id) => {
        const state = get();
        const pending = state.pendingEntries.find((e) => e.id === id);
        if (pending) {
          if (entryHasDeliberateInput(pending)) {
            // Move from pending to committed entries
            set((s) => ({
              entries: [pending, ...s.entries],
              pendingEntries: s.pendingEntries.filter((e) => e.id !== id),
              sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
              activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
            }));
          } else {
            // Discard — no content worth saving
            set((s) => ({
              pendingEntries: s.pendingEntries.filter((e) => e.id !== id),
              sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
              activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
            }));
          }
        } else {
          // Already committed entry (e.g., editing from Library) — just remove from session
          set((state) => ({
            sessionEntryIds: state.sessionEntryIds.filter((sid) => sid !== id),
            activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
          }));
        }
      },

      discardEntry: (id) => {
        const state = get();
        const isPending = state.pendingEntries.some((e) => e.id === id);
        if (isPending) {
          set((s) => ({
            pendingEntries: s.pendingEntries.filter((e) => e.id !== id),
            sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
            activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
          }));
        } else {
          // Committed entry being re-edited — exit session without deleting
          set((s) => ({
            sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
            activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
          }));
        }
      },

      setLastVendor: (vendorId, vendorName) =>
        set({ lastVendorId: vendorId, lastVendorName: vendorName }),

      setLastCurrency: (currency) => set({ lastCurrency: currency }),

      setEncounterContext: (entryId, journeyId, visitId) => set((state) => {
        const scope = state.draftAccountScopeId ?? activeAccountScope() ?? 'guest';
        const update = { journeyId, visitId };
        const apply = (entry: TeaCompassEntry) => entry.id === entryId
          ? { ...entry, ...update, touchedFields: Array.from(new Set([...(entry.touchedFields ?? []), 'journeyId', 'visitId'])), updatedAt: new Date().toISOString(), synced: false }
          : entry;
        return {
          pendingEntries: state.pendingEntries.map(apply),
          entries: state.entries.map(apply),
          encounterContextByAccount: { ...state.encounterContextByAccount, [scope]: update },
        };
      }),
      clearJourneyReferences: (journeyId) => set((state) => {
        const clear = (entry: TeaCompassEntry) => entry.journeyId === journeyId
          ? { ...entry, journeyId: null, synced: false, updatedAt: new Date().toISOString() }
          : entry;
        const contexts = Object.fromEntries(Object.entries(state.encounterContextByAccount).map(([account, context]) => [account, context.journeyId === journeyId ? { ...context, journeyId: null } : context]));
        return { entries: state.entries.map(clear), pendingEntries: state.pendingEntries.map(clear), encounterContextByAccount: contexts };
      }),
      clearVisitReferences: (visitId) => set((state) => {
        const clear = (entry: TeaCompassEntry) => entry.visitId === visitId
          ? { ...entry, visitId: null, synced: false, updatedAt: new Date().toISOString() }
          : entry;
        const contexts = Object.fromEntries(Object.entries(state.encounterContextByAccount).map(([account, context]) => [account, context.visitId === visitId ? { ...context, visitId: null } : context]));
        return { entries: state.entries.map(clear), pendingEntries: state.pendingEntries.map(clear), encounterContextByAccount: contexts };
      }),

      setBrowseGrouping: (grouping) => set({ browseGrouping: grouping }),
      setBrowseFilter: (filter) => set({ browseFilter: filter }),
      setBrowseSort: (sort) => set({ browseSort: sort }),
      setBrowseLayout: (layout) => set({ browseLayout: layout }),
      setLibraryFilters: (filters) => set({ libraryFilters: filters }),

      getEntry: (id) => {
        const state = get();
        return state.pendingEntries.find((e) => e.id === id) ?? state.entries.find((e) => e.id === id);
      },

      getBuyingEntries: () => get().entries.filter((e) => e.status === 'buying'),

      getSessionEntries: () => {
        const state = get();
        return state.sessionEntryIds
          .map((id) => state.pendingEntries.find((e) => e.id === id) ?? state.entries.find((e) => e.id === id))
          .filter((e): e is TeaCompassEntry => e !== undefined);
      },
    }),
    {
      name: 'teajia-compass',
      partialize: (state) => {
        const draftsByAccount = { ...state.draftsByAccount };
        if (state.draftAccountScopeId) {
          draftsByAccount[state.draftAccountScopeId] = snapshotCompassDrafts(state);
        }
        return {
          entries: state.entries,
          lastVendorId: state.lastVendorId,
          lastVendorName: state.lastVendorName,
          lastCurrency: state.lastCurrency,
          encounterContextByAccount: state.encounterContextByAccount,
          browseGrouping: state.browseGrouping,
          browseFilter: state.browseFilter,
          browseSort: state.browseSort,
          browseLayout: state.browseLayout,
          libraryFilters: state.libraryFilters,
          currentSessionId: state.currentSessionId,
          lastCaptureAt: state.lastCaptureAt,
          shippingRatePerKg: state.shippingRatePerKg,
          customEras: state.customEras,
          deletedIds: state.deletedIds, // survive reloads so a pending delete still wins
          pendingPromotions: state.pendingPromotions, // survive reloads so a failed promote still retries
          pendingEntries: state.pendingEntries.filter(entryHasDeliberateInput),
          activeEntryId: state.activeEntryId,
          sessionEntryIds: state.sessionEntryIds,
          draftAccountScopeId: state.draftAccountScopeId,
          draftsByAccount,
        };
      },
      version: 5,
      migrate: migrateCompassPersistedState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<TeaCompassState>;
        const scope = activeAccountScope();
        const buckets = persisted.draftsByAccount ?? {};
        const drafts = restoreCompassDraftsForAccount(buckets[scope ?? ''] ?? persisted, scope);
        return {
          ...currentState, ...persisted, ...drafts,
          draftsByAccount: buckets,
          draftAccountScopeId: scope,
        } as TeaCompassState;
      },
    }
  )
);

export function migrateCompassPersistedState(persistedState: unknown, version: number): unknown {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const previous = persistedState as Partial<TeaCompassState> & { browseFilter?: string };
        const scope = previous.draftAccountScopeId ?? activeAccountScope();
        if (version < 1) {
          previous.pendingEntries = (previous.pendingEntries ?? []).map((entry) => ({
            ...entry,
            touchedFields: entry.touchedFields,
            draftAccountId: entry.draftAccountId ?? scope ?? undefined,
          }));
        }
        if (version < 2 && scope) {
          previous.draftsByAccount = {
            ...(previous.draftsByAccount ?? {}),
            [scope]: snapshotCompassDrafts(previous),
          };
        }
        if (version < 4) {
          const legacyFilter = previous.browseFilter as string | undefined;
          previous.browseFilter = legacyFilter === 'queue' ? 'to_taste'
            : 'all';
          previous.libraryFilters = {};
        }
        if (version < 5) {
          const migrateSample = (entry: TeaCompassEntry) => entry.sampleState === undefined && entry.isSample === true
            ? { ...entry, sampleState: 'requested' as const }
            : entry;
          previous.entries = (previous.entries ?? []).map(migrateSample);
          previous.pendingEntries = (previous.pendingEntries ?? []).map(migrateSample);
        }
        return previous;
}
