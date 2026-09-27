import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PendingView } from './PendingView';

const selection = vi.hoisted(() => ({ accountId: null as string | null, tokenAccountId: null as string | null }));

vi.mock('../../lib/store', () => ({
  useAppStore: (selector: (state: { activeAccountId: string | null }) => unknown) =>
    selector({ activeAccountId: selection.accountId }),
}));

vi.mock('../../lib/api', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  getTokenClaims: () => selection.tokenAccountId
    ? { sub: 'operator', active_account_id: selection.tokenAccountId }
    : null,
  isTokenScopedToAccount: (accountId: string | null) =>
    !!accountId && accountId === selection.tokenAccountId,
}));

function render(client: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter><PendingView /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  selection.accountId = null;
  selection.tokenAccountId = null;
});

describe('pending view private data', () => {
  it('hides store A after a failed store B read, a late A reply, and logout', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false } } });
    const ordersA = ['invoices-pending-summary', 'store-a', 'operator', 0];
    const ordersB = ['invoices-pending-summary', 'store-b', 'operator', 0];
    const attendeesA = ['pending-attendees', 'store-a', 'operator', 0];
    client.setQueryData(ordersA, [{ id: 'order-a', status: 'Pending', customer_name: 'Store A customer', invoice_number: 'A-1', created_at: '2026-09-01' }]);
    client.setQueryData(attendeesA, [{ id: 'guest-a', eventId: 'event-a', eventTitle: 'Store A event', eventDate: '2026-09-30', fullName: 'Store A guest', status: 'requested' }]);
    selection.accountId = 'store-a';
    selection.tokenAccountId = 'store-a';
    expect(render(client)).toContain('Store A customer');
    expect(render(client)).toContain('Store A guest');

    selection.accountId = 'store-b';
    selection.tokenAccountId = 'store-b';
    await client.prefetchQuery({ queryKey: ordersB, queryFn: () => Promise.reject(new Error('offline')) });
    let finishA!: (rows: string[]) => void;
    const lateA = client.fetchQuery({ queryKey: ['pending-attendees', 'store-a', 'operator', 1], queryFn: () => new Promise<string[]>(resolve => { finishA = resolve; }) });
    finishA(['late Store A guest']);
    await lateA;
    expect(render(client)).not.toContain('Store A customer');
    expect(render(client)).not.toContain('Store A guest');

    // The store selection can change before its replacement JWT arrives.
    selection.accountId = 'store-a';
    selection.tokenAccountId = 'store-b';
    expect(render(client)).not.toContain('Store A customer');
    expect(render(client)).not.toContain('Store A guest');

    selection.tokenAccountId = null;
    expect(render(client)).not.toContain('Store A customer');
    expect(render(client)).not.toContain('Store A guest');
    client.clear();
  });
});
