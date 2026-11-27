// Review run, fix packages 1 to 4 and 8 on the site (todo/review/fixes/tables.md).
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { HostTableAfter, RecapLine, startingWhoCame } from './HostTableAfter';
import { WalkthroughEditor, wayTableOffer } from './WalkthroughEditor';
import { aWeekOn } from '../../pages/HostedTablePage';
import { TastingShareStep } from '../tasting/TastingShareStep';
import type { HostedTableDetail, HostedTableGuest } from '../../lib/hostingApi';

const render = (node: ReactElement, seed?: (client: QueryClient) => void) => {
  const client = new QueryClient();
  seed?.(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
};

const guest = (id: string, name: string, attended: number | null): HostedTableGuest => ({
  id, full_name: name, status: 'confirmed', plus_one: 0, attended, created_at: null, note: null, phone: null, no_photographs: false,
});

function detail(guests: HostedTableGuest[]): HostedTableDetail {
  return {
    table: {
      id: 't', slug: 't', title: 'Saturday oolong', event_date: '2026-11-01T10:00:00Z', event_end_date: '2026-11-01T12:00:00Z',
      timezone: 'UTC', seats: 6, door: 'request', lifecycle_status: 'published', link: 'https://teajia.test/event/t',
      requires_approval: 1, public_visibility: 'unlisted', seats_taken: guests.length, area_hint: 'Ubud',
    } as HostedTableDetail['table'],
    guests, teas: [], doors: ['request'],
  };
}

describe('package 1, your table place (W2-5): the place just kept is offered as the table', () => {
  const places = [{ id: 'p1', name: 'Ubud house', area_hint: null, is_table: false }];
  it('offers it with the table’s own area when the host has no table yet', () => {
    expect(wayTableOffer('p1', places, ' Ubud ')).toEqual({ place: places[0], area: 'Ubud' });
  });
  it('offers nothing when a table is already named, the table has no area, or nothing was kept', () => {
    expect(wayTableOffer('p1', [...places, { id: 'p2', name: 'Studio', area_hint: 'Ubud', is_table: true }], 'Ubud')).toBeNull();
    expect(wayTableOffer('p1', places, '')).toBeNull();
    expect(wayTableOffer(null, places, 'Ubud')).toBeNull();
  });
});

describe('package 2, after the table (A9-13, W2-6, W2-7)', () => {
  it('puts who came on the list itself, every guest ticked until saved otherwise, with one Save', () => {
    const html = render(<HostTableAfter tableId="t" detail={detail([guest('g1', 'Lin', null), guest('g2', 'Mei', null)])} />);
    expect(html).not.toContain('Mark who came');
    expect(html.match(/type="checkbox"[^>]*checked/g)).toHaveLength(2);
    expect(html).toContain('Save who came');
    // No link before the worker has anyone as having come.
    expect(html).not.toContain('Copy their thank-you link');
  });

  it('shows a thank-you link beside each guest saved as having come, and none for one saved as absent', () => {
    const html = render(<HostTableAfter tableId="t" detail={detail([guest('g1', 'Lin', 0), guest('g2', 'Mei', 1)])} />);
    expect(html).toContain('Copy their thank-you link for Mei');
    expect(html).not.toContain('Copy their thank-you link for Lin');
    expect([...startingWhoCame([{ id: 'g1', attended: 0 }, { id: 'g2', attended: 1 }, { id: 'g3', attended: null }])]).toEqual(['g2', 'g3']);
  });

  it('links to the recap on the table’s page in Manage, naming the Tea Table only while it is open', () => {
    const html = render(<RecapLine tableId="t" />);
    expect(html).toContain('href="/admin/events/t?tab=post-session"');
    expect(html).toContain('Write the recap');
    // The Tea Table is open, so the line names it.
    expect(html).toContain('Tea Table');
    expect(render(<HostTableAfter tableId="t" detail={detail([])} />)).toContain('/admin/events/t?tab=post-session');
  });
});

describe('package 3, same table again (A11-13): the form starts a week on, on the table’s clock', () => {
  it('a week after the table, at its own time in its own zone', () => {
    expect(aWeekOn('2026-12-05T02:30:00Z', 'Asia/Makassar', Date.parse('2026-11-27T00:00:00Z'))).toEqual({ date: '2026-12-12', time: '10:30' });
  });
  it('a table long past starts the next one a week on from today, never in the past', () => {
    const next = aWeekOn('2026-01-03T10:00:00Z', 'UTC', Date.parse('2026-11-27T00:00:00Z'));
    expect(next.time).toBe('10:00');
    expect(Date.parse(`${next.date}T${next.time}Z`)).toBeGreaterThan(Date.parse('2026-11-27T00:00:00Z'));
  });
});

describe('package 4, the way in (W2-4): several photographs at once, each through the editor', () => {
  it('offers Add photographs, which picks several', () => {
    const html = render(<WalkthroughEditor tableId="t" detail={detail([])} />, client => {
      client.setQueryData(['host-table-way', 't'], { way: { address: null, map_link: null, venue_guide: null, place_id: null }, places: [] });
    });
    expect(html).toContain('Add photographs');
    expect(html).toMatch(/<input[^>]*multiple=""[^>]*data-testid="way-photos-picker"|<input[^>]*data-testid="way-photos-picker"[^>]*multiple=""/);
  });
});

describe('package 8, tasting share (W1-10): the choice is the action', () => {
  it('has no second Share or Done button; Not now leaves it as it was', () => {
    const html = render(<TastingShareStep productId="p" photographCount={0} onClose={() => undefined} />);
    expect(html).toContain('Keep private');
    expect(html).toContain('On my page');
    expect(html).toContain('Not now');
    expect(html).not.toMatch(/>Share<|>Done</);
  });
});
