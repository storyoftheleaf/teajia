import React from 'react';
import { readFileSync } from 'node:fs';
// Render task bodies here to inspect their controls independently of portal visibility.
vi.mock('./TrackingTask', () => ({ TrackingTask: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LogisticsOrder } from '../../../lib/logisticsTypes';
import { LogisticsArrivalGroups, logisticsArrivalGroups, markSelectedLogisticsArrivals, pendingLogisticsArrivals } from './LogisticsArrivalGroups';
import { LogisticsCreateShipment, selectReadyQuantities } from './LogisticsControls';
const order: LogisticsOrder = { purchase_id: 'p1', receipt_id: 'r1', vendor_name: 'Mountain tea', logistics_company_id: 'company', logistics_company_name: 'Forwarder', inbound_courier: 'SF', inbound_tracking_number: 'SF100', logistics_arrived_at: null, lines: [{ id: 'tea', product_id: 'tea', product_name: 'Black tea', unit: 'g', expected_quantity: 1000, received_quantity: 0, cancelled_quantity: 0, available_quantity: 1000, original_cost_amount: 100, original_cost_currency: 'CNY', image_url: null, source_url: null }, { id: 'cups', product_id: 'cups', product_name: 'Cups', unit: 'unit', expected_quantity: 4, received_quantity: 0, cancelled_quantity: 0, available_quantity: 4, original_cost_amount: 80, original_cost_currency: 'CNY', image_url: null, source_url: null }] };
describe('direct grouped logistics actions', () => {
  it('uses focused tasks rather than accordions for logistics actions and invoice evidence', () => {
    for (const file of ['LogisticsControls.tsx','LogisticsArrivalGroups.tsx','LogisticsServices.tsx','PurchaseInvoiceEvidence.tsx']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/<(details|summary)\b/);
    }
  });
  it('offers only managed unarrived purchases with outstanding goods, grouping distinct contacts separately', () => {
    const arrived = { ...order, purchase_id: 'arrived', logistics_arrived_at: '2026-10-28' };
    const unassigned = { ...order, purchase_id: 'unassigned', logistics_company_name: null, logistics_company_id: null };
    const empty = { ...order, purchase_id: 'empty', lines: order.lines.map(line => ({ ...line, available_quantity: 0 })) };
    const otherCompany = { ...order, purchase_id: 'p2', logistics_company_id: 'other' };
    expect(pendingLogisticsArrivals([order, arrived, unassigned, empty, otherCompany]).map(item => item.purchase_id)).toEqual(['p1', 'p2']);
    expect(logisticsArrivalGroups([order, otherCompany])).toHaveLength(2);
  });
  it('renders direct checkboxes with inbound tracking and combined tea/piece quantities', () => {
    const html = renderToStaticMarkup(<LogisticsArrivalGroups orders={[order]} busy={false} mutate={async action => { await action(); }}/>);
    expect(html).toContain('Check arrivals at logistics');
    expect(html).toContain('SF100');
    expect(html).toContain('1,000 g + 4 pc');
    expect(html).toContain('Select all');
    expect(html).toContain('Mark selected at logistics');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('Review');
  });
  it('reports partial successes and retries only the unconfirmed idempotent arrivals', async () => {
    const second = { ...order, purchase_id: 'p2' };
    const mark = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({});
    const result = await markSelectedLogisticsArrivals([order, second], mark);
    expect(result.succeeded).toEqual(['p1']);
    expect(result.failed).toEqual([{ id: 'p2', message: 'Connection lost' }]);
    const retry = await markSelectedLogisticsArrivals([order, second].filter(item => result.failed.some(failure => failure.id === item.purchase_id)), mark);
    expect(retry.succeeded).toEqual(['p2']);
    expect(mark.mock.calls).toEqual([['p1'], ['p2'], ['p2']]);
  });
  it('selects available quantities while preserving partial entries and unrelated selections', () => {
    const current = { tea: '250', unrelated: '1' };
    expect(selectReadyQuantities(current, order.lines, true)).toEqual({ tea: '250', cups: '4', unrelated: '1' });
    expect(current).toEqual({ tea: '250', unrelated: '1' });
    expect(selectReadyQuantities({ tea: '250', cups: '4', unrelated: '1' }, order.lines, false)).toEqual({ unrelated: '1' });
  });
  it('never combines identically named contacts into one ready group', () => {
    const html = renderToStaticMarkup(<LogisticsCreateShipment data={{ orders: [{ ...order, logistics_arrived_at: '2026-10-28' }, { ...order, purchase_id: 'other-purchase', logistics_company_id: 'other-contact', vendor_name: 'Other supplier', logistics_arrived_at: '2026-10-28' }], shipments: [], services: [] }} busy={false} mutate={async action => { await action(); }}/>);
    expect(html).toContain('contact:company');
    expect(html).toContain('contact:other-contact');
    expect(html).toContain('Mountain tea');
    expect(html).not.toContain('Other supplier');
  });
  it('marks a grouped shipment ready without implying dispatch or stock receipt', () => {
    const html = renderToStaticMarkup(<LogisticsCreateShipment data={{ orders: [{ ...order, logistics_arrived_at: '2026-10-28' }], shipments: [], services: [] }} busy={false} mutate={async action => { await action(); }}/>);
    expect(html).toContain('Ready to send');
    expect(html).toContain('Select all');
    expect(html).toContain('Ready purchase from Mountain tea, SF100');
    expect(html).toContain('Mark selected ready');
    expect(html).toContain('Dispatch and verified studio arrival are recorded separately.');
    expect(html).toContain('type="number"');
  });
});
