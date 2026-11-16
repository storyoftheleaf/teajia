import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaCompassEntry, CompassCategory, BrowseGrouping, BrowseFilter, BrowseSort, BrowseLayout, LibraryFilters } from '../components/TeaCompass/types';
import { createEmptyEntry, entryIsSample, normalizeCompassEntry } from '../components/TeaCompass/types';
import type { Currency } from '../admin/types';
import { api, hasToken, isTokenScopedToAccount } from './api';
import { useNotesStore } from './notesStore';
import { useAppStore } from './store';
import { preserveLegacyLocalBytes } from './preserveLegacyLocalBytes';
import { editsAfterUpdate } from './compassFieldEdits';

interface TeaCompassState {
  // Committed entries (persisted to localStorage + server)
  entries: TeaCompassEntry[];
  accountScopeId: string | null;
  userScopeId: string | null;
  accountScopeRevision: number;
  entriesByAccount: Record<string, TeaCompassEntry[]>;
  deletedIdsByAccount: Record<string, string[]>;
  pendingPromotionsByAccount: Record<string, string[]>;
  switchAccount: (accountId: string | null, userId?: string | null) => void;
  // Pending entries, created but not yet committed (NOT persisted, lost on refresh)
  pendingEntries: TeaCompassEntry[];

  // Session
  activeEntryId: string | null;
  sessionEntryIds: string[]; // IDs of entries created in current session
  draftAccountScopeId: string | null;
  draftsByAccount: Record<string, Required<PersistedCompassDrafts>>;
  workspaceByPerson: Record<string, CompassWorkspaceSnapshot>;
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

  // Capture session, entries created in one contiguous run share this id.
  // A fresh id is minted when a capture starts after SESSION_GAP_MS of idle,
  // so a "review the batch I just tasted" surface can group a sitting.
  currentSessionId: string | null;
  lastCaptureAt: number | null;

  // Sync health, true when the most recent server write (entry sync OR delete)
  // failed to reach D1. Lets the UI say "couldn't save, check connection" instead
  // of silently pretending a local-only change persisted (the China/offline trap).
  syncError: boolean;
  setSyncError: (failed: boolean) => void;
  hydrationStatus: 'idle' | 'loading' | 'ready' | 'error';
  setHydrationStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;

  // Tombstones, ids deleted locally whose server delete hasn't been confirmed.
  // Hydrate filters these out so a still-on-server row can't reappear before the
  // delete lands (the "I deleted it and it came back" bug), and retries the delete.
  deletedIds: string[];

  // Entries whose promote-to-draft call failed (offline/timeout at commit time).
  // The sync heartbeat retries these until the draft exists, previously a
  // failed promotion was silent and the tea just never appeared in
  // /admin/capture. Persisted so a page reload doesn't lose the intent.
  pendingPromotions: string[];
  addPendingPromotion: (id: string) => void;
  removePendingPromotion: (id: string) => void;

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
  retainEntry: (id: string) => void;
  commitEntry: (id: string) => void; // finalize entry: if has content → moves to entries; else discards
  // Mint a fresh capture run (sessionId). Subsequent captures group under the
  // new id instead of continuing the previous sitting. Uses the existing
  // currentSessionId/lastCaptureAt fields; no new data model.
  startNewRun: () => void;
  // Curate v2: a table is a run with a vendor. A new table is a new run AND
  // forgets whose table the last one was, so it never shows the old vendor
  // while the new one is being picked.
  startNewTable: () => void;
  // Add a tea to the open table. A table stays open until a new one is
  // started, so unlike startNewCapture it never lets six idle hours turn the
  // next tea into a different run.
  startNewCaptureOnTable: (category?: CompassCategory) => string;
  // Name the open table's vendor: remembered for the next teas, and filled
  // onto every tea already on the table that has none.
  setTableVendor: (vendorId: string | null, vendorName: string | null) => void;

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
    (entry.name || '').trim().length > 0 || (entry.photos?.length ?? 0) > 0 || (entry.notes || '').trim().length > 0 ||
    (entry.audioClips?.length ?? 0) > 0 || !!entry.chineseName?.trim() ||
    entry.priceAmount != null || entry.sellPrice != null || entry.type != null ||
    entry.form != null || entry.year != null || entry.season != null || entry.storage != null ||
    !!entry.originRegion?.trim() || entry.status !== 'noted' || entry.buyQuantityGrams != null ||
    entry.buyQuantityUnits != null || entry.buyTotal != null || entry.teawareCategory != null ||
    entry.material != null || entry.clayType != null || !!entry.materialNote?.trim() ||
    entry.capacityMl != null || entry.quantity !== 1 || entry.era != null ||
    entry.verdict != null || entryIsSample(entry) || entry.sampleGrams != null ||
    entry.sampleVerdict != null || entry.sampleWouldBuy != null || entry.tasteOrder != null ||
    (touched === undefined && (!!entry.vendorName?.trim() || !!entry.vendorId)) ||
    (entry.tasting != null && Object.values(entry.tasting).some((value) =>
      Array.isArray(value) ? value.length > 0 : value != null
    ))
  ) return true;

  // Notes typed in the NoteThread are stored in the notes store keyed by the
  // entry id (and/or its teaKey), NOT on entry.notes, so an entry whose only
  // content is thread notes must still count as having content, or committing
  // it would discard the entry and orphan those notes.
  const ns = useNotesStore.getState();
  if (ns.getNotesForCompassEntry(entry.id).length > 0) return true;
  if (entry.teaKey && ns.getNotesForTea(entry.teaKey).length > 0) return true;
  return false;
}

