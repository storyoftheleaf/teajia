import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ failed: false, attention: [] as unknown[], alerts: [] as unknown[] }));
vi.mock('../../lib/store', () => ({ useAppStore: () => 'account-test' }));
vi.mock('../../lib/api', () => ({ getTokenClaims: () => ({ sub: 'owner-test' }), api: { attention: { list: vi.fn() }, analytics: { revenue: vi.fn(), rfm: vi.fn() } } }));
vi.mock('../hooks/useAdminData', () => ({ useRates: () => ({ data: [{ currency: 'USD', rateToUSD: 1 }], isLoading: false }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => {
  expect(queryKey.slice(1)).toEqual(['account-test', 'owner-test']);
  return { isError: state.failed, isPending: false, isFetching: false, isSuccess: !state.failed, refetch: vi.fn(), data: queryKey[0] === 'dashboard-attention' ? { items: state.attention } : queryKey[0] === 'dashboard-revenue' ? { weekly_revenue: [], inventory_age_alerts: state.alerts } : { lapsed: [], new_this_month: [], top10: [] } };
} }));
import { DashboardView } from './DashboardView';
const render = () => renderToStaticMarkup(<MemoryRouter><DashboardView products={[]} isLoading={false} /></MemoryRouter>);

beforeEach(() => { state.failed = false; state.attention = []; state.alerts = []; });
describe('operator dashboard', () => {
  it('finishes loading for an empty shop and names the measured empty queue', () => {
    const html = render();
    expect(html).toContain('Your stock will appear here as you add it.');
    expect(html).toContain('No requests, prices, payment reports or paid orders waiting on you.');
    expect(html).not.toContain('Loading stock');
  });
  it('keeps age alerts visible when no sales were returned', () => {
    state.alerts = [{ id: 'tea', product_name: 'An old tea', stock_grams: 100, last_sold_at: null }];
    const html = render();
    expect(html).toContain('An old tea');
    expect(html).toContain('No recorded sale');
    expect(html).toContain('No fulfilled sales returned for this period.');
  });
  it('does not claim an empty queue or zero sales after a failed read', () => {
    state.failed = true;
    const html = render();
    expect(html).toContain('Try again');
    expect(html).not.toContain('No requests, prices');
    expect(html).not.toContain('No fulfilled sales returned');
  });
  it('routes a waiting payment to the existing destination and does not confirm it', () => {
    state.attention = [{ kind: 'claim', id: 'claim', label: 'Review Mei’s payment', meta: 'waiting two days', href: '/admin/activity?tab=orders&search=TJ-10' }];
    const html = render();
    expect(html).toContain('Review payment');
    expect(html).toContain('/admin/activity?tab=orders&amp;search=TJ-10');
  });
});
