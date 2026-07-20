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
  let reportIncident: ReturnType<typeof vi.spyOn>;
  let testClock = Date.now();

  beforeEach(() => {
    vi.useFakeTimers();
    testClock += 60_000;
    vi.setSystemTime(testClock);
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
    reportIncident = vi.spyOn(api.incidents, 'report').mockResolvedValue({} as never);
  });

  afterEach(() => {
    testClock = Math.max(testClock, Date.now());
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    const request = syncNotes([], { background: true });
    const rejection = expect(request).rejects.toThrow('Request timed out');

    await vi.runAllTimersAsync();
    await rejection;

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: NETWORK_ERROR_EVENT }),
    );
  });

  it('gives import analysis one long attempt instead of restarting it every 15 seconds', async () => {
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).includes('/version.json?probe=1')) return Promise.resolve(new Response('{}', { status: 200 }));
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const outcome = api.curateImports.analyze('batch-long').catch(error => error as Error);

    await vi.advanceTimersByTimeAsync(15_500);
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes('/batch-long/analyze'))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(104_500);
    await expect(outcome).resolves.toMatchObject({ message: 'Request timed out. Please try again.' });
  });

  it('uses a successful site probe to classify an API failure and dispatches recovery after success', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input).includes('/version.json?probe=1')) {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    const request = api.notes.sync([]);
    const rejection = expect(request).rejects.toThrow("Couldn't reach the server");

    await vi.runAllTimersAsync();
    await rejection;

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NETWORK_ERROR_EVENT,
        detail: { kind: 'slow' },
      }),
    );

    dispatchEvent.mockClear();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ notes: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await api.notes.getAll();

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'teajia:network-recovered' }),
    );
  });

  it('classifies a foreground transport failure as offline without probing when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const request = api.notes.sync([]);
    const rejection = expect(request).rejects.toThrow("Couldn't reach the server");

    await vi.runAllTimersAsync();
    await rejection;

    expect(fetch).toHaveBeenCalledTimes(5);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NETWORK_ERROR_EVENT,
        detail: { kind: 'offline' },
      }),
    );
    expect(reportIncident).toHaveBeenCalledTimes(1);
    expect(reportIncident).toHaveBeenCalledWith(expect.objectContaining({
      category: 'network',
      error_code: 'transport_failure',
      method: 'POST',
      route: '/api/notes/sync',
    }));
  });

  it('reports a server response once with request context', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ error: 'Unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    await expect(api.notes.getAll()).rejects.toMatchObject({ status: 503 });
    await expect(api.notes.getAll()).rejects.toMatchObject({ status: 503 });

    expect(reportIncident).toHaveBeenCalledTimes(1);
    expect(reportIncident).toHaveBeenCalledWith(expect.objectContaining({
      category: 'server',
      error_code: 'http_503',
      http_status: 503,
      method: 'GET',
      route: '/api/notes',
    }));
  });

  it('does not recurse when the incident endpoint itself fails', async () => {
    reportIncident.mockRestore();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(api.incidents.report({ signature: 'test' })).rejects.toMatchObject({ status: 503 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: NETWORK_ERROR_EVENT }),
    );
  });
});
