import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency } from '../admin/types';
import { useAppStore } from './store';
import type { CurateReceiptProposal } from '../types';

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

  receiptProposal?: CurateReceiptProposal;
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

  // Photos (receipts, product shots, etc.)
  photos: string[];

  // State
  status: 'draft' | 'confirmed';
  confirmationPending?: boolean;
  confirmationError?: string;
  remoteOrderId?: string;
  currency: Currency;

  createdAt: string;
  updatedAt: string;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface LedgerState {
  transactions: LedgerTransaction[];
  accountScopeId: string | null;
  transactionsByAccount: Record<string, LedgerTransaction[]>;
  activeIdsByAccount: Record<string, string | null>;
  switchAccount: (accountId: string | null) => void;

  // Active transaction being built
  activeTransactionId: string | null;

  // Actions
  createTransaction: (direction: TransactionDirection, counterpartyName: string, currency: Currency, counterpartyId?: string) => string;
  addLineItem: (transactionId: string, item: Omit<LedgerLineItem, 'id' | 'addedAt'>) => string;
  updateLineItem: (transactionId: string, itemId: string, updates: Partial<LedgerLineItem>) => void;
  removeLineItem: (transactionId: string, itemId: string) => void;
  updateTransaction: (transactionId: string, updates: Partial<Pick<LedgerTransaction, 'counterpartyName' | 'counterpartyId' | 'currency' | 'status' | 'confirmationPending' | 'confirmationError' | 'remoteOrderId'>>) => void;
  addPhoto: (transactionId: string, url: string) => void;
  removePhoto: (transactionId: string, index: number) => void;
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

function activeLedgerAccount(): string | null {
  const current = useAppStore.getState().activeAccountId;
  if (current) return current;
  try {
    const token = localStorage.getItem('teajia_token') ?? sessionStorage.getItem('teajia_token');
    const payload = token?.split('.')[1];
    return payload ? JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).active_account_id ?? null : null;
  } catch { return null; }
}

const createdLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      transactions: [],
      accountScopeId: activeLedgerAccount(),
      transactionsByAccount: {},
      activeIdsByAccount: {},
      activeTransactionId: null,
      switchAccount: (accountId) => set(state => {
        if (state.accountScopeId === accountId) return state;
        const transactionsByAccount = { ...state.transactionsByAccount };
        const activeIdsByAccount = { ...state.activeIdsByAccount };
        if (state.accountScopeId) {
          transactionsByAccount[state.accountScopeId] = state.transactions;
          activeIdsByAccount[state.accountScopeId] = state.activeTransactionId;
        }
        return { accountScopeId: accountId, transactionsByAccount, activeIdsByAccount,
          transactions: accountId ? transactionsByAccount[accountId] ?? [] : [],
          activeTransactionId: accountId ? activeIdsByAccount[accountId] ?? null : null };
      }),

      createTransaction: (direction, counterpartyName, currency, counterpartyId) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const tx: LedgerTransaction = {
          id,
          direction,
          counterpartyName,
          counterpartyId,
          items: [],
          photos: [],
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
        const existing = get().transactions.find((tx) => tx.id === transactionId)?.items.find(
          (item) => itemData.compassEntryId && item.compassEntryId === itemData.compassEntryId,
        );
        if (existing) {
          get().updateLineItem(transactionId, existing.id, itemData);
          return existing.id;
        }
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
        return item.id;
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

      addPhoto: (transactionId, url) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, photos: [...(tx.photos || []), url], updatedAt: new Date().toISOString() }
              : tx
          ),
        }));
      },

      removePhoto: (transactionId, index) => {
        set((s) => ({
          transactions: s.transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, photos: (tx.photos || []).filter((_, i) => i !== index), updatedAt: new Date().toISOString() }
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
            tx.currency === currency &&
            (vendorId ? tx.counterpartyId === vendorId : !tx.counterpartyId && tx.counterpartyName === vendorName)
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
        accountScopeId: state.accountScopeId,
        transactions: state.transactions,
        activeTransactionId: state.activeTransactionId,
        transactionsByAccount: state.accountScopeId
          ? { ...state.transactionsByAccount, [state.accountScopeId]: state.transactions } : state.transactionsByAccount,
        activeIdsByAccount: state.accountScopeId
          ? { ...state.activeIdsByAccount, [state.accountScopeId]: state.activeTransactionId } : state.activeIdsByAccount,
      }),
      version: 1,
      migrate: (value) => {
        const legacy = value as Partial<LedgerState>;
        const scope = legacy.accountScopeId ?? activeLedgerAccount();
        return { ...legacy, accountScopeId: scope, transactions: legacy.transactions ?? [], activeTransactionId: legacy.activeTransactionId ?? null,
          transactionsByAccount: { ...legacy.transactionsByAccount, [scope ?? '__legacy_unscoped__']: legacy.transactions ?? [] },
          activeIdsByAccount: { ...legacy.activeIdsByAccount, [scope ?? '__legacy_unscoped__']: legacy.activeTransactionId ?? null } };
      },
      merge: (persisted, current) => {
        const saved = persisted as Partial<LedgerState>;
        const scope = activeLedgerAccount();
        return { ...current, ...saved, accountScopeId: scope,
          transactions: scope ? saved.transactionsByAccount?.[scope] ?? (saved.accountScopeId === scope ? saved.transactions ?? [] : []) : [],
          activeTransactionId: scope ? saved.activeIdsByAccount?.[scope] ?? null : null };
      },
    }
  )
);


/**
 * One store per page, however many times this module is evaluated.
 *
 * Vite serves a hot-updated module under a new URL (`?t=<timestamp>`), so a
 * second evaluation is a second store with its own empty state. The app keeps
 * whichever copy it loaded first; anything reaching the module by its plain
 * path afterwards gets the other one, writes into it, and watches the screen
 * not change. Binding the store to the page rather than to the module
 * evaluation makes every copy the same store.
 */
const USELEDGERSTORE_KEY = '__teajia_useLedgerStore';
type UseLedgerStoreHandle = typeof createdLedgerStore;
const useLedgerStoreScope = globalThis as unknown as Record<string, UseLedgerStoreHandle | undefined>;
export const useLedgerStore: UseLedgerStoreHandle =
  useLedgerStoreScope[USELEDGERSTORE_KEY] ?? (useLedgerStoreScope[USELEDGERSTORE_KEY] = createdLedgerStore);
