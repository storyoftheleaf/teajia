import { beforeEach, describe, expect, it } from 'vitest';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { addTeaToDraftOrder, NO_VENDOR_YET, releaseTeaFromOrder, removeTeaFromDraftOrders } from './orderBuy';
import { ledgerItemAmount, orderMoney } from './curatePricing';
import { orderLinePrice } from './curateV2Model';
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

  it('a tea priced in another money opens its own draft for the same vendor, never added into this one\'s total', () => {
    const a = put({ id: 'a', name: 'Yuan Tea', vendorName: 'Wang', vendorId: 'v1', priceCurrency: 'Yuan', priceAmount: 450 });
    const b = put({ id: 'b', name: 'Taiwan Tea', vendorName: 'Wang', vendorId: 'v1', priceCurrency: 'NT', priceAmount: 1800 });
    const c = put({ id: 'c', name: 'Another Yuan', vendorName: 'Wang', vendorId: 'v1', priceCurrency: 'Yuan', priceAmount: 300 });
    const txA = addTeaToDraftOrder(a);
    const txB = addTeaToDraftOrder(b);
    const txC = addTeaToDraftOrder(c);
    expect(txB).not.toBe(txA);
    expect(txC).toBe(txA);
    const orders = useLedgerStore.getState().transactions;
    expect(orders).toHaveLength(2);
    expect(orders.find((t) => t.id === txA)!.currency).toBe('Yuan');
    expect(orders.find((t) => t.id === txB)!.currency).toBe('NT');
    // Every line is in its order's money.
    for (const order of orders) for (const item of order.items) expect(item.currency).toBe(order.currency);
  });

  it('a tea with no price is a marked blank in the order\'s money, not a price of 0; it takes the price once it has one', () => {
    const a = put({ id: 'a', name: 'Bare', vendorName: 'Wang', vendorId: 'v1', priceAmount: undefined, priceCurrency: 'NT' });
    const tx = addTeaToDraftOrder(a)!;
    const line = () => useLedgerStore.getState().transactions.find((t) => t.id === tx)!.items[0];
    expect(line()).toMatchObject({ unpriced: true, pricePerUnit: 0 });
    // The tea's own currency is nobody's decision while it has no price: the order opens in the table's money.
    expect(useLedgerStore.getState().transactions[0].currency).toBe('Yuan');
    expect(line().currency).toBe('Yuan');
    useTeaCompassStore.setState((s) => ({ entries: s.entries.map((e) => (e.id === 'a' ? { ...e, priceAmount: 380, priceCurrency: 'Yuan' } : e)) }));
    expect(addTeaToDraftOrder(a)).toBe(tx);
    expect(line()).toMatchObject({ pricePerUnit: 380, currency: 'Yuan' });
    expect(line().unpriced).toBeUndefined();
  });

  it('a blank filled in another money moves to the right draft instead of being counted in this one', () => {
    const a = put({ id: 'a', name: 'Bare', vendorName: 'Wang', vendorId: 'v1', priceAmount: undefined });
    const tx = addTeaToDraftOrder(a)!;
    useTeaCompassStore.setState((s) => ({ entries: s.entries.map((e) => (e.id === 'a' ? { ...e, priceAmount: 1800, priceCurrency: 'NT' } : e)) }));
    const moved = addTeaToDraftOrder(a)!;
    expect(moved).not.toBe(tx);
    const orders = useLedgerStore.getState().transactions;
    expect(orders.find((t) => t.id === moved)).toMatchObject({ currency: 'NT' });
    expect(orders.find((t) => t.id === moved)!.items).toHaveLength(1);
    expect(orders.find((t) => t.id === tx)?.items ?? []).toHaveLength(0);
  });

  it('naming the vendor on "No vendor yet" merges into that vendor\'s draft only when it is in the same money', () => {
    const ledger = useLedgerStore.getState();
    const wangYuan = ledger.createTransaction('purchase', 'Wang', 'Yuan', 'v1');
    const loose = put({ id: 'n', name: 'NT Tea', priceCurrency: 'NT', priceAmount: 1800 });
    const nameless = addTeaToDraftOrder(loose)!;
    expect(useLedgerStore.getState().transactions.find((t) => t.id === nameless)!.counterpartyName).toBe(NO_VENDOR_YET);
    // Different money: the nameless draft is simply named, the Yuan draft is left alone.
    expect(useLedgerStore.getState().adoptVendor(nameless, 'Wang', 'v1')).toBe(nameless);
    expect(useLedgerStore.getState().transactions.map((t) => t.counterpartyName)).toEqual(expect.arrayContaining(['Wang', 'Wang']));
    expect(useLedgerStore.getState().transactions.find((t) => t.id === wangYuan)!.items).toHaveLength(0);
  });

  it('a tea taken off its order is deciding again, not Selected-and-nowhere (it used to fall off Today)', () => {
    const a = put({ id: 'a', vendorName: 'Wang', vendorId: 'v1' });
    const tx = addTeaToDraftOrder(a)!;
    const line = useLedgerStore.getState().transactions.find((t) => t.id === tx)!.items[0];
    useLedgerStore.getState().removeLineItem(tx, line.id);
    releaseTeaFromOrder(a);
    const entry = useTeaCompassStore.getState().entries.find((e) => e.id === 'a')!;
    expect(entry.status).toBe('noted');
    expect(entry.decision).toBeNull();
  });

  it('Pass after Buy takes the tea off the draft, and an order left empty goes with it; a confirmed order is left alone', () => {
    const a = put({ id: 'a', vendorName: 'Wang', vendorId: 'v1' });
    const b = put({ id: 'b', vendorName: 'Wang', vendorId: 'v1', priceAmount: 300 });
    const tx = addTeaToDraftOrder(a)!;
    addTeaToDraftOrder(b);
    removeTeaFromDraftOrders(a);
    expect(useLedgerStore.getState().transactions.find((t) => t.id === tx)!.items.map((i) => i.compassEntryId)).toEqual(['b']);
    removeTeaFromDraftOrders(b);
    expect(useLedgerStore.getState().transactions).toHaveLength(0);

    const c = put({ id: 'c', vendorName: 'Li', vendorId: 'v2' });
    const sent = addTeaToDraftOrder(c)!;
    useLedgerStore.getState().confirmTransaction(sent);
    removeTeaFromDraftOrders(c);
    expect(useLedgerStore.getState().transactions.find((t) => t.id === sent)!.items).toHaveLength(1);
  });

  it('a cake entered as 200 g is carried on the order at 200 g, as its own screen prices it', () => {
    const a = put({ id: 'a', vendorName: 'Wang', vendorId: 'v1', pricePerUnitGrams: 200 });
    const b = put({ id: 'b', vendorName: 'Wang', vendorId: 'v1' });
    const tx = addTeaToDraftOrder(a)!;
    addTeaToDraftOrder(b);
    const items = useLedgerStore.getState().transactions.find((t) => t.id === tx)!.items;
    expect(items[0].unitWeightGrams).toBe(200);
    expect(items[1].unitWeightGrams).toBe(357);
  });
});

