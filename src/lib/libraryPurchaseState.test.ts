import { describe, expect, it } from 'vitest';
import { libraryPurchaseStateOf, purchaseStateLabel } from './libraryPurchaseState';
import type { LedgerTransaction, LedgerLineItem } from './ledgerStore';
import type { InventoryReceipt } from '../admin/types';
import { shopOrderOf } from '../components/CurateV2/shopOrders';
import type { PurchaseOrder } from './api';
const item: LedgerLineItem = { id: 'line', name: 'Tea', compassEntryId: 'tea', productId: 'product', quantityUnits: 2, unitWeightGrams: 357, pricePerUnit: 0, priceIsPerGram: false, currency: 'Yuan', addedAt: '' };
const tx: LedgerTransaction = { id: 'local', direction: 'purchase', status: 'confirmed', purchaseOrderId: 'po', items: [item], counterpartyName: 'Vendor', currency: 'Yuan', photos: [], createdAt: '', updatedAt: '' };
const po = shopOrderOf({ id: 'po', status: 'confirmed', items_json: JSON.stringify([{ name: 'Tea', compass_entry_id: 'tea', product_id: 'product', quantity: 2, unitWeightGrams: 357, priceIsPerGram: false, pricePerUnit: 0 }]) } as PurchaseOrder);
const receipt: InventoryReceipt = { id: 'receipt', state: 'partially_received', source_kind: 'purchase_order', source_ref: 'po', lines: [{ id: 'receipt-line', product_id: 'product', product_name: 'Tea', expected_quantity: 714, received_quantity: 200, cancelled_quantity: 14, unit: 'g', intended_purpose: 'working' }] };
const identity = { entryId: 'tea', productId: 'product', chosen: true };
describe('Library purchase facts', () => {
  it('keeps chosen distinct from a draft and from a confirmed purchase', () => {
    expect(libraryPurchaseStateOf(identity).status).toBe('chosen');
    const state = libraryPurchaseStateOf(identity, [{ ...tx, status: 'draft' }]);
    expect(state.status).toBe('draft');
    expect(state.quantities[0]).toEqual({ unit: 'g', draft: 714, ordered: 0, received: null, due: null });
  });
  it('counts a durable purchase and its local copy once and never invents a receipt', () => {
    const state = libraryPurchaseStateOf(identity, [tx], [po]);
    expect(state.status).toBe('ordered');
    expect(state.quantities[0]).toEqual({ unit: 'g', draft: 0, ordered: 714, received: null, due: null });
    expect(purchaseStateLabel(state)).toContain('714g ordered');
    expect(po.items[0].unpriced).toBeUndefined();
  });
  it('reads partial receipts and cancellation without changing ordered quantity or stock', () => {
    const state = libraryPurchaseStateOf(identity, [tx], [po], [receipt, receipt]);
    expect(state.status).toBe('partially_received');
    expect(state.receiptId).toBe('receipt');
    expect(state.quantities[0]).toEqual({ unit: 'g', draft: 0, ordered: 714, received: 200, due: 500 });
    expect(receipt.lines[0].received_quantity).toBe(200);
  });
  it('a reorder retains old receipt history and adds only a draft quantity', () => {
    const arrived = { ...receipt, state: 'received' as const, lines: [{ ...receipt.lines[0], received_quantity: 714, cancelled_quantity: 0 }] };
    const state = libraryPurchaseStateOf(identity, [tx, { ...tx, id: 'reorder', status: 'draft' }], [po], [arrived]);
    expect(state.status).toBe('draft');
    expect(state.quantities[0]).toEqual({ unit: 'g', draft: 714, ordered: 714, received: 714, due: 0 });
  });
  it('ignores unrelated products, cancelled orders and quantities never recorded', () => {
    expect(libraryPurchaseStateOf({ productId: 'other' }, [tx], [po], [receipt]).quantities).toEqual([]);
    expect(libraryPurchaseStateOf(identity, [], [{ ...po, status: 'cancelled' }]).status).toBe('chosen');
    const state = libraryPurchaseStateOf(identity, [{ ...tx, items: [{ ...item, quantityUnits: undefined }] }]);
    expect(state.status).toBe('ordered');
    expect(state.quantities).toEqual([]);
  });
});

it('sums accepted partial purchase receipts once and ignores pending and rejected proposals', () => {
  const proposal = { id: 'first', compass_entry_id: 'tea', product_id: 'product', quantity: 200, unit: 'g' as const, status: 'accepted' as const, ledger_id: 'movement', idempotency_key: 'order:po:tea', acquisition_kind: 'purchase', product_name: 'Tea', purpose: 'working' as const, created_at: '', tea_name: 'Tea', vendor_name: 'Vendor' };
  const state = libraryPurchaseStateOf(identity, [tx], [po], [], [proposal, proposal, { ...proposal, id: 'second', quantity: 100, idempotency_key: 'order:po:tea:partial-2' }, { ...proposal, id: 'pending', status: 'pending' }, { ...proposal, id: 'rejected', status: 'rejected' }]);
  expect(state.status).toBe('partially_received');
  expect(state.quantities[0]).toEqual({ unit: 'g', draft: 0, ordered: 714, received: 300, due: 414 });
  const otherOrder = libraryPurchaseStateOf(identity, [tx], [po], [], [{ ...proposal, idempotency_key: 'order:other-po:tea' }]);
  expect(otherOrder.quantities[0].received).toBeNull();
});

it('keeps an existing incoming balance visible beside a new draft', () => {
  const state = libraryPurchaseStateOf(identity, [{ ...tx, id: 'reorder', status: 'draft' }], [po], [receipt]);
  expect(purchaseStateLabel(state)).toContain('714g draft');
  expect(purchaseStateLabel(state)).toContain('500g due');
});
