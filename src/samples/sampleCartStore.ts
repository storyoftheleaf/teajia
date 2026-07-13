import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useSampleCartStore = create<SampleCartState>()(
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
        } else if (accountId && state.items.length > 0 && !itemsByAccount[accountId]) {
          itemsByAccount[accountId] = state.items;
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
