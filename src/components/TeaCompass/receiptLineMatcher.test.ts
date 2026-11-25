import { describe, expect, it } from 'vitest';
import type { InventoryReceipt } from '../../admin/types';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { matchOrderReceiptLine } from './receiptLineMatcher';

const receipt = (received = 100): InventoryReceipt => ({
  id: 'receipt', state: 'partially_received', source_kind: 'purchase', lines: [
    { id: 'line-exact', product_id: 'stock-silver', product_name: 'Silver Needle', expected_quantity: 250, received_quantity: received, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' },
    { id: 'line-other', product_id: 'stock-other', product_name: 'Other tea', expected_quantity: 50, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' },
  ],
});
const item = (patch: Partial<LedgerLineItem>): LedgerLineItem => ({
  id: 'silver', name: 'Silver Needle', pricePerUnit: 1, priceIsPerGram: true, currency: 'Yuan', quantityGrams: 250, addedAt: '2026-11-01', ...patch,
});

describe('recorded order receipt-line identity', () => {
  it('matches the saved exact line without requiring productId', () => {
    expect(matchOrderReceiptLine(item({ purchaseReceiptLineId: 'line-exact' }), receipt())).toMatchObject({ id: 'line-exact', expected_quantity: 250, received_quantity: 100, cancelled_quantity: 0 });
  });
  it('does not fall across lines after an explicit line-id mismatch', () => {
    expect(matchOrderReceiptLine(item({ purchaseReceiptLineId: 'missing', productId: 'stock-silver' }), receipt())).toBeUndefined();
  });
  it('keeps the product fallback only when no exact line id was saved', () => {
    expect(matchOrderReceiptLine(item({ productId: 'stock-silver' }), receipt())).toMatchObject({ id: 'line-exact' });
  });
  it('preserves a stored received zero as known', () => {
    expect(matchOrderReceiptLine(item({ purchaseReceiptLineId: 'line-exact' }), receipt(0))).toMatchObject({ received_quantity: 0 });
  });
});
