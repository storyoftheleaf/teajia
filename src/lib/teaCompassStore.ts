import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaCompassEntry, CompassCategory, BrowseGrouping, BrowseFilter } from '../components/TeaCompass/types';
import { createEmptyEntry } from '../components/TeaCompass/types';
import type { Currency } from '../admin/types';

interface TeaCompassState {
  // Entries
  entries: TeaCompassEntry[];

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

  // Actions
  addEntry: (entry: TeaCompassEntry) => void;
  updateEntry: (id: string, updates: Partial<TeaCompassEntry>) => void;
  removeEntry: (id: string) => void;
  setActiveEntry: (id: string | null) => void;

  // Session
  startNewCapture: (category?: CompassCategory) => string; // returns new entry ID
  commitEntry: (id: string) => void; // finalize entry: remove from session, keep in entries

  // Vendor
  setLastVendor: (vendorId: string | null, vendorName: string | null) => void;
  setLastCurrency: (currency: Currency) => void;

  // Browse
  setBrowseGrouping: (grouping: BrowseGrouping) => void;
  setBrowseFilter: (filter: BrowseFilter) => void;

  // Helpers
  getEntry: (id: string) => TeaCompassEntry | undefined;
  getBuyingEntries: () => TeaCompassEntry[];
  getSessionEntries: () => TeaCompassEntry[];
}

export const useTeaCompassStore = create<TeaCompassState>()(
  persist(
    (set, get) => ({
      entries: [],
      activeEntryId: null,
      sessionEntryIds: [],
      lastVendorId: null,
      lastVendorName: null,
      lastCurrency: 'NT',
      browseGrouping: 'date',
      browseFilter: 'all',

      addEntry: (entry) =>
        set((state) => ({
          entries: [entry, ...state.entries],
        })),

      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString(), synced: false } : e
          ),
        })),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
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
        set((s) => ({
          entries: [entry, ...s.entries],
          activeEntryId: entry.id,
          sessionEntryIds: [...s.sessionEntryIds, entry.id],
        }));
        return entry.id;
      },

      commitEntry: (id) =>
        set((state) => ({
          sessionEntryIds: state.sessionEntryIds.filter((sid) => sid !== id),
          activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
        })),

      setLastVendor: (vendorId, vendorName) =>
        set({ lastVendorId: vendorId, lastVendorName: vendorName }),

      setLastCurrency: (currency) => set({ lastCurrency: currency }),

      setBrowseGrouping: (grouping) => set({ browseGrouping: grouping }),
      setBrowseFilter: (filter) => set({ browseFilter: filter }),

      getEntry: (id) => get().entries.find((e) => e.id === id),

      getBuyingEntries: () => get().entries.filter((e) => e.status === 'buying'),

      getSessionEntries: () => {
        const state = get();
        return state.sessionEntryIds
          .map((id) => state.entries.find((e) => e.id === id))
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
      }),
    }
  )
);
