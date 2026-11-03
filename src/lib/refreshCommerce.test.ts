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
});
