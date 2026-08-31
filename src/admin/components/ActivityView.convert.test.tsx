import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityView } from './ActivityView';
import type { InquiryRecord } from '../../lib/api';

const appStoreState = vi.hoisted(() => ({ activeAccountId: null as string | null }));
const tokenScope = vi.hoisted(() => ({ accountId: null as string | null }));

vi.mock('../../lib/store', () => ({
  useAppStore: (selector: (state: typeof appStoreState) => unknown) => selector(appStoreState),
}));

vi.mock('../../lib/api', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  isTokenScopedToAccount: (accountId: string | null) => Boolean(accountId) && tokenScope.accountId === accountId,
}));

afterEach(() => {
  appStoreState.activeAccountId = null;
  tokenScope.accountId = null;
});

function inquiry(id: string, accountId: string, extra: Partial<InquiryRecord> = {}): InquiryRecord {
  return {
    id,
    account_id: accountId,
    name: `Customer ${id}`,
    email: `${id}@example.com`,
    phone: null,
    items: [],
    total_usd: 0,
    currency: 'USD',
    message: null,
    source: 'whatsapp',
    ref_number: `TJ-${id}`,
    status: 'new',
    created_at: '2026-08-10T12:00:00.000Z',
    ...extra,
  } as InquiryRecord;
}

describe('Inquiries convert action', () => {
  function render(client: QueryClient) {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/activity?tab=inquiries']}>
          <ActivityView products={[]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('offers conversion on a fresh inquiry and shows the order on a converted one', () => {
    appStoreState.activeAccountId = 'acct-1';
    tokenScope.accountId = 'acct-1';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['admin-inquiries', 'acct-1', 'all'], [
      inquiry('a', 'acct-1'),
      inquiry('b', 'acct-1', { converted_invoice_id: 'inv-77' } as Partial<InquiryRecord>),
    ]);
    const html = render(client);
    expect(html).toContain('Turn into order');
    expect(html).toContain('Turned into an order');
    expect(html).toContain('Open order');
  });

  it('never offers to convert an inquiry that already became an order', () => {
    appStoreState.activeAccountId = 'acct-1';
    tokenScope.accountId = 'acct-1';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['admin-inquiries', 'acct-1', 'all'], [
      inquiry('b', 'acct-1', { converted_invoice_id: 'inv-77' } as Partial<InquiryRecord>),
    ]);
    const html = render(client);
    expect(html).toContain('Turned into an order');
    expect(html).not.toContain('Turn into order');
  });
});
