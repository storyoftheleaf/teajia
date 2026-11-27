import { describe, expect, it } from 'vitest';
import { purchaseHref, serviceConnections, serviceHref, shipmentHref, shippingRatesHref, shopDefaultHref, teaHref, teaShipments } from './logisticsLinks';

const line = (product_id: string, available = 0) => ({ id: `l-${product_id}`, product_id, product_name: product_id, unit: 'g', expected_quantity: 1, received_quantity: 0, cancelled_quantity: 0, available_quantity: available, original_cost_amount: null, original_cost_currency: null, image_url: null, source_url: null });
const order = (purchase_id: string, company: string, available: number) => ({ purchase_id, receipt_id: null, vendor_name: purchase_id, logistics_company_id: company, logistics_company_name: company, inbound_courier: null, inbound_tracking_number: null, logistics_arrived_at: null, lines: [line('tea', available)] });
const shipment = (id: string, service_id: string | null, state: string, created_at: string, products: string[]) => ({ id, service_id, logistics_company_id: 'gz', logistics_company_name: 'GZ', mode: 'air', state, outbound_courier: null, tracking_number: null, eta: null, created_at, dispatched_at: null, freight: null, freight_total: null, freight_estimated: false, freight_issue: null, lines: products.map(p => ({ id: `${id}-${p}`, product_id: p })) });
const tracking = {
  orders: [order('waiting', 'gz', 5), order('all-shipped', 'gz', 0), order('elsewhere', 'other', 5)],
  shipments: [shipment('old', 'air', 'received', '2026-10-01', ['tea']), shipment('new', 'air', 'in_transit', '2026-11-20', ['tea', 'oolong']), shipment('gone', 'air', 'cancelled', '2026-11-21', ['tea']), shipment('boat', 'sea', 'draft', '2026-11-22', ['tea'])],
  services: [{ id: 'air', name: 'Airmail' }],
} as never;

describe('freight connections are links both ways', () => {
  it('opens each thing at its own address', () => {
    expect(teaHref('a b')).toBe('/admin/stock?panel=a%20b');
    expect(purchaseHref('p1')).toBe('/admin/purchase-orders?purchaseId=p1');
    expect(shipmentHref('s1')).toBe('/admin/purchase-orders?shipmentId=s1');
    expect(serviceHref('air')).toBe('/admin/purchase-orders?serviceId=air');
    expect(shopDefaultHref).toBe('/admin/purchase-orders?serviceId=shop');
    expect(shippingRatesHref).toBe('/admin/purchase-orders?rates=open');
  });
  it('a service lists its company\'s waiting orders, its own shipments newest first, and the teas it prices', () => {
    const c = serviceConnections({ id: 'air', logistics_company_id: 'gz' }, tracking, [{ id: 'tea', freightServiceId: 'air', givenName: 'Velvet' }, { id: 'oolong', freightServiceId: 'sea', productName: 'Oolong' }]);
    expect(c.orders.map(o => o.purchase_id)).toEqual(['waiting']);
    expect(c.shipments.map(s => s.id)).toEqual(['new', 'old']);
    expect(c.teas).toEqual([{ id: 'tea', name: 'Velvet' }]);
  });
  it('a tea lists the shipments it is on with their service, cancelled ones left out', () => {
    expect(teaShipments('tea', tracking).map(t => [t.shipment.id, t.service?.id ?? null])).toEqual([['boat', null], ['new', 'air'], ['old', 'air']]);
  });
});
