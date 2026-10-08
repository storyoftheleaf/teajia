import { describe, expect, it } from 'vitest';
import type { PurchaseOrder } from '../../lib/api';
import type { LedgerTransaction } from '../../lib/ledgerStore';
import { isVendorOrder, mergeOrders, shopOrderIsSpend, shopOrderOf, shopOrderTotals, vendorOrderRows } from './shopOrders';

/** A row as the shop's table holds it (worker/schema.sql purchase_orders). */
const row = (over: Partial<PurchaseOrder> & { id: string }): PurchaseOrder => ({
  account_id: 'acct-bali', vendor_name: 'Wang Laoshi', vendor_id: 'vendor-wang', vendor_contact: null,
  items_json: '[]', total_usd: 0, display_currency: 'USD', status: 'pending', message_text: null, notes: null,
  created_at: '2026-10-08T05:00:00.000Z', updated_at: '2026-10-08T05:00:00.000Z', ...over,
} as PurchaseOrder);

const curateLines = JSON.stringify([
  { name: 'Mengku Laobanzhang', type: 'Sheng', form: 'Cake', year: 2019, quantity: 2, pricePerUnit: 1200, priceIsPerGram: false, currency: 'Yuan', compass_entry_id: 'e1', quantity_grams: 714, line_total: 2400 },
  { name: 'Jingmai Mao Cha', type: 'Sheng', quantity: 200, pricePerUnit: 4.5, priceIsPerGram: true, currency: 'Yuan' },
]);

const tx = (over: Partial<LedgerTransaction> & { id: string }): LedgerTransaction => ({
  direction: 'purchase', counterpartyName: 'Wang Laoshi', counterpartyId: 'vendor-wang', items: [], photos: [], status: 'confirmed',
  currency: 'Yuan', createdAt: '2026-10-08T05:00:00.000Z', updatedAt: '2026-10-08T05:00:00.000Z', ...over,
});

describe('reading an order the shop holds', () => {
  it('reads Curate\'s lines: pieces and grams, each priced in its own money', () => {
    const order = shopOrderOf(row({ id: 'po-1', items_json: curateLines, total_usd: 549.3, display_currency: 'Yuan', status: 'confirmed' }));
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ name: 'Mengku Laobanzhang', quantityUnits: 2, pricePerUnit: 1200, priceIsPerGram: false, currency: 'Yuan', compassEntryId: 'e1' });
    expect(order.items[1]).toMatchObject({ quantityGrams: 200, pricePerUnit: 4.5, priceIsPerGram: true });
    const totals = shopOrderTotals(order);
    expect(totals.own).toEqual([{ currency: 'Yuan', amount: 2400 + 900 }]);
    expect(totals.usd).toBe(549.3);
  });

  it('a total the shop stored as 0 is unknown, never a spend of nothing', () => {
    const order = shopOrderOf(row({ id: 'po-2', items_json: curateLines, total_usd: 0, display_currency: 'Yuan' }));
    expect(order.totalUsd).toBeNull();
    expect(shopOrderTotals(order).usd).toBeNull();
  });

  it('a total that is NULL or absent (the column is becoming nullable) is unknown too: a dash, never $0, never read as zero', () => {
    for (const total of [null, undefined]) {
      const po = { ...row({ id: 'po-null', items_json: '[]', display_currency: 'Yuan' }), total_usd: total } as unknown as PurchaseOrder;
      if (total === undefined) delete (po as Partial<PurchaseOrder>).total_usd;
      const order = shopOrderOf(po);
      expect(order.totalUsd).toBeNull();
      expect(shopOrderTotals(order).usd).toBeNull();
      expect(order.currency).toBe('Yuan');
    }
  });

  it('a line nobody priced makes the own-money total unknown (a total with blanks reads cheaper than the order is)', () => {
    const items = JSON.stringify([{ name: 'A', quantity: 1, pricePerUnit: 100, priceIsPerGram: false, currency: 'Yuan' }, { name: 'B', quantity: 1, pricePerUnit: null, priceIsPerGram: false, currency: 'Yuan' }]);
    const order = shopOrderOf(row({ id: 'po-3', items_json: items, total_usd: 0, display_currency: 'Yuan' }));
    expect(order.items[1].unpriced).toBe(true);
    expect(shopOrderTotals(order)).toEqual({ own: null, usd: null });
  });

  it('reads the admin order builder\'s lines (product_name, quantity_grams, no price) without inventing a price', () => {
    const items = JSON.stringify([{ product_id: 'p1', product_name: 'Alishan Oolong', quantity_grams: 500 }]);
    const order = shopOrderOf(row({ id: 'po-4', items_json: items, display_currency: 'USD', status: 'pending' }));
    expect(order.items[0]).toMatchObject({ name: 'Alishan Oolong', quantityGrams: 500, unpriced: true, productId: 'p1' });
    expect(shopOrderTotals(order).own).toBeNull();
  });

  it('survives a record whose lines cannot be read', () => {
    const order = shopOrderOf(row({ id: 'po-5', items_json: '{not json' }));
    expect(order.items).toEqual([]);
    expect(order.unreadableLines).toBe(true);
    expect(shopOrderTotals(order).own).toBeNull();
  });

  it('a pending or cancelled order is not money spent', () => {
    expect(shopOrderIsSpend(shopOrderOf(row({ id: 'a', status: 'pending' })))).toBe(false);
    expect(shopOrderIsSpend(shopOrderOf(row({ id: 'b', status: 'cancelled' })))).toBe(false);
    expect(shopOrderIsSpend(shopOrderOf(row({ id: 'c', status: 'confirmed' })))).toBe(true);
  });
});

