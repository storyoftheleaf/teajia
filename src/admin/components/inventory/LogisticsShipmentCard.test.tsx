import React from 'react';
import { renderToStaticMarkup as renderPlain } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
// Shipment cards link to teas and services, so they render inside a router.
const renderToStaticMarkup = (node: React.ReactElement) => renderPlain(<MemoryRouter>{node}</MemoryRouter>);
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { LogisticsService, LogisticsShipment } from '../../../lib/logisticsTypes';
import { LogisticsShipmentCard, shipmentArrivalDate } from './LogisticsShipmentCard';
const { costTask } = vi.hoisted(() => ({ costTask: { open: false } }));
vi.mock('./TrackingTask', () => ({
  TrackingTask: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open || (costTask.open && title.startsWith('Boat shipment')) ? <div>{children}</div> : null,
}));
const shipment: LogisticsShipment = {
  id: 'shipment', logistics_company_id: 'company', logistics_company_name: 'Guangzhou', mode: 'sea', state: 'in_transit',
  outbound_courier: 'Ocean freight', tracking_number: 'BOAT-1028', eta: '2026-11-18', created_at: '2026-10-28', dispatched_at: '2026-10-28',
  freight: { basis: 'fixed', rate: null, billed_quantity: null, total_amount: 144, currency: 'CNY', confirmed: true }, freight_total: 144, freight_estimated: false, freight_issue: null,
  lines: [{ id: 'line', shipment_id: 'shipment', purchase_id: 'purchase', receipt_line_id: 'receipt-line', product_id: 'tea', product_name: 'Golden Tips', unit: 'g', quantity: 500, received_quantity: 0, weight_kg: 0.5, volume_m3: null, weight_estimated: false, volume_estimated: true, original_cost_amount: 100, original_cost_currency: 'CNY', allocated_freight: 144, image_url: null, source_url: null }],
};
const render = (state: LogisticsShipment['state'] = 'in_transit') => renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, state }} orders={[]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}} grouped/>);
describe('shipment tracking before recording an arrival', () => {
  it('shows actual contents and direct actions without any accordion', () => {
    const html = render();
    expect(html).toContain('data-state="in_transit">On the way');
    expect(html).toContain('BOAT-1028');
    expect(html).toContain('Guangzhou → Art studio');
    expect(html).toContain('Golden Tips');
    expect(html).toContain('500 g');
    expect(html).toContain('Open purchase for Golden Tips');
    expect(html).toContain('Record studio arrival');
    expect(html).toContain('Edit costs &amp; shipment');
    expect(html).not.toContain('Message');
    expect(html).toContain('Shipment quantities');
    expect(html).toContain('Goods paid');
    expect(html).toContain('Shipping bill');
    expect(html).toContain('144 Yuan');
    expect(html).toContain('Packed volume');
    expect(html).not.toContain('Confirm received');
    expect(html).not.toMatch(/<(details|summary)\b/);
    const source = readFileSync(new URL('./LogisticsShipmentCard.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/<(details|summary)\b/);
    expect(source).toContain('<TrackingTask open={expanded}');
    expect(source).toContain('<TrackingTask open={editor !== null}');
    expect(source).toContain('shipmentManifest(shipment, orders)');
  });
  it('distinguishes a ready shipment from a receipt already recorded in stock', () => {
    const draft = render('draft');
    expect(draft).toContain('data-state="draft">Ready to send');
    expect(draft).toContain('Delivery address missing');
    expect(draft).toContain('Mark sent to studio');
    expect(draft).not.toContain('Dispatch tracking number');
    const received = render('received');
    expect(received).toContain('data-state="received">In stock');
    expect(received).not.toContain('Record studio arrival');
  });
  it('shows missing arrival and freight facts instead of implying a complete quote', () => {
    const html = renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, eta: null, tracking_number: null, freight: null, freight_total: null, freight_issue: 'Record the bill total.' }} orders={[]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}} grouped/>);
    expect(html).toContain('Date not recorded');
    expect(html).toContain('Outbound tracking not recorded');
    expect(html).toContain('Not enough information');
  });
  it.each([
    [{ basis: 'fixed', rate: 44, currency: 'CNY' }, '44 CNY</strong><small'],
    [{ basis: 'kg', rate: 0, currency: 'USD' }, '0 USD</strong><small'],
    [{ basis: 'm3', rate: 49, currency: 'CNY' }, '49 CNY</strong><small'],
    [{ basis: 'm3', rate: undefined, currency: 'CNY' }, 'Rate not recorded'],
  ])('shows the original quote beside the bill for %j', (snapshot, quote) => {
    costTask.open = true;
    try {
      const serviceQuote = { id: 'service', name: 'Sea consolidated', logistics_company_id: 'company', logistics_company_name: 'Guangzhou', mode: 'sea', active: true, ...snapshot } as LogisticsService;
      const html = renderToStaticMarkup(<LogisticsShipmentCard shipment={{ ...shipment, service_quote: serviceQuote }} orders={[]} busy={false} mutate={async action => { await action(); }} accountId="shop" openPurchase={() => {}} grouped/>);
      expect(html).toContain('Original quote');
      expect(html).toContain(quote);
      const basisText = snapshot.basis === 'fixed' ? 'fixed' : snapshot.basis === 'kg' ? 'per kg' : 'per m³';
      expect(html).toContain(` · ${basisText}</small>`);
      expect(html).toContain('Freight <strong>144 CNY</strong>');
      expect(html).toContain('bill confirmed');
      expect(html).not.toContain('name="rate"');
      expect(html).not.toContain('name="billed"');
      expect(html).not.toContain('name="allocation"');
    } finally {
      costTask.open = false;
    }
  });
  it('formats a calendar arrival date without UTC day shifting and rejects invalid dates', () => {
    expect(shipmentArrivalDate('2026-11-18')).toBe(new Date(2026, 10, 18, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    expect(shipmentArrivalDate(null)).toBe('');
    expect(shipmentArrivalDate('invalid')).toBe('');
  });
});
