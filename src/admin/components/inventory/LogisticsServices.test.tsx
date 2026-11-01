import React from 'react';
// Render task bodies here to inspect their controls independently of portal visibility.
vi.mock('./TrackingTask', () => ({ TrackingTask: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LogisticsService } from '../../../lib/logisticsTypes';
import { LogisticsServices, serviceRateLabel } from './LogisticsServices';
const service: LogisticsService = { id: 'service', logistics_company_id: 'contact', logistics_company_name: 'Guangzhou', name: 'Airmail', mode: 'air', basis: 'kg', rate: 85, currency: 'CNY', active: true };
describe('saved logistics services', () => {
  it('shows company services and rates in the dedicated service task', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const html = renderToStaticMarkup(<QueryClientProvider client={client}><LogisticsServices services={[service, { ...service, id: 'old', name: 'Old service', active: false }]} accountId="shop" busy={false} mutate={async action => { await action(); }}/></QueryClientProvider>);
    expect(html).toContain('Logistics services');
    expect(html).toContain('Guangzhou');
    expect(html).toContain('Airmail');
    expect(html).toContain('85 CNY/kg');
    expect(html).not.toContain('Old service');
    expect(html).not.toContain('Service rate currency');
    expect(html).not.toContain('open=""');
  });
  it('distinguishes volume and fixed rates while preserving explicit zero', () => {
    expect(serviceRateLabel({ ...service, basis: 'm3', rate: 450 })).toBe('450 CNY/m³');
    expect(serviceRateLabel({ ...service, basis: 'fixed', rate: 0 })).toBe('0 CNY fixed');
  });
});
