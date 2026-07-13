import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { useAppStore } from '../lib/store';

const UNSCOPED_LEGACY_ACCOUNT = '__legacy_unscoped__';

export interface SampleCartItem {
  id: string;
  name: string;
  chineseName?: string;
  type?: string;
  vendorName?: string;
  grams: number;
  // Links back to source
  compassEntryId?: string;
  productId?: string;
  teaKey?: string;
}

interface SampleCartState {
  items: SampleCartItem[];
  accountScopeId: string | null;
  itemsByAccount: Record<string, SampleCartItem[]>;
  switchAccount: (accountId: string | null) => void;
  addItem: (item: Omit<SampleCartItem, 'grams'> & { grams?: number }) => void;
  removeItem: (id: string) => void;
  updateGrams: (id: string, grams: number) => void;
  clear: () => void;
  isInCart: (id: string) => boolean;
}

export function createSampleCartStore(storage?: PersistStorage<SampleCartState>) {
  return create<SampleCartState>()(
  persist(
    (set, get) => ({
      items: [],
      accountScopeId: null,
      itemsByAccount: {},

      switchAccount: (accountId) => set((state) => {
        if (state.accountScopeId === accountId) return state;
        const itemsByAccount = { ...state.itemsByAccount };
        if (state.accountScopeId) {
          itemsByAccount[state.accountScopeId] = state.items;
        } else if (
          accountId &&
          (state.items.length > 0 || itemsByAccount[UNSCOPED_LEGACY_ACCOUNT] !== undefined) &&
          !itemsByAccount[accountId]
        ) {
          itemsByAccount[accountId] = itemsByAccount[UNSCOPED_LEGACY_ACCOUNT] ?? state.items;
          delete itemsByAccount[UNSCOPED_LEGACY_ACCOUNT];
        }
        return {
          items: accountId ? itemsByAccount[accountId] ?? [] : [],
          accountScopeId: accountId,
          itemsByAccount,
        };
      }),

      addItem: (item) => {
        const { grams = 10, ...rest } = item;
        if (get().items.some((i) => i.id === item.id)) return;
        set((state) => ({ items: [...state.items, { ...rest, grams }] }));
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateGrams: (id, grams) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, grams } : i)),
        })),

      clear: () => set({ items: [] }),

      isInCart: (id) => get().items.some((i) => i.id === id),
    }),
    {
      name: 'teajia-sample-cart',
      version: 1,
      migrate: (persisted) => persisted,
      ...(storage ? { storage } : {}),
      merge: mergeSampleCartPersistedState,
      partialize: (state) => {
        const itemsByAccount = { ...state.itemsByAccount };
        if (state.accountScopeId) itemsByAccount[state.accountScopeId] = state.items;
        return {
          items: state.items,
          accountScopeId: state.accountScopeId,
          itemsByAccount,
        };
      },
    }
  )
  );
}

export const useSampleCartStore = createSampleCartStore();

function mergeSampleCartPersistedState(
  persistedState: unknown,
  currentState: SampleCartState,
): SampleCartState {
  const persisted = (persistedState ?? {}) as Partial<SampleCartState>;
  const activeAccountId = useAppStore.getState().activeAccountId;
  const itemsByAccount = { ...(persisted.itemsByAccount ?? {}) };
  const facade = persisted.items ?? [];
  const isUnscopedLegacy = persisted.accountScopeId == null && Object.keys(itemsByAccount).length === 0;
  if (isUnscopedLegacy && facade.length > 0) itemsByAccount[UNSCOPED_LEGACY_ACCOUNT] = facade;
  let items = activeAccountId ? itemsByAccount[activeAccountId] : undefined;
  if (!items && activeAccountId && persisted.accountScopeId === activeAccountId) items = facade;
  if (!items && activeAccountId && itemsByAccount[UNSCOPED_LEGACY_ACCOUNT]) {
    items = itemsByAccount[UNSCOPED_LEGACY_ACCOUNT];
    itemsByAccount[activeAccountId] = items;
    delete itemsByAccount[UNSCOPED_LEGACY_ACCOUNT];
  }
  return {
    ...currentState,
    ...persisted,
    items: items ?? [],
    accountScopeId: activeAccountId,
    itemsByAccount,
  };
}
