import { describe, expect, it } from 'vitest';
import { serviceJourney } from './serviceJourney';

const line = (available: number) => ({ id: 'l', product_id: 'tea', available_quantity: available });
const order = (id: string, arrived: string | null, available = 5) => ({ purchase_id: id, vendor_name: id, logistics_company_id: 'gz', logistics_arrived_at: arrived, lines: [line(available)] });
const shipment = (id: string, state: string, extra: Record<string, unknown> = {}) => ({ id, service_id: 'air', state, eta: null, dispatched_at: null, created_at: id, freight: null, lines: [{ product_id: 'tea' }], ...extra });
const tracking = {
  orders: [order('Chen', null), order('Bo', '2026-11-20'), order('Done', '2026-11-01', 0)],
  shipments: [shipment('2026-11-25', 'in_transit', { eta: '2026-12-04' }), shipment('2026-10-01', 'received', { freight: { basis: 'kg', rate: 79, currency: 'Yuan', confirmed: true } }), shipment('2026-11-26', 'cancelled')],
} as never;
const service = { id: 'air', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou' };

describe('the journey track', () => {
  it('puts each order and shipment in its stage, each a link', () => {
    const j = serviceJourney(service, tracking, [{ id: 'tea', freightServiceId: 'air', givenName: 'Velvet' }]);
    expect(j.stages.map(s => [s.label, s.items.map(i => i.label)])).toEqual([
      ['Ordered', ['Chen']], ['At Guangzhou', ['Bo']], ['On the way', ['Due 4 Dec']], ['Arrived', ['Arrived']],
    ]);
    expect(j.stages[2].items[0].href).toBe('/admin/purchase-orders?shipmentId=2026-11-25');
    expect(j.stages[0].items[0].href).toBe('/admin/purchase-orders?purchaseId=Chen');
    expect(j.teas).toEqual([{ key: 'tea', label: 'Velvet', href: '/admin/stock?panel=tea' }]);
  });
  it('opens on what is furthest along and still coming, and names the last confirmed bill', () => {
    const j = serviceJourney(service, tracking, []);
    expect(j.focus).toBe('on_the_way');
    expect(j.lastBill).toBe('79 Yuan/kg');
    expect(serviceJourney(service, { orders: [], shipments: [] } as never, []).focus).toBeNull();
  });
});
