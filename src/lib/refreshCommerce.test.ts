import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { refreshCommerceQueries } from './refreshCommerce';

describe('a saved commerce change reaches every dependent view', () => {
  it('invalidates Stock, both storefronts, receiving, freight and customer orders without touching editorial queries', async () => {
    const client = new QueryClient();
    const dependent = [
      ['products', 'account', 'user'], ['products', 'public'],
      ['storefront', 'products', 'partner'], ['shop-freight-default', 'account', 'user'],
      ['stock_ledger', 'account', 'user'], ['orders', 'account'],
      ['me', 'orders', 'invoice'], ['customers', 'account'], ['attention', 'account'], ['purchase_orders'], ['my-orders', 'user'], ['inventory-summary', 'account'],
    ];
    for (const key of [...dependent, ['article', 'tea']]) client.setQueryData(key, { saved: true });
    await refreshCommerceQueries(client, 'account');
    for (const key of dependent) expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true);
    expect(client.getQueryState(['article', 'tea'])?.isInvalidated).toBe(false);
    client.clear();
  });

  it('leaves the full shelf alone when the caller has already reconciled the changed rows', async () => {
    const client = new QueryClient();
    const shelf = ['products', 'account', 'user'];
    const dependent = [['products', 'public'], ['products', 'detail', 'account', 'tea-1'], ['stock_ledger', 'account', 'user'], ['inventory-summary', 'account'], ['orders', 'account']];
    for (const key of [shelf, ...dependent]) client.setQueryData(key, { saved: true });
    await refreshCommerceQueries(client, 'account', { shelfRowsReconciled: true });
    expect(client.getQueryState(shelf)?.isInvalidated).toBe(false);
    for (const key of dependent) expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true);
    client.clear();
  });
});
