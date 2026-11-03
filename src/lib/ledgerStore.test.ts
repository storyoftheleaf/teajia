import { beforeEach, describe, expect, it } from 'vitest';
import { useLedgerStore } from './ledgerStore';

describe('account-scoped acquisition drafts', () => {
  beforeEach(() => useLedgerStore.setState({ transactions: [], transactionsByAccount: {}, activeTransactionId: null, activeIdsByAccount: {}, accountScopeId: null } as never));
  it('keeps another shop drafts out of the active account', () => {
    const store = useLedgerStore.getState();
    store.switchAccount('a');
    const a = store.getOrCreatePurchaseTransaction('Lin', 'Yuan', 'vendor-a');
    store.switchAccount('b');
    expect(useLedgerStore.getState().transactions).toEqual([]);
    const b = store.getOrCreatePurchaseTransaction('Lin', 'Yuan', 'vendor-b');
    store.switchAccount('a');
    expect(useLedgerStore.getState().transactions.map(tx => tx.id)).toEqual([a]);
    expect(useLedgerStore.getState().activeTransactionId).toBe(a);
    store.switchAccount(null);
    expect(useLedgerStore.getState().transactions).toEqual([]);
    store.switchAccount('b');
    expect(useLedgerStore.getState().transactions.map(tx => tx.id)).toEqual([b]);
  });
  it('groups only the same vendor identity and currency', () => {
    const store = useLedgerStore.getState(); store.switchAccount('a');
    const yuan = store.getOrCreatePurchaseTransaction('Lin', 'Yuan', 'v1');
    expect(store.getOrCreatePurchaseTransaction('Lin renamed', 'Yuan', 'v1')).toBe(yuan);
    expect(store.getOrCreatePurchaseTransaction('Lin', 'USD', 'v1')).not.toBe(yuan);
    expect(store.getOrCreatePurchaseTransaction('Lin', 'Yuan', 'v2')).not.toBe(yuan);
  });
});

describe('Curate acquisition ledger idempotency', () => {
  beforeEach(() => useLedgerStore.setState({ transactions: [], activeTransactionId: null }));
  it('updates rather than duplicates a Curate entry after a receipt proposal retry', () => {
    const state = useLedgerStore.getState();
    const tx = state.createTransaction('purchase', 'Vendor', 'USD');
    const line = { name: 'Tea', quantityGrams: 10, pricePerUnit: 1, priceIsPerGram: true, currency: 'USD' as const, compassEntryId: 'entry-a' };
    const first = useLedgerStore.getState().addLineItem(tx, line);
    const retry = useLedgerStore.getState().addLineItem(tx, { ...line, quantityGrams: 20 });
    expect(retry).toBe(first);
    expect(useLedgerStore.getState().transactions[0].items).toHaveLength(1);
    expect(useLedgerStore.getState().transactions[0].items[0].quantityGrams).toBe(20);
  });
});
