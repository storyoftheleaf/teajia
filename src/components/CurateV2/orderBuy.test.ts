import { beforeEach, describe, expect, it } from 'vitest';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { addTeaToDraftOrder, NO_VENDOR_YET } from './orderBuy';
import type { TeaCompassEntry } from './types';

const put = (over: Partial<TeaCompassEntry> & { id: string }) => {
  const entry = {
    name: 'Tea', category: 'tea', status: 'noted', decision: null, priceCurrency: 'Yuan', priceAmount: 450, form: 'Cake', ...over,
  } as TeaCompassEntry;
  useTeaCompassStore.setState((s) => ({ entries: [...s.entries, entry] }));
  return entry.id;
};

describe('Buy puts a tea on its vendor\'s draft order', () => {
  beforeEach(() => {
    useLedgerStore.setState({ transactions: [], activeTransactionId: null });
    useTeaCompassStore.setState({ entries: [], pendingEntries: [] });
  });

  it('one draft per vendor, the tea Selected and being ordered, one cake', () => {
    const a = put({ id: 'a', name: 'A', vendorName: 'Wang', vendorId: 'v1' });
    const b = put({ id: 'b', name: 'B', vendorName: 'Wang', vendorId: 'v1', priceAmount: 300 });
    const c = put({ id: 'c', name: 'C', vendorName: 'Li', vendorId: 'v2' });
    const txA = addTeaToDraftOrder(a);
    const txB = addTeaToDraftOrder(b);
    const txC = addTeaToDraftOrder(c);
    expect(txB).toBe(txA);
    expect(txC).not.toBe(txA);
    const orders = useLedgerStore.getState().transactions;
    expect(orders).toHaveLength(2);
    const wang = orders.find((t) => t.id === txA)!;
    expect(wang.items.map((i) => i.name)).toEqual(['A', 'B']);
    expect(wang.items[0]).toMatchObject({ quantityUnits: 1, priceIsPerGram: false, pricePerUnit: 450 });
    const after = useTeaCompassStore.getState().entries.find((e) => e.id === 'a')!;
    expect(after.decision).toBe('selected');
    expect(after.status).toBe('buying');
  });

  it('a tea already on a draft is not added twice', () => {
    const a = put({ id: 'a', vendorName: 'Wang' });
    const tx = addTeaToDraftOrder(a);
    expect(addTeaToDraftOrder(a)).toBe(tx);
    expect(useLedgerStore.getState().transactions[0].items).toHaveLength(1);
  });

  it('a tea with no vendor goes on "No vendor yet"; a loose tea is ordered by the gram', () => {
    const l = put({ id: 'l', name: 'Loose', form: 'Loose', priceAmount: 120, pricePerUnitGrams: 100 });
    const id = addTeaToDraftOrder(l);
    const tx = useLedgerStore.getState().transactions.find((t) => t.id === id)!;
    expect(tx.counterpartyName).toBe(NO_VENDOR_YET);
    expect(tx.items[0]).toMatchObject({ priceIsPerGram: true, quantityGrams: 100, pricePerUnit: 1.2 });
  });

  it('does not touch a tea that has already arrived', () => {
    const a = put({ id: 'a', vendorName: 'Wang', status: 'in_stock' });
    addTeaToDraftOrder(a);
    expect(useTeaCompassStore.getState().entries[0].status).toBe('in_stock');
  });
});