describe('a tea priced per 100 g is counted per gram on its order (Curate v1 had it as per gram: 200 g of ¥450/100 g came to ¥90,000)', () => {
  beforeEach(() => {
    useLedgerStore.setState({ transactions: [], activeTransactionId: null });
    useTeaCompassStore.setState({ entries: [], pendingEntries: [] });
  });

  it('Buy on the tea screen: the line is ¥4.5 a gram, so 200 g is ¥900', () => {
    const id = addTeaToDraftOrder(put({ id: 'l1', name: 'Loose', form: 'Loose', priceAmount: 450, pricePerUnitGrams: 100, vendorName: 'Wang' }))!;
    const tx = useLedgerStore.getState().transactions.find((t) => t.id === id)!;
    useLedgerStore.getState().updateLineItem(id, tx.items[0].id, { quantityGrams: 200 });
    const line = useLedgerStore.getState().transactions.find((t) => t.id === id)!.items[0];
    expect(line).toMatchObject({ priceIsPerGram: true, pricePerUnit: 4.5 });
    expect(ledgerItemAmount(line)).toBe(900);
    expect(orderMoney(useLedgerStore.getState().transactions.find((t) => t.id === id)!).parts).toEqual([{ currency: 'Yuan', amount: 900 }]);
  });

  it('every other way onto an order reads the same rule: the full form\'s Buy panel, the quick Buy sheet and the order summary all use orderLinePrice', () => {
    const entry = { category: 'tea' as const, priceAmount: 450, pricePerUnitGrams: 100, form: undefined };
    const line = { ...orderLinePrice(entry), quantityGrams: 200 };
    expect(ledgerItemAmount(line as never)).toBe(900);
  });
});
