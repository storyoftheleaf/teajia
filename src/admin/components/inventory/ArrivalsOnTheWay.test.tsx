import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { PurchaseTrackingRow } from '../../../lib/api';
import { ArrivalsOnTheWay, groupArrivals, isCurateArrivalRow } from './ArrivalsOnTheWay';

const arrival = (id: string, vendor: string, extra: Record<string, unknown> = {}): PurchaseTrackingRow => ({
  id: `proposal:${id}`, purchase: null, receipt: null, invoice_draft: null, history: [], source_document: null,
  attention: [{ code: 'legacy_arrival', message: 'Ordered.' }],
  arrival_proposal: { id, vendor_name: vendor, quantity: 1400, unit: 'g', acquisition_state: 'in_transit', compass_entry_id: `entry-${id}`, tea_name: `Tea ${id}`, ...extra },
} as PurchaseTrackingRow);

describe('teas on the way from Curate (Adrian, 2026-11-27: eighteen cards looked stuck)', () => {
  it('only takes arrivals that have no purchase or receipt of their own', () => {
    expect(isCurateArrivalRow(arrival('a', 'Jingpintang'))).toBe(true);
    expect(isCurateArrivalRow({ ...arrival('b', 'Jingpintang'), purchase: { id: 'po' } as never })).toBe(false);
  });
  it('groups by supplier, one line a tea, each opening the tea in Curate', () => {
    const rows = [arrival('a', 'Lao Tongzhi Puer'), arrival('b', 'Jingpintang', { acquisition_state: 'ordered', quantity: 250 }), arrival('c', 'Jingpintang')];
    expect(groupArrivals(rows).map(([supplier, teas]) => [supplier, teas.length])).toEqual([['Jingpintang', 2], ['Lao Tongzhi Puer', 1]]);
    const html = renderToStaticMarkup(<MemoryRouter><ArrivalsOnTheWay rows={rows}/></MemoryRouter>);
    expect(html).toContain('On the way, not yet in stock');
    expect(html).toContain('href="/admin/compass?entry=entry-b"');
    expect(html).toContain('250 g · Ordered');
    expect(html).toContain('1.4 kg · On the way');
    expect(html).not.toContain('agent review');
  });
  it('shows nothing when no tea is on the way', () => {
    expect(renderToStaticMarkup(<MemoryRouter><ArrivalsOnTheWay rows={[]}/></MemoryRouter>)).toBe('');
  });
});
