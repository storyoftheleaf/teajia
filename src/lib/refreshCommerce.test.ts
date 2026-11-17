import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { refreshCommerceQueries, registerShelfReconciler } from './refreshCommerce';
import { singleProductWrite } from './api';

describe('a saved commerce change reaches every dependent view', () => {
  it('invalidates Stock, both storefronts, receiving and customer orders without rereading pricing settings', async () => {
    const client = new QueryClient();
    const dependent = [
      ['products', 'account', 'user'], ['products', 'public'],
      ['storefront', 'products', 'partner'],
      ['stock_ledger', 'account', 'user'], ['orders', 'account'],
      ['me', 'orders', 'invoice'], ['customers', 'account'], ['attention', 'account'], ['purchase_orders'], ['my-orders', 'user'], ['inventory-summary', 'account'],
    ];
    const untouched = [['article', 'tea'], ['shop-freight-default', 'account', 'user'], ['rates', 'account', 'user']];
    for (const key of [...dependent, ...untouched]) client.setQueryData(key, { saved: true });
    await refreshCommerceQueries(client, 'account');
    for (const key of dependent) expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    await refreshCommerceQueries(client, 'account', { kind: 'pricing' });
    for (const key of untouched.slice(1)) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });

  it('updates tracking after a route or carrier write without refetching catalogues', async () => {
    const client = new QueryClient();
    const tracking = [['purchase-logistics', 'account'], ['purchase-tracking', 'account'], ['purchase_orders']];
    const untouched = [['products', 'public'], ['products', 'account', 'user'], ['rates', 'account', 'user'], ['customers', 'account']];
    for (const key of [...tracking, ...untouched]) client.setQueryData(key, {});
    await refreshCommerceQueries(client, 'account', { kind: 'tracking' });
    for (const key of tracking) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
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

  it('rereads only the named teas when the shelf on screen can reconcile them', async () => {
    const client = new QueryClient();
    const shelf = ['products', 'account', 'user'];
    const dependent = [['products', 'public'], ['stock_ledger', 'account', 'user'], ['inventory-summary', 'account'], ['orders', 'account']];
    for (const key of [shelf, ...dependent]) client.setQueryData(key, { saved: true });
    const asked: string[][] = [];
    const unregister = registerShelfReconciler(shelf, async ids => { asked.push([...ids]); return true; });
    await refreshCommerceQueries(client, 'account', { changedProductIds: ['tea-1', 'tea-1'] });
    expect(asked).toEqual([['tea-1']]);
    expect(client.getQueryState(shelf)?.isInvalidated).toBe(false);
    for (const key of dependent) expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true);
    unregister();
    client.clear();
  });

  it('falls back to rereading the shelf when nothing on screen can reconcile it', async () => {
    const client = new QueryClient();
    const shelf = ['products', 'account', 'user'];
    client.setQueryData(shelf, { saved: true });
    const unregister = registerShelfReconciler(['products', 'other-account', 'user'], async () => true);
    await refreshCommerceQueries(client, 'account', { changedProductIds: ['tea-1'] });
    expect(client.getQueryState(shelf)?.isInvalidated).toBe(true);
    unregister();
    client.clear();
  });
});

describe('which writes name the one tea they changed', () => {
  const base = 'https://api.example/api/products';
  it('names a tea for its own edits, visibility and removal', () => {
    for (const [url, method] of [[`${base}/tea-1`, 'PUT'], [`${base}/tea-1/stock`, 'PUT'], [`${base}/tea-1/commercial`, 'PUT'],
      [`${base}/tea-1/catalog`, 'PUT'], [`${base}/tea-1/publication`, 'PUT'], [`${base}/tea-1/shown`, 'PUT'], [`${base}/tea-1`, 'DELETE']]) {
      expect(singleProductWrite(url, method), `${method} ${url}`).toEqual(['tea-1']);
    }
  });
  it('names nothing for writes that create a tea or can move a second one', () => {
    for (const [url, method] of [[base, 'POST'], [`${base}/bulk`, 'POST'], [`${base}/tea-1/movements`, 'POST'],
      [`${base}/tea-1/featured`, 'POST'], [`${base}/tea-1`, 'GET'], ['https://api.example/api/invoices/1', 'PUT']]) {
      expect(singleProductWrite(url, method), `${method} ${url}`).toBeUndefined();
    }
  });
});
