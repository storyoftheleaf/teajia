import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginLibraryPreviewAuthorization, clearLibraryPreviewSession, libraryPreviewFetchSnapshot, readLibraryPreviewSession, redeemLibraryPreviewCode, validLibraryPreviewRequest } from './libraryPreviewSession';
const key = 'teajia.library-preview.session.v1';
const pendingKey = 'teajia.library-preview.pending.v1';
const token = `tjlp_${'a'.repeat(43)}`;
let data: Map<string, string>;
let replaceState: ReturnType<typeof vi.fn>;
const validSession = () => ({ token, accountId: 'account-one', grantId: 'grant-one', expiresAt: Date.now() + 60_000 });
beforeEach(() => {
  data = new Map(); replaceState = vi.fn();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:7789', hash: '', assign: vi.fn() }, history: { replaceState } });
});
afterEach(() => vi.unstubAllGlobals());
describe('Library-only capability storage', () => {
  it('sends only the S256 challenge to the live approval page', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(1), subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(2).buffer) } });
    await beginLibraryPreviewAuthorization();
    const pending = JSON.parse(data.get(pendingKey)!);
    const destination = vi.mocked(window.location.assign).mock.calls[0][0] as string;
    expect(new URL(destination).origin).toBe('https://www.teajia.com');
    expect(destination).not.toContain(pending.verifier);
    expect(new URL(destination).searchParams.has('challenge')).toBe(true);
    expect(new URL(destination).searchParams.has('token')).toBe(false);
  });
  it('accepts only the exact approved origin and S256 challenge', () => {
    expect(validLibraryPreviewRequest('http://127.0.0.1:7789', 'a'.repeat(43))).toBe(true);
    for (const origin of ['https://evil.example', 'http://localhost:7789', 'http://127.0.0.1:7789/', 'http://127.0.0.1:7789@evil.example']) expect(validLibraryPreviewRequest(origin, 'a'.repeat(43))).toBe(false);
    expect(validLibraryPreviewRequest('http://127.0.0.1:7789', 'bad')).toBe(false);
  });
  it('drops expired and invalid sessions without touching normal authentication', () => {
    data.set('teajia-token', 'ordinary-auth');
    for (const session of [{ ...validSession(), expiresAt: 0 }, { ...validSession(), token: 'ordinary-jwt' }, { ...validSession(), expiresAt: 'bad' }]) {
      data.set(key, JSON.stringify(session)); expect(readLibraryPreviewSession()).toBeNull(); expect(data.has(key)).toBe(false);
    }
    expect(data.get('teajia-token')).toBe('ordinary-auth');
  });
  it('reuses the valid session and clears only its own state', () => {
    const session = validSession(); data.set(key, JSON.stringify(session)); data.set(pendingKey, '{}');
    expect(readLibraryPreviewSession()).toEqual(session);
    clearLibraryPreviewSession(); expect(data.size).toBe(0);
  });
  it('erases a callback code before redemption and never sends a full account token', async () => {
    window.location.hash = `#code=${'c'.repeat(43)}`;
    data.set(pendingKey, JSON.stringify({ verifier: 'v'.repeat(43), createdAt: Date.now() }));
    const fetch = vi.fn(async (_url, opts) => {
      expect(replaceState).toHaveBeenCalledWith(null, '', '/dev/library-preview');
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(opts.credentials).toBe('omit');
      return { ok: true, json: async () => validSession() };
    }); vi.stubGlobal('fetch', fetch);
    expect((await redeemLibraryPreviewCode())?.token).toBe(token);
    expect(data.has(pendingKey)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('shares one redemption across repeated mounts', async () => {
    window.location.hash = `#code=${'c'.repeat(43)}`;
    data.set(pendingKey, JSON.stringify({ verifier: 'v'.repeat(43), createdAt: Date.now() }));
    const fetch = vi.fn(async () => ({ ok: true, json: async () => validSession() })); vi.stubGlobal('fetch', fetch);
    const first = redeemLibraryPreviewCode(); const second = redeemLibraryPreviewCode();
    expect(first).toBe(second); await Promise.all([first, second]); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refuses a callback without its matching local verifier', async () => {
    window.location.hash = `#code=${'c'.repeat(43)}`; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(redeemLibraryPreviewCode()).rejects.toThrow('another tab'); expect(fetch).not.toHaveBeenCalled(); expect(replaceState).toHaveBeenCalled();
  });
  it('uses only the fixed snapshot GET and clears revoked access', async () => {
    data.set(key, JSON.stringify(validSession()));
    const fetch = vi.fn(async () => ({ ok: false, status: 403 })); vi.stubGlobal('fetch', fetch);
    await expect(libraryPreviewFetchSnapshot()).rejects.toThrow('revoked');
    expect(fetch).toHaveBeenCalledWith('https://www.teajia.com/api/dev/library-preview/snapshot', expect.objectContaining({ method: 'GET', credentials: 'omit', headers: { Authorization: `Bearer ${token}` } }));
    expect(readLibraryPreviewSession()).toBeNull();
  });
});
