import React from 'react';
import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityView } from './ActivityView';
import type { InquiryRecord } from '../../lib/api';

const appStoreState = vi.hoisted(() => ({ activeAccountId: null as string | null }));

vi.mock('../../lib/store', () => ({
  useAppStore: (selector: (state: typeof appStoreState) => unknown) => selector(appStoreState),
}));

const source = readFileSync(new URL('./ActivityView.tsx', import.meta.url), 'utf8');

function inquiry(id: string, accountId: string, name: string): InquiryRecord {
  return {
    id,
    account_id: accountId,
    name,
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
  };
}

function renderActivity(queryClient: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/activity?tab=inquiries']}>
        <ActivityView products={[]} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  appStoreState.activeAccountId = null;
});

describe('account-scoped inquiry inbox', () => {
  it('never renders cached rows from the previous account when the current account fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false } },
    });
    const oldInquiry = inquiry('old-inquiry', 'account-old', 'Previous Account Customer');
    queryClient.setQueryData(['admin-inquiries', 'all'], [oldInquiry]);
    queryClient.setQueryData(['admin-inquiries', 'account-old', 'all'], [oldInquiry]);
    await queryClient.prefetchQuery({
      queryKey: ['admin-inquiries', 'account-current', 'all'],
      queryFn: async () => { throw new Error('Current account unavailable'); },
    });
    appStoreState.activeAccountId = 'account-current';

    const html = renderActivity(queryClient);

    expect(html).toContain('Could not load inquiries');
    expect(html).not.toContain('Previous Account Customer');
    expect(html).not.toContain('No inquiries');
  });

  it('renders no cached inquiry rows until an active account is confirmed', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['admin-inquiries', 'all'], [
      inquiry('unscoped-inquiry', 'account-old', 'Unscoped Customer'),
    ]);

    const html = renderActivity(queryClient);

    expect(html).not.toContain('Unscoped Customer');
  });

  it('shows an accessible unknown count and retry control when the count request fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false } },
    });
    for (const queryKey of [
      ['inquiries-new-count'],
      ['inquiries-new-count', 'account-current'],
    ]) {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => { throw new Error('Count unavailable'); },
      });
    }
    appStoreState.activeAccountId = 'account-current';

    const html = renderActivity(queryClient);

    expect(html).toContain('aria-label="Inquiry count unavailable"');
    expect(html).toContain('aria-label="Retry inquiry count"');
    expect(html).not.toContain('aria-label="Inquiry count">0');
  });

  it('gives every status selector an accessible 44px target', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['admin-inquiries', 'all'], [
      inquiry('inquiry-one', 'account-current', 'Private Person'),
    ]);
    queryClient.setQueryData(['admin-inquiries', 'account-current', 'all'], [
      inquiry('inquiry-one', 'account-current', 'Private Person'),
    ]);
    appStoreState.activeAccountId = 'account-current';

    const html = renderActivity(queryClient);

    expect(html).toMatch(/<select[^>]*aria-label="Status for Private Person"/);
    expect(html).toMatch(/<select[^>]*class="[^"]*tap-target/);
  });

  it('serializes status changes and resets stale mutation errors around attempts', () => {
    expect(source).toContain('disabled={updateStatus.isPending}');
    expect(source).not.toContain("updateStatus.isPending && updateStatus.variables?.id === inq.id");
    expect(source).toMatch(/updateStatus\.reset\(\);\s*updateStatus\.mutate\(/);
    expect(source).toMatch(/onSuccess:[\s\S]*updateStatus\.reset\(\)/);
  });
});
