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

describe('Naming the vendor of a draft that had none', () => {
  beforeEach(() => useLedgerStore.setState({ transactions: [], activeTransactionId: null }));
  const line = (compassEntryId: string, name: string) => ({ name, quantityUnits: 1, pricePerUnit: 100, priceIsPerGram: false, currency: 'Yuan' as const, compassEntryId });

  it('names the draft when the vendor has no draft of its own', () => {
    const none = useLedgerStore.getState().createTransaction('purchase', 'No vendor yet', 'Yuan');
    useLedgerStore.getState().addLineItem(none, line('a', 'Tea A'));
    const kept = useLedgerStore.getState().adoptVendor(none, 'Wang Laoshi', 'vendor-wang');
    expect(kept).toBe(none);
    const txs = useLedgerStore.getState().transactions;
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ counterpartyName: 'Wang Laoshi', counterpartyId: 'vendor-wang' });
    expect(txs[0].items).toHaveLength(1);
  });

  it('moves the lines into the vendor\'s existing draft and leaves one draft, not two', () => {
    const wang = useLedgerStore.getState().createTransaction('purchase', 'Wang Laoshi', 'Yuan', 'vendor-wang');
    useLedgerStore.getState().addLineItem(wang, line('a', 'Tea A'));
    const none = useLedgerStore.getState().createTransaction('purchase', 'No vendor yet', 'Yuan');
    useLedgerStore.getState().addLineItem(none, line('b', 'Tea B'));
    useLedgerStore.getState().addLineItem(none, line('a', 'Tea A again'));
    const kept = useLedgerStore.getState().adoptVendor(none, 'Wang Laoshi', 'vendor-wang');
    expect(kept).toBe(wang);
    const txs = useLedgerStore.getState().transactions;
    expect(txs.map((t) => t.id)).toEqual([wang]);
    expect(txs[0].items.map((i) => i.compassEntryId).sort()).toEqual(['a', 'b']);
    expect(useLedgerStore.getState().activeTransactionId).toBe(wang);
  });

  it('matches the vendor by name when only the name is known, and ignores confirmed orders', () => {
    const done = useLedgerStore.getState().createTransaction('purchase', 'Chen Family', 'Yuan');
    useLedgerStore.getState().confirmTransaction(done);
    const none = useLedgerStore.getState().createTransaction('purchase', 'No vendor yet', 'Yuan');
    useLedgerStore.getState().addLineItem(none, line('c', 'Tea C'));
    expect(useLedgerStore.getState().adoptVendor(none, 'chen family')).toBe(none);
    expect(useLedgerStore.getState().transactions).toHaveLength(2);

    const draft = useLedgerStore.getState().createTransaction('purchase', 'Li Tea House', 'Yuan');
    const none2 = useLedgerStore.getState().createTransaction('purchase', 'No vendor yet', 'Yuan');
    expect(useLedgerStore.getState().adoptVendor(none2, 'LI TEA HOUSE')).toBe(draft);
    expect(useLedgerStore.getState().transactions.filter((t) => t.status === 'draft' && t.counterpartyName.toLowerCase() === 'li tea house')).toHaveLength(1);
  });
});
