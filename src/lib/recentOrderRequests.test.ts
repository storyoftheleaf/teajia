import { describe, expect, it, vi } from 'vitest';
import { readRecentOrderRequests, recentOrderRequestPath, rememberRecentOrderRequest, type RecentOrderRequest } from './recentOrderRequests';

function memoryStorage() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}
function request(index = 1, storeSlug = 'teajia-bali'): RecentOrderRequest {
  return { trackingToken: `order_${String(index).padStart(37, '0')}`, reference: `TJ-20260927-${index}`, storeSlug, createdAt: `2026-09-27T10:00:${String(index).padStart(2, '0')}.000Z` };
}

describe('recent guest order links', () => {
  it('keeps three newest requests per store without mixing shops or duplicating a retry', () => {
    const storage = memoryStorage();
    for (let i = 1; i <= 5; i++) rememberRecentOrderRequest(request(i), storage);
    rememberRecentOrderRequest(request(6, 'other-store'), storage);
    rememberRecentOrderRequest(request(5), storage);
    expect(readRecentOrderRequests('teajia-bali', storage).map(row => row.reference)).toEqual([5, 4, 3].map(i => request(i).reference));
    expect(readRecentOrderRequests('other-store', storage)).toEqual([request(6, 'other-store')]);
    expect(recentOrderRequestPath(request())).toBe(`/order/${request().trackingToken}`);
  });

  it('stores only the link identity, store, and time', () => {
    const storage = memoryStorage();
    const extra = { ...request(), contact: 'private@example.com', items: [{ name: 'Private tea' }] };
    expect(rememberRecentOrderRequest(extra, storage)).toBe(true);
    expect(JSON.parse(storage.getItem()!)).toEqual([request()]);
  });

  it('accepts the generated base64url token shape and refuses paths or malformed data', () => {
    const storage = memoryStorage();
    const valid = { ...request(), trackingToken: 'Ab0_'.repeat(10) + '-Qx' };
    expect(rememberRecentOrderRequest(valid, storage)).toBe(true);
    for (const invalid of [
      { trackingToken: '../order/private' }, { trackingToken: 'a'.repeat(129) },
      { reference: '<script>' }, { storeSlug: '../other' }, { createdAt: 'not a date' },
    ]) expect(rememberRecentOrderRequest({ ...request(), ...invalid }, storage)).toBe(false);
  });

  it('tolerates malformed storage and can save a fresh request afterwards', () => {
    const storage = memoryStorage();
    for (const raw of ['{broken', '{}', '[null,42,{"trackingToken":"fake"}]']) {
      storage.setItem('', raw);
      expect(readRecentOrderRequests('teajia-bali', storage)).toEqual([]);
      expect(rememberRecentOrderRequest(request(), storage)).toBe(true);
      expect(readRecentOrderRequests('teajia-bali', storage)).toEqual([request()]);
    }
  });

  it('does not fail checkout when reads, writes, or the browser storage getter are blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(readRecentOrderRequests('teajia-bali', blocked)).toEqual([]);
    expect(rememberRecentOrderRequest(request(), blocked)).toBe(false);
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); } });
    expect(readRecentOrderRequests('teajia-bali')).toEqual([]);
    expect(rememberRecentOrderRequest(request())).toBe(false);
    vi.unstubAllGlobals();
  });
});
