import { describe, expect, it } from 'vitest';
import { orderDisplayItems, refundProgress } from './orderTrackingDomain';

describe('the customer sees the order they are being asked to pay', () => {
  const requested = [{ id: 'tea', name: 'Tea', category: 'tea', quantityGrams: 50, totalPrice: 20 }];
  const agreed = [{ id: 'line', product_id: 'tea', name: 'Tea', quantity: 25, quantity_unit: 'g' as const, unit_price_usd: 0.5, line_total_usd: 12.5 }];
  it('uses revised invoice lines after acceptance while retaining original request before acceptance', () => {
    expect(orderDisplayItems({ items_json: JSON.stringify(requested), invoice_items: agreed, order: { status: 'Pending' } }))
      .toMatchObject([{ id: 'tea', quantityGrams: 25, totalPrice: 12.5, category: 'tea' }]);
    expect(orderDisplayItems({ items_json: JSON.stringify(requested), invoice_items: agreed, order: { status: 'Draft' } })).toEqual(requested);
  });
  it('keeps pieces distinct from grams and honors a genuinely empty revised invoice', () => {
    expect(orderDisplayItems({ invoice_items: [{ ...agreed[0], quantity_unit: 'unit' }], order: { status: 'Pending' } }))
      .toMatchObject([{ category: 'ware', quantityGrams: 25 }]);
    expect(orderDisplayItems({ items_json: JSON.stringify(requested), invoice_items: [], order: { status: 'Pending' } })).toEqual([]);
  });
  it('distinguishes an unpaid cancellation from a refund still due or completed', () => {
    expect(refundProgress({ status: 'Void' })).toBe('Cancelled');
    expect(refundProgress({ status: 'Void', refund_required: true, refunded_usd: 5 })).toBe('Cancelled · refund in progress');
    expect(refundProgress({ status: 'Void', refunded_usd: 20 })).toBe('Cancelled · refunded');
  });
});
