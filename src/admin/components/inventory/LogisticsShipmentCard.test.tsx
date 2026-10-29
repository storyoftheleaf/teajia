import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LogisticsShipment } from '../../../lib/logisticsTypes';
import { LogisticsShipmentCard, shipmentArrivalDate } from './LogisticsShipmentCard';
const shipment: LogisticsShipment = {
  id: 'shipment', logistics_company_id: 'company', logistics_company_name: 'Guangzhou', mode: 'sea', state: 'in_transit',
  outbound_courier: 'Ocean freight', tracking_number: 'BOAT-1028', eta: '2026-11-18', created_at: '2026-10-28', dispatched_at: '2026-10-28',
  freight: { basis: 'fixed', rate: null, billed_quantity: null, total_amount: 144, currency: 'CNY', confirmed: true }, freight_total: 144, freight_estimated: false, freight_issue: null,
  lines: [{ id: 'line', shipment_id: 'shipment', purchase_id: 'purchase', receipt_line_id: 'receipt-line', product_id: 'tea', product_name: 'Golden Tips', unit: 'g', quantity: 500, received_quantity: 0, weight_kg: 0.5, volume_m3: null, weight_estimated: false, volume_estimated: true, original_cost_amount: 100, original_cost_currency: 'CNY', allocated_freight: 144, image_url: null, source_url: null }],
};
const render = (state: LogisticsShipment['state'] = 'in_transit') => renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, state }} orders={[]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}} grouped/>);
describe('shipment tracking before recording an arrival', () => {
  it('keeps tracking and receiving visible while secondary details start closed', () => {
    const html = render();
    expect(html).toContain('data-state="in_transit">On the way');
    expect(html).toContain('Tracking</span> <strong>BOAT-1028');
    expect(html).toContain('Freight <strong>144 CNY');
    const overview = html.split('<details class="logistics-shipment-details">')[0];
    expect(overview).toContain('1 item from 1 purchase');
    expect(overview).not.toContain('Freight');
    expect(overview).not.toContain('Golden Tips');
    expect(html).toContain('<details class="logistics-shipment-details"><summary class="tap-target">Details</summary>');
    expect(html).toContain('Record studio arrival');
    expect(html).not.toContain('Confirm received');
    expect(html).not.toContain('Receive all at studio');
    expect(html).toContain('<details class="logistics-export"><summary class="tap-target">Export list');
    expect(html).toContain('CSV');
    expect(html).toContain('Photo list');
  });
  it('distinguishes a ready shipment from a receipt already recorded in stock', () => {
    expect(render('draft')).toContain('data-state="draft">Ready to send');
    const received = render('received');
    expect(received).toContain('data-state="received">In stock');
    expect(received).not.toContain('Record studio arrival');
  });
  it('does not fill the overview with missing date or freight warnings', () => {
    const html = renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, eta: null, tracking_number: null, freight: null, freight_total: null, freight_issue: 'Record the bill total.' }} orders={[]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}} grouped/>);
    const overview = html.split('<details class="logistics-shipment-details">')[0];
    expect(overview).not.toContain('not set');
    expect(overview).not.toContain('not recorded');
    expect(overview).not.toContain('Record the bill');
    expect(html).toContain('Record the bill total.');
  });
  it('formats a calendar arrival date without UTC day shifting and rejects invalid dates', () => {
    expect(shipmentArrivalDate('2026-11-18')).toBe(new Date(2026, 10, 18, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    expect(shipmentArrivalDate(null)).toBe('');
    expect(shipmentArrivalDate('invalid')).toBe('');
  });
});
