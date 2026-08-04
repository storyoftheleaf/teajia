import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWorkerProxyPath, onRequest } from './_middleware';

describe('Pages protocol proxy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('matches only MCP, OAuth, and the supported discovery endpoints', () => {
    for (const path of ['/mcp', '/mcp/public', '/oauth/token', '/oauth/authorize/request/abc', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration', '/sitemap-products.xml']) {
      expect(isWorkerProxyPath(path), path).toBe(true);
    }
    for (const path of ['/api/products', '/media/x.jpg', '/oauth', '/.well-known/security.txt', '/read', '/sitemap.xml', '/shop/product/abc']) {
      expect(isWorkerProxyPath(path), path).toBe(false);
    }
  });

  it('preserves target path, query, method, headers, body, and manual redirects', async () => {
    const upstream = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', upstream);
    const request = new Request('https://www.teajia.com/oauth/token?client=a', {
      method: 'POST', headers: { authorization: 'Bearer x', 'content-type': 'text/plain', 'x-teajia-public-origin': 'https://attacker.example' }, body: 'grant=code',
    });
    const next = vi.fn();
    const response = await onRequest({ request, env: { WORKER_ORIGIN: 'https://worker.example/base/' }, next } as any);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(next).not.toHaveBeenCalled();
    const [proxied, init] = upstream.mock.calls[0] as unknown as [Request, RequestInit];
    expect(proxied.url).toBe('https://worker.example/oauth/token?client=a');
    expect(proxied.method).toBe('POST');
    expect(proxied.headers.get('authorization')).toBe('Bearer x');
    expect(proxied.headers.get('x-teajia-public-origin')).toBe('https://www.teajia.com');
    expect(await proxied.text()).toBe('grant=code');
    expect(init.redirect).toBe('manual');
  });

  it('fails closed instead of returning SPA HTML', async () => {
    const next = vi.fn(async () => new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } }));
    for (const path of ['/mcp', '/oauth/token', '/.well-known/openid-configuration']) {
      const response = await onRequest({ request: new Request(`https://www.teajia.com${path}`), env: {}, next } as any);
      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.text()).not.toContain('<html>');
    }
    expect(next).not.toHaveBeenCalled();
  });
});