/** Backward-compatible alias for consumers outside the retention flow. */
export const entryHasContent = entryHasDeliberateInput;

/**
 * The teas on the open table (Curate v2): exactly those whose sessionId is the
 * current run, drafts and saved, tea and teaware, oldest first. A draft that
 * has had nothing entered is not a row; a saved tea always is. The Table tab's
 * rows and its header count both come from here, so they cannot disagree.
 */
export function selectTableEntries(
  state: Pick<TeaCompassState, 'pendingEntries' | 'entries' | 'currentSessionId'>,
): TeaCompassEntry[] {
  const sid = state.currentSessionId;
  if (!sid) return [];
  const drafts = state.pendingEntries.filter((e) => e.sessionId === sid && entryHasDeliberateInput(e));
  const saved = state.entries.filter((e) => e.sessionId === sid);
  // Both lists keep the newest first; reversing before a stable sort keeps
  // the pour order when two teas share a timestamp.
  return [...drafts, ...saved]
    .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
    .reverse()
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

interface PersistedCompassDrafts {
  pendingEntries?: TeaCompassEntry[];
  activeEntryId?: string | null;
  sessionEntryIds?: string[];
}

interface CompassWorkspaceSnapshot {
  lastVendorId: string | null;
  lastVendorName: string | null;
  lastCurrency: Currency;
  currentSessionId: string | null;
  lastCaptureAt: number | null;
}

function snapshotCompassWorkspace(state: CompassWorkspaceSnapshot): CompassWorkspaceSnapshot {
  return {
    lastVendorId: state.lastVendorId,
    lastVendorName: state.lastVendorName,
    lastCurrency: state.lastCurrency,
    currentSessionId: state.currentSessionId,
    lastCaptureAt: state.lastCaptureAt,
  };
}

const EMPTY_COMPASS_WORKSPACE: CompassWorkspaceSnapshot = {
  lastVendorId: null, lastVendorName: null, lastCurrency: 'Yuan',
  currentSessionId: null, lastCaptureAt: null,
};

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

function activeUserScope(): string | null {
  return useAppStore.getState().activeUserId;
}

/** Versioned key: old account-only keys remain quarantined in the same maps. */
export function compassPersonKey(accountId: string | null, userId: string | null): string | null {
  return accountId && userId ? `person:${encodeURIComponent(accountId)}:${encodeURIComponent(userId)}` : null;
}

export function restoreCompassDraftsForAccount(
  persisted: PersistedCompassDrafts,
  activeAccountId: string | null,
): Required<PersistedCompassDrafts> {
  if (!activeAccountId) return { pendingEntries: [], activeEntryId: null, sessionEntryIds: [] };
  const pendingEntries = (persisted.pendingEntries ?? []).map(normalizeCompassEntry).filter((entry) =>
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
const UNSCOPED_LEGACY_ACCOUNT = '__legacy_unscoped__';

preserveLegacyLocalBytes('teajia-compass', 'teajia-compass-legacy-recovery', 9);

const createdTeaCompassStore = create<TeaCompassState>()(
  persist(
    (set, get) => ({
      entries: [],
      accountScopeId: activeAccountScope(),
      userScopeId: activeUserScope(),
      accountScopeRevision: 0,
      entriesByAccount: {},
      deletedIdsByAccount: {},
      pendingPromotionsByAccount: {},
      pendingEntries: [],
      activeEntryId: null,
      sessionEntryIds: [],
      draftAccountScopeId: activeAccountScope(),
      draftsByAccount: {},
      workspaceByPerson: {},
      lastVendorId: null,
      lastVendorName: null,
      // Adrian's 2026-09-07 rule: everything is bought and air-freighted from
      // China, so a fresh session's capture card opens on Yuan, not Taiwan
      // dollars. Still only a remembered default: `setLastCurrency` only
      // moves this when the operator actually picks a currency, and
      // `createEmptyEntry`'s own `touchedFields` gate is what keeps this
      // value from being sent to the server as a stated currency until then.
      lastCurrency: 'Yuan',
      encounterContextByAccount: {},
      browseGrouping: 'date',
      browseFilter: 'all',
      browseSort: 'recent',
      browseLayout: 'list',
      libraryFilters: {},
      currentSessionId: null,
      lastCaptureAt: null,
      syncError: false,
      hydrationStatus: 'idle',
      deletedIds: [],
      pendingPromotions: [],
      customEras: [],

      setSyncError: (failed) => set({ syncError: failed }),
      setHydrationStatus: (hydrationStatus) => set({ hydrationStatus }),

      switchAccount: (accountId, userId = activeUserScope()) => set((state) => {
        const targetKey = compassPersonKey(accountId, userId);
        const previousKey = compassPersonKey(state.accountScopeId, state.userScopeId);
        if (state.accountScopeId === accountId && state.userScopeId === userId && state.draftAccountScopeId === accountId) return state;
        const entriesByAccount = { ...state.entriesByAccount };
        const deletedIdsByAccount = { ...state.deletedIdsByAccount };
        const pendingPromotionsByAccount = { ...state.pendingPromotionsByAccount };
        if (previousKey) {
          entriesByAccount[previousKey] = state.entries;
          deletedIdsByAccount[previousKey] = state.deletedIds;
          pendingPromotionsByAccount[previousKey] = state.pendingPromotions;
        } else if (state.entries.length || state.deletedIds.length || state.pendingPromotions.length) {
          // Old facades have no trustworthy author. Retain them without assigning one.
          const legacyKey = state.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
          entriesByAccount[legacyKey] ??= state.entries;
          deletedIdsByAccount[legacyKey] ??= state.deletedIds;
          pendingPromotionsByAccount[legacyKey] ??= state.pendingPromotions;
        }

        const draftsByAccount = { ...state.draftsByAccount };
        if (state.draftAccountScopeId) {
          const oldDraftKey = previousKey ?? state.draftAccountScopeId;
          if (previousKey) draftsByAccount[oldDraftKey] = snapshotCompassDrafts(state);
          else draftsByAccount[oldDraftKey] ??= snapshotCompassDrafts(state);
        }
        const target = targetKey
          ? restoreCompassDraftsForAccount(draftsByAccount[targetKey] ?? {}, accountId)
          : { pendingEntries: [], activeEntryId: null, sessionEntryIds: [] };
        const workspaceByPerson = { ...state.workspaceByPerson };
        const oldWorkspaceKey = previousKey ?? state.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
        if (previousKey) workspaceByPerson[oldWorkspaceKey] = snapshotCompassWorkspace(state);
        else workspaceByPerson[oldWorkspaceKey] ??= snapshotCompassWorkspace(state);
        return {
          ...target,
          ...(targetKey ? workspaceByPerson[targetKey] ?? EMPTY_COMPASS_WORKSPACE : EMPTY_COMPASS_WORKSPACE),
          entries: targetKey ? entriesByAccount[targetKey] ?? [] : [],
          deletedIds: targetKey ? deletedIdsByAccount[targetKey] ?? [] : [],
          pendingPromotions: targetKey ? pendingPromotionsByAccount[targetKey] ?? [] : [],
          entriesByAccount,
          deletedIdsByAccount,
          pendingPromotionsByAccount,
          accountScopeId: accountId,
          userScopeId: userId ?? null,
          accountScopeRevision: state.accountScopeRevision + 1,
          hydrationStatus: 'idle',
          draftsByAccount,
          workspaceByPerson,
          draftAccountScopeId: accountId,
        };
      }),

      switchDraftAccount: (accountId) => get().switchAccount(accountId),

      addPendingPromotion: (id) =>
        set((s) => (s.pendingPromotions.includes(id)
          ? s
          : { pendingPromotions: [...s.pendingPromotions, id] })),

      removePendingPromotion: (id) =>
        set((s) => ({ pendingPromotions: s.pendingPromotions.filter((p) => p !== id) })),


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
          const now = new Date().toISOString();
          if (inPending) {
            return {
              pendingEntries: state.pendingEntries.map((e) =>
                e.id === id ? {
                  ...e,
                  ...updates,
                  touchedFields: touchedFieldsAfterUpdate(e, updates),
                  unsyncedEdits: editsAfterUpdate(e, updates, now),
                  updatedAt: now,
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
                unsyncedEdits: editsAfterUpdate(e, updates, now),
                updatedAt: now,
                synced: false,
              } : e
            ),
          };
        }),

      removeEntry: (id) => {
        // Drop it from local state immediately so the UI responds at once...
        const accountId = get().accountScopeId;
        const userId = get().userScopeId;
        const personKey = compassPersonKey(accountId, userId);
        const accountRevision = get().accountScopeRevision;
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
        // D1 on the next sync/refresh, the bug that made "Clean up" and the
        // per-card delete look broken. Fired unconditionally for any committed
        // entry: a row that never reached D1 just no-ops the DELETE (the
        // worker's WHERE clause matches nothing), which is harmless.
        if (existed && accountId && userId && personKey && hasToken() && isTokenScopedToAccount(accountId, userId)) {
          // A row that never reached D1 no-ops the DELETE harmlessly (WHERE matches
          // nothing → 200). A thrown error means we genuinely couldn't reach the
          // server, so flag it: otherwise the row silently reappears on next
          // hydrate and the delete looks like it "didn't take".
          void api.compass.remove(id, { expectedAuth: { accountId, userId } })
            .then(() => set((s) => {
              const deletedIdsByAccount = {
                ...s.deletedIdsByAccount,
                [personKey]: (s.deletedIdsByAccount[personKey] ?? []).filter((d) => d !== id),
              };
              if (s.accountScopeId === accountId && s.userScopeId === userId) {
                return {
                  deletedIdsByAccount,
                  deletedIds: s.deletedIds.filter((d) => d !== id),
                  ...(s.accountScopeRevision === accountRevision ? { syncError: false } : {}),
                };
              }
              return { deletedIdsByAccount };
            }))
            .catch(() => {
              const current = get();
              if (current.accountScopeId === accountId && current.accountScopeRevision === accountRevision) {
                set({ syncError: true });
              }
            }); // keep the tombstone, hydrate retries
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
        const contextKey = compassPersonKey(state.draftAccountScopeId, state.userScopeId);
        const context = contextKey ? state.encounterContextByAccount[contextKey] : undefined;
        entry.journeyId = context?.journeyId ?? null;
        entry.visitId = context?.visitId ?? null;
        // Add to pendingEntries (NOT entries), won't appear in Library until committed
        set((s) => ({
          pendingEntries: [entry, ...s.pendingEntries],
          activeEntryId: entry.id,
          sessionEntryIds: [...s.sessionEntryIds, entry.id],
          currentSessionId: sessionId,
          lastCaptureAt: now,
        }));
        return entry.id;
      },

      startNewRun: () => {
        set({ currentSessionId: crypto.randomUUID(), lastCaptureAt: Date.now() });
      },

      retainEntry: (id) => {
        const pending = get().pendingEntries.find(entry => entry.id === id);
        if (!pending || !entryHasDeliberateInput(pending)) return;
        set(state => ({ entries: [pending, ...state.entries], pendingEntries: state.pendingEntries.filter(entry => entry.id !== id) }));
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
            // Discard, no content worth saving
            set((s) => ({
              pendingEntries: s.pendingEntries.filter((e) => e.id !== id),
              sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
              activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
            }));
          }
        } else {
          // Already committed entry (e.g., editing from Library), just remove from session
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
          // Committed entry being re-edited, exit session without deleting
          set((s) => ({
            sessionEntryIds: s.sessionEntryIds.filter((sid) => sid !== id),
            activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
          }));
        }
      },

      startNewTable: () => {
        set({ currentSessionId: crypto.randomUUID(), lastCaptureAt: Date.now(), lastVendorId: null, lastVendorName: null });
      },

      startNewCaptureOnTable: (category = 'tea') => {
        if (get().currentSessionId) set({ lastCaptureAt: Date.now() });
        return get().startNewCapture(category);
      },

      setTableVendor: (vendorId, vendorName) => {
        const name = vendorName?.trim() || null;
        set({ lastVendorId: vendorId, lastVendorName: name });
        if (!name) return;
        const key = name.toLowerCase();
        for (const row of selectTableEntries(get())) {
          const theirs = row.vendorName?.trim();
          // Only teas with no vendor, or the same name still waiting for its id.
          const unset = !row.vendorId && (!theirs || theirs.toLowerCase() === key);
          if (!unset) continue;
          if (row.vendorName === name && (row.vendorId ?? null) === vendorId) continue;
          get().updateEntry(row.id, { vendorName: name, ...(vendorId ? { vendorId } : {}) });
        }
      },

      setLastVendor: (vendorId, vendorName) =>
        set({ lastVendorId: vendorId, lastVendorName: vendorName }),

      setLastCurrency: (currency) => set({ lastCurrency: currency }),

      setEncounterContext: (entryId, journeyId, visitId) => set((state) => {
        const scope = compassPersonKey(state.draftAccountScopeId, state.userScopeId);
        if (!scope) return state;
        const update = { journeyId, visitId };
        const now = new Date().toISOString();
        const apply = (entry: TeaCompassEntry) => entry.id === entryId
          ? { ...entry, ...update, touchedFields: Array.from(new Set([...(entry.touchedFields ?? []), 'journeyId', 'visitId'])), unsyncedEdits: editsAfterUpdate(entry, update, now), updatedAt: now, synced: false }
          : entry;
        return {
          pendingEntries: state.pendingEntries.map(apply),
          entries: state.entries.map(apply),
          encounterContextByAccount: { ...state.encounterContextByAccount, [scope]: update },
        };
      }),
      clearJourneyReferences: (journeyId) => set((state) => {
        const now = new Date().toISOString();
        const clear = (entry: TeaCompassEntry) => entry.journeyId === journeyId
          ? { ...entry, journeyId: null, unsyncedEdits: editsAfterUpdate(entry, { journeyId: null }, now), synced: false, updatedAt: now }
          : entry;
        const contexts = Object.fromEntries(Object.entries(state.encounterContextByAccount).map(([account, context]) => [account, context.journeyId === journeyId ? { ...context, journeyId: null } : context]));
        return { entries: state.entries.map(clear), pendingEntries: state.pendingEntries.map(clear), encounterContextByAccount: contexts };
      }),
      clearVisitReferences: (visitId) => set((state) => {
        const now = new Date().toISOString();
        const clear = (entry: TeaCompassEntry) => entry.visitId === visitId
          ? { ...entry, visitId: null, unsyncedEdits: editsAfterUpdate(entry, { visitId: null }, now), synced: false, updatedAt: now }
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
        const personKey = compassPersonKey(state.accountScopeId, state.userScopeId);
        const workspaceByPerson = { ...state.workspaceByPerson };
        if (personKey) workspaceByPerson[personKey] = snapshotCompassWorkspace(state);
        const entriesByAccount = { ...state.entriesByAccount };
        const deletedIdsByAccount = { ...state.deletedIdsByAccount };
        const pendingPromotionsByAccount = { ...state.pendingPromotionsByAccount };
        if (personKey) {
          entriesByAccount[personKey] = state.entries;
          deletedIdsByAccount[personKey] = state.deletedIds;
          pendingPromotionsByAccount[personKey] = state.pendingPromotions;
        }
        const draftsByAccount = { ...state.draftsByAccount };
        if (personKey && state.draftAccountScopeId === state.accountScopeId) {
          draftsByAccount[personKey] = snapshotCompassDrafts(state);
        }
        return {
          entries: state.entries,
          accountScopeId: state.accountScopeId,
          userScopeId: state.userScopeId,
          entriesByAccount,
          deletedIdsByAccount,
          pendingPromotionsByAccount,
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
          customEras: state.customEras,
          deletedIds: state.deletedIds, // survive reloads so a pending delete still wins
          pendingPromotions: state.pendingPromotions, // survive reloads so a failed promote still retries
          pendingEntries: state.pendingEntries.filter(entryHasDeliberateInput),
          activeEntryId: state.activeEntryId,
          sessionEntryIds: state.sessionEntryIds,
          draftAccountScopeId: state.draftAccountScopeId,
          draftsByAccount,
          workspaceByPerson,
        };
      },
      version: 9,
      migrate: migrateCompassPersistedState,
      merge: mergeCompassPersistedState,
    }
  )
);

export function mergeCompassPersistedState(
  persistedState: unknown,
  currentState: TeaCompassState,
): TeaCompassState {
  const persisted = (persistedState ?? {}) as Partial<TeaCompassState>;
  const scope = activeAccountScope();
  const userId = activeUserScope();
  const personKey = compassPersonKey(scope, userId);
  const workspaceByPerson = { ...(persisted.workspaceByPerson ?? {}) };
  const originalKey = compassPersonKey(persisted.accountScopeId ?? null, persisted.userScopeId ?? null)
    ?? persisted.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
  if (!workspaceByPerson[originalKey] && ('lastVendorId' in persisted || 'currentSessionId' in persisted)) {
    workspaceByPerson[originalKey] = snapshotCompassWorkspace({ ...EMPTY_COMPASS_WORKSPACE, ...persisted });
  }
  const draftBuckets = { ...(persisted.draftsByAccount ?? {}) };
  if ((persisted.pendingEntries?.length ?? 0) > 0) {
    const facadeDrafts: Required<PersistedCompassDrafts> = {
      pendingEntries: persisted.pendingEntries ?? [],
      activeEntryId: persisted.activeEntryId ?? null,
      sessionEntryIds: persisted.sessionEntryIds ?? [],
    };
    const facadeKey = compassPersonKey(persisted.accountScopeId ?? null, persisted.userScopeId ?? null)
      ?? persisted.draftAccountScopeId ?? persisted.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
    if (facadeKey) {
      if (!draftBuckets[facadeKey]) draftBuckets[facadeKey] = facadeDrafts;
      else if (JSON.stringify(draftBuckets[facadeKey]) !== JSON.stringify(facadeDrafts)) {
        draftBuckets[`__legacy_facade__:${facadeKey}`] = facadeDrafts;
      }
    }
  }
  const drafts = restoreCompassDraftsForAccount(personKey ? draftBuckets[personKey] ?? {} : {}, scope);
  const entryBuckets = { ...(persisted.entriesByAccount ?? {}) };
  const deletedBuckets = { ...(persisted.deletedIdsByAccount ?? {}) };
  const promotionBuckets = { ...(persisted.pendingPromotionsByAccount ?? {}) };
  const facadeEntries = (persisted.entries ?? currentState.entries).map(normalizeCompassEntry);
  if (!persisted.userScopeId) {
    const legacyKey = persisted.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
    // A v8 facade can be newer than its bucket (or have no bucket). Preserve
    // both versions under legacy keys; neither is evidence of an author.
    const archive = <T>(buckets: Record<string, T[]>, values: T[] | undefined) => {
      if (!values?.length) return;
      if (!buckets[legacyKey]) buckets[legacyKey] = values;
      else if (JSON.stringify(buckets[legacyKey]) !== JSON.stringify(values)) {
        buckets[`__legacy_facade__:${legacyKey}`] = values;
      }
    };
    archive(entryBuckets, persisted.entries);
    archive(deletedBuckets, persisted.deletedIds);
    archive(promotionBuckets, persisted.pendingPromotions);
  }
  // Account-only persisted keys and facades predate author identity. Keep their
  // bytes in the legacy maps, never load them as the current person's work.
  const facadeMatchesScope = !!personKey && persisted.accountScopeId === scope && persisted.userScopeId === userId;
  return {
    ...currentState, ...persisted, ...drafts,
    ...(personKey ? workspaceByPerson[personKey] ?? EMPTY_COMPASS_WORKSPACE : EMPTY_COMPASS_WORKSPACE),
    entries: personKey
      ? (entryBuckets[personKey] ?? (facadeMatchesScope ? facadeEntries : [])).map(normalizeCompassEntry)
      : [],
    deletedIds: personKey
      ? deletedBuckets[personKey] ?? (facadeMatchesScope ? persisted.deletedIds : []) ?? []
      : [],
    pendingPromotions: personKey
      ? promotionBuckets[personKey] ?? (facadeMatchesScope ? persisted.pendingPromotions : []) ?? []
      : [],
    entriesByAccount: entryBuckets,
    deletedIdsByAccount: deletedBuckets,
    pendingPromotionsByAccount: promotionBuckets,
    accountScopeId: scope,
    userScopeId: userId,
    draftsByAccount: draftBuckets,
    workspaceByPerson,
    draftAccountScopeId: scope,
  } as TeaCompassState;
}

export function migrateCompassPersistedState(persistedState: unknown, version: number): unknown {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const previous = persistedState as Partial<TeaCompassState> & { browseFilter?: string };
        const scope = previous.draftAccountScopeId ?? previous.accountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
        if (version < 1) {
          previous.pendingEntries = (previous.pendingEntries ?? []).map((entry) => ({
            ...entry,
            touchedFields: entry.touchedFields,
            draftAccountId: entry.draftAccountId ?? scope,
          }));
        }
        if (version < 2) {
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
        if (version < 6) {
          // Older builds queued automatic Done-time promotions. They are not
          // evidence of a deliberate Inventory choice, so never replay them.
          previous.pendingPromotions = [];
        }
        if (version < 7 && (previous.libraryFilters?.possession as string | undefined) === 'stock') {
          previous.libraryFilters = { ...previous.libraryFilters, possession: 'working' };
        }
        const entryScope = previous.accountScopeId ?? previous.draftAccountScopeId ?? UNSCOPED_LEGACY_ACCOUNT;
        if (version < 8) {
          previous.entriesByAccount = {
            ...(previous.entriesByAccount ?? {}),
            [entryScope]: previous.entries ?? [],
          };
          previous.deletedIdsByAccount = {
            ...(previous.deletedIdsByAccount ?? {}),
            [entryScope]: previous.deletedIds ?? [],
          };
          previous.pendingPromotionsByAccount = {
            ...(previous.pendingPromotionsByAccount ?? {}),
            [entryScope]: previous.pendingPromotions ?? [],
          };
          previous.accountScopeId = entryScope === UNSCOPED_LEGACY_ACCOUNT ? null : entryScope;
        }
        // Version 9 intentionally leaves all old account-only buckets in place.
        // No migration can infer who authored a local-only capture.
        return previous;
}


/**
 * One store per page, however many times this module is evaluated.
 *
 * Vite serves a hot-updated module under a new URL (`?t=<timestamp>`), so a
 * second evaluation is a second `create()` and a second, empty state. The app
 * keeps whichever copy it loaded first; anything that reaches the module by its
 * plain path afterwards gets the other one, writes into it, and watches the
 * screen not change. That is not only a test problem: an HMR edit during a
 * capture session drops the entries the operator has open.
 *
 * Binding the store to the page rather than to the module evaluation makes
 * every copy the same store.
 */
const TEA_COMPASS_STORE_KEY = '__teajia_teaCompassStore';
type TeaCompassStoreHandle = typeof createdTeaCompassStore;
const globalScope = globalThis as unknown as Record<string, TeaCompassStoreHandle | undefined>;
export const useTeaCompassStore: TeaCompassStoreHandle =
  globalScope[TEA_COMPASS_STORE_KEY] ?? (globalScope[TEA_COMPASS_STORE_KEY] = createdTeaCompassStore);

// Auth identity changes must clear the facade synchronously, before React can
// render another person's local work during the effect/hydration interval.
const COMPASS_AUTH_SUBSCRIPTION_KEY = '__teajia_compassAuthSubscription';
const subscriptionScope = globalThis as unknown as Record<string, boolean | undefined>;
if (!subscriptionScope[COMPASS_AUTH_SUBSCRIPTION_KEY]) {
  subscriptionScope[COMPASS_AUTH_SUBSCRIPTION_KEY] = true;
  useAppStore.subscribe((state, previous) => {
    if (state.activeUserId !== previous.activeUserId || state.activeAccountId !== previous.activeAccountId) {
      useTeaCompassStore.getState().switchAccount(state.activeAccountId, state.activeUserId);
    }
  });
}
