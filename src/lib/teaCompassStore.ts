import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaCompassEntry, CompassCategory, BrowseGrouping, BrowseFilter } from '../components/TeaCompass/types';
import { createEmptyEntry } from '../components/TeaCompass/types';
import type { Currency } from '../admin/types';

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

  // Pricing formula — shipping rate used in retail preview (same currency as entry cost)
  shippingRatePerKg: number;
  setShippingRatePerKg: (rate: number) => void;

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

  // Helpers
  getEntry: (id: string) => TeaCompassEntry | undefined;
  getBuyingEntries: () => TeaCompassEntry[]; // legacy
  getSessionEntries: () => TeaCompassEntry[];
}

/** An entry has meaningful content if it has a name, photo, notes, or real tasting data.
 *  Selecting a type, status, or vendor alone does NOT count — those are too easy to tap accidentally. */
function entryHasContent(entry: TeaCompassEntry): boolean {
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
      shippingRatePerKg: 0,

      setShippingRatePerKg: (rate) => set({ shippingRatePerKg: rate }),

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

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
          pendingEntries: state.pendingEntries.filter((e) => e.id !== id),
          sessionEntryIds: state.sessionEntryIds.filter((sid) => sid !== id),
          activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
        })),

      setActiveEntry: (id) => set({ activeEntryId: id }),

      startNewCapture: (category = 'tea') => {
        const state = get();
        const entry = createEmptyEntry(category, {
          vendorId: state.lastVendorId || undefined,
          vendorName: state.lastVendorName || undefined,
          priceCurrency: state.lastCurrency,
        });
        // Add to pendingEntries (NOT entries) — won't appear in Library until committed
        set((s) => ({
          pendingEntries: [entry, ...s.pendingEntries],
          activeEntryId: entry.id,
          sessionEntryIds: [...s.sessionEntryIds, entry.id],
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

      setLastVendor: (vendorId, vendorName) =>
        set({ lastVendorId: vendorId, lastVendorName: vendorName }),

      setLastCurrency: (currency) => set({ lastCurrency: currency }),

      setBrowseGrouping: (grouping) => set({ browseGrouping: grouping }),
      setBrowseFilter: (filter) => set({ browseFilter: filter }),

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
        shippingRatePerKg: state.shippingRatePerKg,
        // pendingEntries, activeEntryId, sessionEntryIds are intentionally NOT persisted
      }),
    }
  )
);
