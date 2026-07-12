import { beforeEach, describe, expect, it } from 'vitest';
import { useLedgerStore } from './ledgerStore';

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
