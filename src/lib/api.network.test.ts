import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, NETWORK_ERROR_EVENT, type ApiRequestInit } from './api';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('background API transport failures', () => {
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    dispatchEvent.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent,
      location: { origin: 'https://teajia.test' },
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('throws without dispatching the global banner event', async () => {
    const syncNotes = api.notes.sync as (
      notes: Record<string, unknown>[],
      options?: Pick<ApiRequestInit, 'background'>,
    ) => Promise<void>;
    const request = syncNotes([], { background: true });
    const rejection = expect(request).rejects.toThrow("Couldn't reach the server");

    await vi.runAllTimersAsync();
    await rejection;

    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ background: true }),
    );
    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: NETWORK_ERROR_EVENT }),
    );
  });

  it('also suppresses the banner when a background request times out', async () => {
    const timeoutError = new Error('aborted');
    timeoutError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValue(timeoutError);
    const syncNotes = api.notes.sync as (
      notes: Record<string, unknown>[],
      options?: Pick<ApiRequestInit, 'background'>,
    ) => Promise<void>;

    await expect(syncNotes([], { background: true })).rejects.toThrow('Request timed out');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: NETWORK_ERROR_EVENT }),
    );
  });
});
