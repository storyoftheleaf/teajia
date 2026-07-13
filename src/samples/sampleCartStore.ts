import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { useAppStore } from '../lib/store';
import type { SampleSet, TeaSample } from './types';

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

export interface PendingSampleBatchOperation {
  signature: string;
  sampleSet: SampleSet;
  samples: TeaSample[];
}

interface SampleCartState {
  items: SampleCartItem[];
  accountScopeId: string | null;
  itemsByAccount: Record<string, SampleCartItem[]>;
  pendingOperation: PendingSampleBatchOperation | null;
  pendingOperationsByAccount: Record<string, PendingSampleBatchOperation>;
  switchAccount: (accountId: string | null) => void;
  addItem: (item: Omit<SampleCartItem, 'grams'> & { grams?: number }) => void;
  removeItem: (id: string) => void;
  updateGrams: (id: string, grams: number) => void;
  clear: () => void;
  setPendingOperation: (operation: PendingSampleBatchOperation) => void;
  completePendingOperation: (sampleSetId: string) => boolean;
  isInCart: (id: string) => boolean;
}

export function createSampleCartStore(storage?: PersistStorage<SampleCartState>) {
  return create<SampleCartState>()(
  persist(
    (set, get) => ({
      items: [],
      accountScopeId: null,
      itemsByAccount: {},
      pendingOperation: null,
      pendingOperationsByAccount: {},

      switchAccount: (accountId) => set((state) => {
        if (state.accountScopeId === accountId) return state;
        const itemsByAccount = { ...state.itemsByAccount };
        const pendingOperationsByAccount = { ...state.pendingOperationsByAccount };
        if (state.accountScopeId) {
          itemsByAccount[state.accountScopeId] = state.items;
          if (state.pendingOperation) pendingOperationsByAccount[state.accountScopeId] = state.pendingOperation;
          else delete pendingOperationsByAccount[state.accountScopeId];
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
          pendingOperation: accountId ? pendingOperationsByAccount[accountId] ?? null : null,
          accountScopeId: accountId,
          itemsByAccount,
          pendingOperationsByAccount,
        };
      }),

      addItem: (item) => {
        if (get().pendingOperation) return;
        const { grams = 10, ...rest } = item;
        if (get().items.some((i) => i.id === item.id)) return;
        set((state) => ({ items: [...state.items, { ...rest, grams }], pendingOperation: null }));
      },

      removeItem: (id) =>
        set((state) => state.pendingOperation
          ? state
          : { items: state.items.filter((i) => i.id !== id), pendingOperation: null }),

      updateGrams: (id, grams) =>
        set((state) => state.pendingOperation
          ? state
          : {
              items: state.items.map((i) => (i.id === id ? { ...i, grams } : i)),
              pendingOperation: null,
            }),

      clear: () => set((state) => state.pendingOperation ? state : { items: [], pendingOperation: null }),

      setPendingOperation: (operation) => set((state) => state.pendingOperation ? state : { pendingOperation: operation }),

      completePendingOperation: (sampleSetId) => {
        let completed = false;
        set((state) => {
          if (state.pendingOperation?.sampleSet.id !== sampleSetId) return state;
          completed = true;
          return { items: [], pendingOperation: null };
        });
        return completed;
      },

      isInCart: (id) => get().items.some((i) => i.id === id),
    }),
    {
      name: 'teajia-sample-cart',
      version: 2,
      migrate: (persisted) => persisted,
      ...(storage ? { storage } : {}),
      merge: mergeSampleCartPersistedState,
      partialize: (state) => {
        const itemsByAccount = { ...state.itemsByAccount };
        const pendingOperationsByAccount = { ...state.pendingOperationsByAccount };
        if (state.accountScopeId) {
          itemsByAccount[state.accountScopeId] = state.items;
          if (state.pendingOperation) pendingOperationsByAccount[state.accountScopeId] = state.pendingOperation;
          else delete pendingOperationsByAccount[state.accountScopeId];
        }
        return {
          items: state.items,
          pendingOperation: state.pendingOperation,
          accountScopeId: state.accountScopeId,
          itemsByAccount,
          pendingOperationsByAccount,
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
  const pendingOperationsByAccount = { ...(persisted.pendingOperationsByAccount ?? {}) };
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
    pendingOperation: activeAccountId
      ? pendingOperationsByAccount[activeAccountId] ?? (persisted.accountScopeId === activeAccountId ? persisted.pendingOperation : null) ?? null
      : null,
    accountScopeId: activeAccountId,
    itemsByAccount,
    pendingOperationsByAccount,
  };
}
