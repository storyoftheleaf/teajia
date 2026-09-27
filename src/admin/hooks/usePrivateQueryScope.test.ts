import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { privateQueryKey } from './usePrivateQueryScope';

describe('private cache isolation', () => {
  it('does not show store A invoices after switching to store B if B fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const family = 'invoices-pending-summary';
    const a = [family, ...privateQueryKey('store-a', 'operator', 1)];
    const b = [family, ...privateQueryKey('store-b', 'operator', 2)];
    client.setQueryData(a, [{ customer_name: 'Store A customer', invoice_number: 'A-1' }]);
    await expect(client.fetchQuery({ queryKey: b, queryFn: () => Promise.reject(new Error('offline')) }))
      .rejects.toThrow('offline');
    expect(client.getQueryData(b)).toBeUndefined();
    expect(client.getQueryData(a)).toEqual([{ customer_name: 'Store A customer', invoice_number: 'A-1' }]);
    expect(privateQueryKey('store-a', 'other-operator', 1)).not.toEqual(privateQueryKey('store-a', 'operator', 1));
    client.clear();
  });

  it('does not let a late store A response populate store B', async () => {
    const client = new QueryClient();
    let finishA!: (value: string[]) => void;
    const a = ['pending-attendees', ...privateQueryKey('store-a', 'operator', 1)];
    const b = ['pending-attendees', ...privateQueryKey('store-b', 'operator', 2)];
    const lateA = client.fetchQuery({ queryKey: a, queryFn: () => new Promise<string[]>(resolve => { finishA = resolve; }) });
    client.setQueryData(b, ['Store B guest']);
    finishA(['Store A guest']);
    await lateA;
    expect(client.getQueryData(b)).toEqual(['Store B guest']);
    client.clear();
  });
});
