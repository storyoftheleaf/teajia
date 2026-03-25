import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency } from '../admin/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransactionDirection = 'purchase' | 'sale';

export interface LedgerLineItem {
  id: string;
  name: string;
  chineseName?: string;
  type?: string;         // Tea type or 'Teaware'
  form?: string;         // Cake, Loose, etc.
  year?: number;

  quantityGrams?: number;   // For tea (gram-based)
  quantityUnits?: number;   // For unit-based (cakes, teaware)
  unitWeightGrams?: number; // Weight per unit (e.g. 357 for cake)

  pricePerUnit: number;      // Price per gram or per unit
  priceIsPerGram: boolean;   // true = price/gram, false = price/unit
  currency: Currency;

  // Link back to source
  compassEntryId?: string;   // If added from Tea Compass
  productId?: string;        // If added from inventory (for sales)

  addedAt: string;
}

export interface LedgerTransaction {
  id: string;
  direction: TransactionDirection;

  // Counterparty
  counterpartyName: string;  // Vendor name (purchase) or customer name (sale)
  counterpartyId?: string;

  // Line items
  items: LedgerLineItem[];

  // State
  status: 'draft' | 'confirmed';
  currency: Currency;

  createdAt: string;
  updatedAt: string;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface LedgerState {
  transactions: LedgerTransaction[];

  // Active transaction being built
  activeTransactionId: string | null;

  // Actions
  createTransaction: (direction: TransactionDirection, counterpartyName: string, currency: Currency, counterpartyId?: string) => string;
  addLineItem: (transactionId: string, item: Omit<LedgerLineItem, 'id' | 'addedAt'>) => void;
  updateLineItem: (transactionId: string, itemId: string, updates: Partial<LedgerLineItem>) => void;
  removeLineItem: (transactionId: string, itemId: string) => void;
  updateTransaction: (transactionId: string, updates: Partial<Pick<LedgerTransaction, 'counterpartyName' | 'counterpartyId' | 'currency' | 'status'>>) => void;
  removeTransaction: (transactionId: string) => void;
  confirmTransaction: (transactionId: string) => void;
  setActiveTransaction: (id: string | null) => void;

  // Helpers
  getTransaction: (id: string) => LedgerTransaction | undefined;
  getDraftTransactions: () => LedgerTransaction[];
  getConfirmedTransactions: () => LedgerTransaction[];
  getActiveTransaction: () => LedgerTransaction | undefined;
  getOrCreatePurchaseTransaction: (vendorName: string, currency: Currency, vendorId?: string) => string;
}

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      transactions: [],
      activeTransactionId: null,

      createTransaction: (direction, counterpartyName, currency, counterpartyId) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const tx: LedgerTransaction = {
          id,
          direction,
          counterpartyName,
          counterpartyId,
          items: [],
          status: 'draft',
          currency,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          transactions: [tx, ...s.transactions],
          activeTransactionId: id,
        }));
        return id;
      },

      addLineItem: (transactionId, itemData) => {
        const item: LedgerLineItem = {
          ...itemData,
          id: crypto.randomUUID(),
          addedAt: new Date().toISOString(),
        };
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, items: [...tx.items, item], updatedAt: new Date().toISOString() }
              : tx
          ),
        }));
      },

      updateLineItem: (transactionId, itemId, updates) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? {
                  ...tx,
                  items: tx.items.map((item) =>
                    item.id === itemId ? { ...item, ...updates } : item
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : tx
          ),
        }));
      },

      removeLineItem: (transactionId, itemId) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? {
                  ...tx,
                  items: tx.items.filter((item) => item.id !== itemId),
                  updatedAt: new Date().toISOString(),
                }
              : tx
          ),
        }));
      },

      updateTransaction: (transactionId, updates) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, ...updates, updatedAt: new Date().toISOString() }
              : tx
          ),
        }));
      },

      removeTransaction: (transactionId) => {
        set((s) => ({
          transactions: s.transactions.filter((tx) => tx.id !== transactionId),
          activeTransactionId:
            s.activeTransactionId === transactionId ? null : s.activeTransactionId,
        }));
      },

      confirmTransaction: (transactionId) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, status: 'confirmed' as const, updatedAt: new Date().toISOString() }
              : tx
          ),
        }));
      },

      setActiveTransaction: (id) => set({ activeTransactionId: id }),

      getTransaction: (id) => get().transactions.find((tx) => tx.id === id),

      getDraftTransactions: () =>
        get().transactions.filter((tx) => tx.status === 'draft'),

      getConfirmedTransactions: () =>
        get().transactions.filter((tx) => tx.status === 'confirmed'),

      getActiveTransaction: () => {
        const state = get();
        if (!state.activeTransactionId) return undefined;
        return state.transactions.find((tx) => tx.id === state.activeTransactionId);
      },

      // Find or create a draft purchase transaction for a vendor
      getOrCreatePurchaseTransaction: (vendorName, currency, vendorId) => {
        const state = get();
        // Look for an existing draft purchase from the same vendor
        const existing = state.transactions.find(
          (tx) =>
            tx.status === 'draft' &&
            tx.direction === 'purchase' &&
            tx.counterpartyName === vendorName
        );
        if (existing) {
          set({ activeTransactionId: existing.id });
          return existing.id;
        }
        // Create a new one
        return get().createTransaction('purchase', vendorName, currency, vendorId);
      },
    }),
    {
      name: 'teajia-ledger',
      partialize: (state) => ({
        transactions: state.transactions,
        activeTransactionId: state.activeTransactionId,
      }),
    }
  )
);
