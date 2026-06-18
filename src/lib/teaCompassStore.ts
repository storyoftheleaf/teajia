import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaCompassEntry, CompassCategory, BrowseGrouping, BrowseFilter, BrowseSort, BrowseLayout } from '../components/TeaCompass/types';
import { createEmptyEntry } from '../components/TeaCompass/types';
import type { Currency } from '../admin/types';
import { api, hasToken } from './api';

interface TeaCompassState {
  // Committed entries (persisted to localStorage + server)
  entries: TeaCompassEntry[];
  // Pending entries — created but not yet committed (NOT persisted, lost on refresh)
  pendingEntries: TeaCompassEntry[];

  // Session
  activeEntryId: string | null;
  sessionEntryIds: string[]; // IDs of entries created in current session

  // Vendor persistence
  lastVendorId: string | null;
  lastVendorName: string | null;
  lastCurrency: Currency;

  // Browse state
  browseGrouping: BrowseGrouping;
  browseFilter: BrowseFilter;
  browseSort: BrowseSort;
  browseLayout: BrowseLayout;

  // Capture session — entries created in one contiguous run share this id.
  // A fresh id is minted when a capture starts after SESSION_GAP_MS of idle,
  // so a "review the batch I just tasted" surface can group a sitting.
  currentSessionId: string | null;
  lastCaptureAt: number | null;

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

  // Discard a pending capture without saving. For committed entries being re-edited, just exits the session.
  discardEntry: (id: string) => void;

  // Helpers
  getEntry: (id: string) => TeaCompassEntry | undefined;
  getBuyingEntries: () => TeaCompassEntry[]; // legacy
  getSessionEntries: () => TeaCompassEntry[];
}

/** An entry has meaningful content if it has a name, photo, notes, or real tasting data.
 *  Selecting a type, status, or vendor alone does NOT count — those are too easy to tap accidentally. */
export function entryHasContent(entry: TeaCompassEntry): boolean {
  return (
    entry.name.trim().length > 0 ||
    entry.photos.length > 0 ||
    entry.notes.trim().length > 0 ||
    (entry.tasting != null &&
      Object.values(entry.tasting).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null
      ))
  );
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
      lastVendorId: null,
      lastVendorName: null,
      lastCurrency: 'NT',
      browseGrouping: 'date',
      browseFilter: 'all',
      browseSort: 'recent',
      browseLayout: 'list',
      currentSessionId: null,
      lastCaptureAt: null,
      shippingRatePerKg: 0,
      customEras: [],

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
                e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString(), synced: false } : e
              ),
            };
          }
          return {
            entries: state.entries.map((e) =>
              e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString(), synced: false } : e
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
          activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
        }));
        // ...then delete it on the server. Without this the row reappears from
        // D1 on the next sync/refresh — the bug that made "Clean up" and the
        // per-card delete look broken. Fired unconditionally for any committed
        // entry: a row that never reached D1 just no-ops the DELETE (the
        // worker's WHERE clause matches nothing), which is harmless.
        if (existed && hasToken()) {
          void api.compass.remove(id).catch(() => { /* already gone or offline — local removal stands */ });
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
        entry.sessionId = sessionId;
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
          if (entryHasContent(pending)) {
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

      setBrowseGrouping: (grouping) => set({ browseGrouping: grouping }),
      setBrowseFilter: (filter) => set({ browseFilter: filter }),
      setBrowseSort: (sort) => set({ browseSort: sort }),
      setBrowseLayout: (layout) => set({ browseLayout: layout }),

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
      partialize: (state) => ({
        entries: state.entries,
        lastVendorId: state.lastVendorId,
        lastVendorName: state.lastVendorName,
        lastCurrency: state.lastCurrency,
        browseGrouping: state.browseGrouping,
        browseFilter: state.browseFilter,
        browseSort: state.browseSort,
        browseLayout: state.browseLayout,
        currentSessionId: state.currentSessionId,
        lastCaptureAt: state.lastCaptureAt,
        shippingRatePerKg: state.shippingRatePerKg,
        customEras: state.customEras,
        // pendingEntries, activeEntryId, sessionEntryIds are intentionally NOT persisted
      }),
    }
  )
);
