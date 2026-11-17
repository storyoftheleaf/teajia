import { describe, expect, it } from 'vitest';
import { purchaseArrivalAction, purchaseArrivalTiming } from './purchaseArrivalTiming';

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

describe('purchase receipt routing', () => {
  const routed = { ...shipment, id: 'boat parcel', lines: [{ ...shipment.lines[0], id: 'studio-count' }] };
  type Tracking = Parameters<typeof purchaseArrivalAction>[0];
  const tracking = (patch: Partial<Tracking['orders'][number]> = {}, shipments: Tracking['shipments'] = [routed]): Tracking => ({
    orders: [{ purchase_id: 'order-a', managed: true, logistics_company_name: null, ...patch }], shipments,
  });

  it('opens the exact count for the matching in-transit or partially received shipment', () => {
    for (const state of ['in_transit', 'partially_received'] as const) {
      expect(purchaseArrivalAction(tracking({}, [{ ...routed, state }]), 'order-a', 'line-a')).toEqual({
        label: 'Open studio receipt', href: '/admin/purchase-orders?shipmentId=boat%20parcel&receiptLineId=studio-count',
      });
    }
  });

  it('points to an unshipped parcel or managed order without offering a count', () => {
    expect(purchaseArrivalAction(tracking({}, [{ ...routed, state: 'draft' }]), 'order-a', 'line-a')?.label).toBe('View shipment');
    expect(purchaseArrivalAction(tracking(), 'order-a', 'different')?.label).toBe('Track supplier order');
    expect(purchaseArrivalAction(tracking({}, [{ ...routed, state: 'cancelled' }]), 'order-a', 'line-a')?.label).toBe('Track supplier order');
    expect(purchaseArrivalAction(tracking({ managed: false }, []), 'order-a', 'line-a')).toBeUndefined();
  });

  it('lists split parcels for the same purchase', () => {
    expect(purchaseArrivalAction(tracking({}, [routed, { ...routed, id: 'second' }]), 'order-a', 'line-a')).toEqual({
      label: 'View shipments', href: '/admin/purchase-orders?view=to_studio&shipmentsForPurchaseId=order-a',
    });
    expect(purchaseArrivalAction(tracking({}, [routed, { ...routed, id: 'second', state: 'draft' }]), 'order-a', 'line-a')?.href).toContain('view=all');
    expect(purchaseArrivalAction(tracking(), 'order-a')?.label).toBe('View shipment');
  });
});
