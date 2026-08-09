import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: vi.fn(), location: { origin: 'https://test' } });
  vi.stubGlobal('navigator', { onLine: true });
});

describe('Wisdom verification API client', () => {
  it('uses the typed GET, PUT, and DELETE receipt routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entry_kind: 'namedTea', entry_id: 'courage', content_hash: 'a'.repeat(64), verified_at: '2026-08-09T00:00:00.000Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await api.wisdomVerifications.get('namedTea', 'courage')).toBeNull();
    expect((await api.wisdomVerifications.put('namedTea', 'courage', 'a'.repeat(64))).content_hash).toBe('a'.repeat(64));
    expect(await api.wisdomVerifications.delete('namedTea', 'courage')).toBeNull();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      ['/api/wisdom/verifications/namedTea/courage', 'GET'],
      ['/api/wisdom/verifications/namedTea/courage', 'PUT'],
      ['/api/wisdom/verifications/namedTea/courage', 'DELETE'],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ content_hash: 'a'.repeat(64) });
  });
});
