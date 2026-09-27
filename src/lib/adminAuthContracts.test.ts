import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const storage = (entries: Record<string, string> = {}) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: (key: string, value: string) => { entries[key] = value; },
  removeItem: (key: string) => { delete entries[key]; },
});

afterEach(() => vi.unstubAllGlobals());

describe('admin auth contracts', () => {
  it('sends sessionStorage token for flyer, venue photo, and MCP token calls', async () => {
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage({ teajia_token: 'session-token' }));
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(url.includes('mcp-tokens') ? [] : { url: '/image.jpg' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    await api.events.uploadFlyer(new Blob(['flyer'], { type: 'image/jpeg' }));
    await api.venues.uploadPhoto('venue-1', new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }));
    await api.mcpTokens.list();
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(new Headers(call.init.headers).get('Authorization')).toBe('Bearer session-token');
    for (const call of calls.slice(0, 2)) {
      expect(call.init.body).toBeInstanceOf(FormData);
      expect(new Headers(call.init.headers).has('Content-Type')).toBe(false);
    }
  });
});
