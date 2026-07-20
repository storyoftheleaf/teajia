import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as proxyApi } from './api/[[path]]';
import { onRequest as proxyMedia } from './media/[[path]]';

function timeoutError(): Error {
  const error = new Error('The operation timed out');
  error.name = 'TimeoutError';
  return error;
}

describe('Pages proxy timeout responses', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError()));
    vi.stubGlobal('caches', {
      default: {
        match: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a JSON 504 when the API upstream exceeds its budget', async () => {
    const response = await proxyApi({
      request: new Request('https://teajia.test/api/products'),
      env: { WORKER_ORIGIN: 'https://api.teajia.test' },
    } as any);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: 'The server took too long to respond. Please try again.',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    );
  });

  it('allows import analysis enough time to finish upstream', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await proxyApi({
      request: new Request('https://teajia.test/api/curate/imports/batch-1/analyze', { method: 'POST' }),
      env: { WORKER_ORIGIN: 'https://api.teajia.test' },
    } as any);

    expect(timeout).toHaveBeenCalledWith(120_000);
  });

  it('returns a JSON 504 when the media upstream exceeds its budget', async () => {
    const response = await proxyMedia({
      request: new Request('https://teajia.test/media/photo.jpg'),
      waitUntil: vi.fn(),
    } as any);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: 'The server took too long to respond. Please try again.',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://media.teajia.co/photo.jpg',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
