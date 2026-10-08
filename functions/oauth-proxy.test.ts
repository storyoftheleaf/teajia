import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { onRequest as proxyOauth } from './oauth/[[path]]';

/*
 * The consent page asks the app's own origin for /oauth/authorize/request/<id>
 * and posts to /oauth/authorize/decision. If teajia.com does not forward
 * /oauth/*, it answers with index.html and every agent sign-in dies on
 * "Unexpected token '<'" (2026-10-08, Grok Bot; broken since 2026-06-29).
 */
describe('teajia.com forwards /oauth/* to the worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is routed to a Function at all', () => {
    const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8'));
    expect(routes.include).toContain('/oauth/*');
  });

  it('forwards the consent page reads and the decision unchanged, keeping redirects manual', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { WORKER_ORIGIN: 'https://api.teajia.com' };
    const read = await proxyOauth({ request: new Request('https://www.teajia.com/oauth/authorize/request/abc?x=1'), env } as any);
    expect(read.headers.get('content-type')).toBe('application/json');
    expect(String(fetchMock.mock.calls[0][0].url ?? fetchMock.mock.calls[0][0])).toBe('https://api.teajia.com/oauth/authorize/request/abc?x=1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });

    await proxyOauth({ request: new Request('https://www.teajia.com/oauth/authorize/decision', { method: 'POST', body: '{}' }), env } as any);
    const sent = fetchMock.mock.calls[1][0] as Request;
    expect(sent.url).toBe('https://api.teajia.com/oauth/authorize/decision');
    expect(sent.method).toBe('POST');
  });
});