describe('this device\'s orders and the shop\'s, together', () => {
  it('a fresh device (nothing local) shows the shop\'s order', () => {
    const rows = mergeOrders([], [shopOrderOf(row({ id: 'po-1', items_json: curateLines }))]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('shop');
  });

  it('a local order and the shop\'s record of it are one row, and it is the local one', () => {
    const rows = mergeOrders([tx({ id: 'local-1', purchaseOrderId: 'po-1' })], [shopOrderOf(row({ id: 'po-1' })), shopOrderOf(row({ id: 'po-other' }))]);
    expect(rows.map((r) => (r.kind === 'local' ? r.tx.id : r.order.id)).sort()).toEqual(['local-1', 'po-other']);
  });

  it('newest first, whichever side an order came from', () => {
    const rows = mergeOrders(
      [tx({ id: 'local-mid', updatedAt: '2026-10-05T00:00:00.000Z' }), tx({ id: 'local-new', updatedAt: '2026-10-09T00:00:00.000Z' })],
      [shopOrderOf(row({ id: 'shop-old', created_at: '2026-10-01T00:00:00.000Z' })), shopOrderOf(row({ id: 'shop-newer', created_at: '2026-10-07T00:00:00.000Z' }))],
    );
    expect(rows.map((r) => (r.kind === 'local' ? r.tx.id : r.order.id))).toEqual(['local-new', 'shop-newer', 'local-mid', 'shop-old']);
  });

  it('a vendor\'s orders: by id or by name in any case, the shop\'s and this device\'s, one row per order', () => {
    const vendor = { id: 'vendor-wang', name: 'Wang Laoshi' };
    const rows = vendorOrderRows(
      [tx({ id: 'l1', purchaseOrderId: 'po-1' }), tx({ id: 'l2', counterpartyId: undefined, counterpartyName: 'wang laoshi' }), tx({ id: 'l3', counterpartyId: 'vendor-li', counterpartyName: 'Li' }), tx({ id: 'l4', direction: 'sale' })],
      [shopOrderOf(row({ id: 'po-1' })), shopOrderOf(row({ id: 'po-2', vendor_id: null, vendor_name: 'WANG LAOSHI' })), shopOrderOf(row({ id: 'po-3', vendor_id: 'vendor-li', vendor_name: 'Li' }))],
      vendor,
    );
    expect(rows.map((r) => (r.kind === 'local' ? r.tx.id : r.order.id)).sort()).toEqual(['l1', 'l2', 'po-2']);
    expect(isVendorOrder({ counterpartyId: 'x', counterpartyName: 'Someone' }, vendor)).toBe(false);
  });
});
