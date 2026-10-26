import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { adminShellNeedsProducts, createProductReconciler } from './productQueries';
import type { Product } from './types';

const key = ['products', 'account-a', 'user-a'];
const row = (id: string, stock = 10) => ({ id, productName: id, stockGrams: stock }) as Product;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

describe('admin product demand', () => {
  it('loads shell consumers and open overlays, but not unrelated pages', () => {
    for (const route of ['stock', 'inventory', 'capture', 'activity', 'dashboard']) {
      expect(adminShellNeedsProducts(`/admin/${route}`)).toBe(true);
    }
    for (const route of ['compass', 'people', 'currency', 'account-settings', 'events', 'access', 'wisdom']) {
      expect(adminShellNeedsProducts(`/admin/${route}`)).toBe(false);
      expect(adminShellNeedsProducts(`/admin/${route}`, { commandPalette: true })).toBe(true);
    }
    for (const overlay of ['registry', 'createProduct', 'importProducts']) {
      expect(adminShellNeedsProducts('/admin/events', { [overlay]: true })).toBe(true);
    }
    expect(adminShellNeedsProducts('/admin/stock-fake')).toBe(false);
  });
});

describe('authoritative product reconciliation', () => {
  it('reads only distinct changed rows and keeps other rows and their age', async () => {
    const client = new QueryClient();
    client.setQueryData(key, [row('a'), row('b'), row('c')], { updatedAt: 123 });
    const read = vi.fn(async id => row(id, 25));
    const reconcile = createProductReconciler(client, key, read, () => true);
    expect(await reconcile.refresh(['a', 'a', 'b'])).toBe(true);
    expect(read.mock.calls).toEqual([['a'], ['b']]);
    expect(client.getQueryData(key)).toEqual([row('a', 25), row('b', 25), row('c')]);
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(123);
    client.clear();
  });

  it('never fabricates a complete list from a single row', async () => {
    const client = new QueryClient(); const read = vi.fn(async id => row(id));
    const reconcile = createProductReconciler(client, key, read, () => true);
    expect(await reconcile.refresh(['a'])).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(client.getQueryData(key)).toBeUndefined();
  });

  it('does not restore private data after logout or update a different account', async () => {
    const client = new QueryClient(); client.setQueryData(key, [row('a')]);
    const pending = deferred<Product>(); let current = true;
    const reconcile = createProductReconciler(client, key, () => pending.promise, () => current);
    const refresh = reconcile.refresh(['a']);
    current = false; client.clear();
    client.setQueryData(['products', 'account-b', 'user-a'], [row('b')]);
    pending.resolve(row('a', 50));
    expect(await refresh).toBe(false);
    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(['products', 'account-b', 'user-a'])).toEqual([row('b')]);
    client.clear();
  });

  it('does not let a late read undo a newer read or confirmed deletion', async () => {
    const client = new QueryClient(); client.setQueryData(key, [row('a'), row('b')]);
    const first = deferred<Product>(); const second = deferred<Product>();
    const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const reconcile = createProductReconciler(client, key, read, () => true);
    const oldRefresh = reconcile.refresh(['a']); const newRefresh = reconcile.refresh(['a']);
    second.resolve(row('a', 50)); await newRefresh;
    first.resolve(row('a', 20)); await oldRefresh;
    expect(client.getQueryData(key)).toEqual([row('a', 50), row('b')]);
    const late = deferred<Product>(); read.mockReturnValueOnce(late.promise);
    const refresh = reconcile.refresh(['a']); await reconcile.remove('a');
    late.resolve(row('a', 80)); await refresh;
    expect(client.getQueryData(key)).toEqual([row('b')]);
    client.clear();
  });

  it('does not repopulate a new session cache with a late response even for the same account', async () => {
    const client = new QueryClient(); client.setQueryData(key, [row('a')]);
    const pending = deferred<Product>();
    const reconcile = createProductReconciler(client, key, () => pending.promise, () => true);
    const refresh = reconcile.refresh(['a']); client.clear();
    client.setQueryData(key, [row('new-session')]); pending.resolve(row('a', 100));
    expect(await refresh).toBe(false);
    expect(client.getQueryData(key)).toEqual([row('new-session')]);
    client.clear();
  });

  it('preserves a previously invalidated whole list when reconciling or deleting one row', async () => {
    const client = new QueryClient(); client.setQueryData(key, [row('a'), row('b')]);
    await client.invalidateQueries({ queryKey: key, refetchType: 'none' });
    const reconcile = createProductReconciler(client, key, async id => row(id, 50), () => true);
    expect(await reconcile.refresh(['a'])).toBe(true);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    await reconcile.remove('a');
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });

  it('removes authoritative 404s and marks failed reads stale without pretending a save failed', async () => {
    const client = new QueryClient(); client.setQueryData(key, [row('a'), row('b')]);
    const read = vi.fn(async id => { throw { status: id === 'a' ? 404 : 503 }; });
    const reconcile = createProductReconciler(client, key, read, () => true);
    expect(await reconcile.refresh(['a', 'b'])).toBe(false);
    expect(client.getQueryData(key)).toEqual([row('b')]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
});
