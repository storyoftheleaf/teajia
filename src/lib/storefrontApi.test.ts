import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNetworkStores } from './storefrontApi';

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
