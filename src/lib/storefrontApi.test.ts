import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNetworkStores, normalizeProduct } from './storefrontApi';

describe('storefront API transport retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })));
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      location: { origin: 'https://teajia.test' },
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a transient transport failure', async () => {
    const request = fetchNetworkStores();
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('storefront product tasting provenance', () => {
  it('decodes source and preserves legacy common tasting sources', () => {
    expect(normalizeProduct({ id: 'source-lot', tasting_source: 'source' }).tastingSource).toBe('source');
    expect(normalizeProduct({ id: 'legacy-common', tasting_source: 'common' }).tastingSource).toBe('common');
  });
});
