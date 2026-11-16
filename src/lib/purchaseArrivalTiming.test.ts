import { describe, expect, it } from 'vitest';
import { purchaseArrivalTiming } from './purchaseArrivalTiming';

const line = { orderId: 'order-a', receiptLineId: 'line-a', remaining: 750 };
const shipment = {
  state: 'in_transit' as const,
  dispatched_at: '2026-11-13 09:30:00',
  eta: '2026-11-19',
  lines: [{ purchase_id: 'order-a', receipt_line_id: 'line-a', quantity: 750, received_quantity: 0 }],
};

describe('Curate purchase arrival timing', () => {
  it('derives transit time only from dates for the matching shipment', () => {
    expect(purchaseArrivalTiming([shipment], line)).toMatch(/Shipped.*Est\..*\(~6 days\)/);
    expect(purchaseArrivalTiming([shipment], { ...line, receiptLineId: 'other' })).toBeUndefined();
    expect(purchaseArrivalTiming([shipment], { ...line, orderId: 'other' })).toBeUndefined();
  });

  it('labels part of a line and avoids implying split shipments have one ETA', () => {
    const partial = { ...shipment, lines: [{ ...shipment.lines[0], quantity: 400 }] };
    expect(purchaseArrivalTiming([partial], line)).toMatch(/^Partial shipment/);
    expect(purchaseArrivalTiming([partial, { ...partial, eta: '2026-11-21' }], line))
      .toBe('2 shipments · See Purchase Tracking');
  });

  it('falls back to a recorded receipt ETA and leaves unknown dates empty', () => {
    expect(purchaseArrivalTiming([{ ...shipment, state: 'cancelled' }], { ...line, receiptEta: '2026-11-19' })).toMatch(/^Est\./);
    expect(purchaseArrivalTiming([], { ...line, receiptEta: '2026-02-30' })).toBeUndefined();
    expect(purchaseArrivalTiming([{ ...shipment, eta: null }], line)).toMatch(/^Shipped [^.]+$/);
  });
});
