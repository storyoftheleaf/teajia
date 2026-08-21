import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'https://api.test');
const { api, clearToken, setToken } = await import('./api');

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function tokenFor(accountId: string): string {
  const encode = (value: Record<string, unknown>) => btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: 'operator-1',
    active_account_id: accountId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  })}.test-signature`;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  setToken(tokenFor('account-bali'));
});

afterEach(() => {
  clearToken();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('authenticated inquiry clients', () => {
  it('lists inquiries with the operator token and active account', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ inquiries: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(api.inquiries.list('new')).resolves.toEqual({ inquiries: [] });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/inquiries?status=new');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${localStorage.getItem('teajia_token')}`);
    expect(new Headers(init.headers).get('X-Teajia-Account')).toBe('account-bali');
  });

  it('updates inquiry status with the operator token and active account', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(api.inquiries.updateStatus('inquiry/1', 'replied')).resolves.toEqual({ success: true });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/inquiries/inquiry%2F1/status');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ status: 'replied' }) });
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${localStorage.getItem('teajia_token')}`);
    expect(new Headers(init.headers).get('X-Teajia-Account')).toBe('account-bali');
  });

  it.each([
    ['list', () => api.inquiries.list()],
    ['update', () => api.inquiries.updateStatus('inquiry-1', 'closed')],
  ])('rejects a typed ApiError when %s fails', async (_operation, request) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Insufficient bundle for this action',
      code: 'insufficient_bundle',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(request()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Insufficient bundle for this action',
      status: 403,
      data: expect.objectContaining({ code: 'insufficient_bundle' }),
    });
  });
});
