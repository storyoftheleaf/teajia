import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LogisticsOrder, LogisticsShipment } from '../../../lib/logisticsTypes';
import type { PurchaseTrackingRow } from '../../../lib/api';
import { companyManifest, shipmentManifest } from './LogisticsControls';
import { LogisticsShipmentCard } from './LogisticsShipmentCard';
import { matchesPurchaseTracking, logisticsOrderSummary, logisticsPurchaseStage } from './PurchaseTrackingView';
vi.mock('../../../lib/store', () => ({ useAppStore: (select: (s: unknown) => unknown) => select({ activeAccountId: 'shop' }) }));
const order: LogisticsOrder = { purchase_id: 'p1', receipt_id: 'r1', vendor_name: 'Mountain tea', logistics_company_id: null, logistics_company_name: 'Forwarder', inbound_courier: 'SF', inbound_tracking_number: 'SF100', logistics_arrived_at: '2026-10-28', lines: [{ id: 'r-line', product_id: 'tea', product_name: 'Black tea', unit: 'g', expected_quantity: 1000, received_quantity: 0, cancelled_quantity: 0, available_quantity: 500, original_cost_amount: 100, original_cost_currency: 'CNY', image_url: null, source_url: 'https://example.com/tea' }] };
const shipment: LogisticsShipment = { id: 's1', logistics_company_id: null, logistics_company_name: 'Forwarder', mode: 'air', state: 'draft', outbound_courier: 'DHL', tracking_number: 'DHL100', eta: null, created_at: '2026-10-28', dispatched_at: null, freight: { basis: 'fixed', rate: null, billed_quantity: null, total_amount: 20, currency: 'CNY', confirmed: true }, freight_total: 20, freight_estimated: true, freight_issue: null, lines: [{ id: 's-line', shipment_id: 's1', purchase_id: 'p1', receipt_line_id: 'r-line', product_id: 'tea', product_name: 'Black tea', unit: 'g', quantity: 500, received_quantity: 0, weight_kg: .5, weight_estimated: true, volume_m3: .004, volume_estimated: true, image_url: null, source_url: 'https://example.com/tea', original_cost_amount: 50, original_cost_currency: 'CNY', allocated_freight: 20 }] };
describe('consolidated logistics', () => {
  it('keeps packed draft contents in the company list until dispatched', () => {
    expect(companyManifest('Forwarder', [order], [shipment]).items[0]).toMatchObject({ quantity: 1000, paidCost: 100, inboundTracking: 'SF100', stage: 'At logistics' });
    expect(companyManifest('Forwarder', [order], [{ ...shipment, state: 'in_transit' }]).items[0]).toMatchObject({ quantity: 500, paidCost: 50 });
  });
  it('uses the shipment quantity and cost snapshot in its manifest', () => {
    expect(shipmentManifest(shipment, [order]).items[0]).toMatchObject({ quantity: 500, paidCost: 50, freight: 20, freightEstimated: true, inboundTracking: 'SF100' });
  });
  it('keeps split purchases discoverable at logistics and on the way to studio', () => {
    const row = { purchase: { id: 'p1', status: 'ordered' }, receipt: { state: 'in_transit' }, attention: [] } as unknown as PurchaseTrackingRow;
    const data = { services: [], orders: [order], shipments: [{ ...shipment, state: 'in_transit' as const }] };
    expect(matchesPurchaseTracking(row, 'at_logistics', order, data)).toBe(true);
    expect(matchesPurchaseTracking(row, 'to_studio', order, data)).toBe(true);
    expect(matchesPurchaseTracking(row, 'received', order, data)).toBe(false);
  });
  it('does not claim a logistics destination for a legacy unassigned receipt', () => {
    const row = { purchase: null, receipt: { state: 'in_transit' }, attention: [] } as unknown as PurchaseTrackingRow;
    expect(logisticsPurchaseStage(row)).toBe('coming');
    expect(matchesPurchaseTracking(row, 'to_logistics')).toBe(false);
  });
  it('describes split quantities by their current location without borrowing the receipt mode', () => {
    const summary = logisticsOrderSummary(order, { services: [], orders: [order], shipments: [{ ...shipment, state: 'in_transit' }] });
    expect(summary).toEqual({ label: 'Part sent', quantities: 'At logistics 500 g · To studio 500 g', tracking: 'Forwarder · SF · Inbound SF100' });
  });
  it('keeps packing and final freight editable after receipt, while cancelled manifests stay read-only', () => {
    const render = (state: LogisticsShipment['state']) => renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, state }} orders={[order]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}}/>);
    expect(render('received')).toContain('Packing and references for Black tea');
    expect(render('received')).toContain('Shipment changes');
    expect(render('cancelled')).not.toContain('Packing and references for Black tea');
    expect(render('cancelled')).not.toContain('Shipment changes');
  });
  it('shows separate inbound and outbound context, confirmed bill and estimated allocation', () => {
    const html = renderToStaticMarkup(<LogisticsShipmentCard shipment={shipment} orders={[order]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}}/>);
    expect(html).toContain('DHL100');
    expect(html).toContain('Confirmed bill');
    expect(html).toContain('estimated split');
    expect(html).toContain('0.004');
    expect(html).toContain('At logistics');
    expect(html).not.toContain('Confirm verified quantities');
    expect(html).toContain('<details class="logistics-edit">');
  });
});
