import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, hasToken, setToken } from './api';

function storageFor(values: Map<string, string>) {
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

const localValues = new Map<string, string>();
const sessionValues = new Map<string, string>();
const local = storageFor(localValues);
const session = storageFor(sessionValues);

function tokenFor(accountId: string) {
  return `header.${btoa(JSON.stringify({ active_account_id: accountId }))}.signature`;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localValues.clear();
  sessionValues.clear();
  local.getItem.mockImplementation((key: string) => localValues.get(key) ?? null);
  local.setItem.mockImplementation((key: string, value: string) => { localValues.set(key, value); });
  local.removeItem.mockImplementation((key: string) => { localValues.delete(key); });
  session.getItem.mockImplementation((key: string) => sessionValues.get(key) ?? null);
  session.setItem.mockImplementation((key: string, value: string) => { sessionValues.set(key, value); });
  session.removeItem.mockImplementation((key: string) => { sessionValues.delete(key); });
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
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

    expect(await api.wisdomVerifications.get('account-a', 'namedTea', 'courage')).toBeNull();
    expect((await api.wisdomVerifications.put('account-a', 'namedTea', 'courage', 'a'.repeat(64))).content_hash).toBe('a'.repeat(64));
    expect(await api.wisdomVerifications.delete('account-a', 'namedTea', 'courage')).toBeNull();

    expect(fetchMock.mock.calls.map(([url, init]) => [
      new URL(String(url), 'https://test').pathname,
      init?.method ?? 'GET',
    ])).toEqual([
      ['/api/wisdom/verifications/namedTea/courage', 'GET'],
      ['/api/wisdom/verifications/namedTea/courage', 'PUT'],
      ['/api/wisdom/verifications/namedTea/courage', 'DELETE'],
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get('X-Teajia-Account'))).toEqual([
      'account-a', 'account-a', 'account-a',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ content_hash: 'a'.repeat(64) });
  });

  it('keeps the captured account header through a token refresh retry', async () => {
    setToken(tokenFor('account-a'));
    expect(hasToken()).toBe(true);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: tokenFor('account-b') }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await api.wisdomVerifications.get('account-a', 'namedTea', 'courage')).toBeNull();

    const receiptCalls = [fetchMock.mock.calls[0], fetchMock.mock.calls[2]];
    expect(receiptCalls.map(([, init]) => new Headers(init?.headers).get('X-Teajia-Account'))).toEqual([
      'account-a', 'account-a',
    ]);
  });
});
