import { describe, expect, it, vi } from 'vitest';
import { serveReadAsset } from './readAssetDelivery';

const marker = 'SYNTHETIC_DRAFT_ONLY';
const asset = { paths: ['/read/history'], code: `export default '${marker}';` };
const req = (headers?: HeadersInit, method = 'GET') => new Request('https://site.test/read-assets/story.js', { headers, method });

describe('private Read module delivery', () => {
  it.each([301, 302, 303, 307, 308, 401, 403, 404, 500, 503])('withholds bytes when the verified Worker answers %s', async status => {
    const response = await serveReadAsset(req(), 'https://worker.test', asset, vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(response.status).toBe(status >= 500 ? 503 : 404);
    expect(await response.text()).not.toContain(marker);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('delivers unchanged code only after the server permits that exact story', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const response = await serveReadAsset(req({ Cookie: '__Host-teajia-read=real.session.signature' }), 'https://worker.test', asset, fetcher);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(asset.code);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const call = fetcher.mock.calls[0];
    expect(new URL(call[0]).searchParams.get('path')).toBe('/read/history');
    // Workers supports manual/follow only; manual also prevents a redirect
    // from forwarding editor credentials to another origin.
    expect(call[1].redirect).toBe('manual');
    expect(new Headers(call[1].headers).get('cookie')).toBe('__Host-teajia-read=real.session.signature');
  });
  it('never substitutes the public map when the authority is unavailable', async () => {
    for (const origin of [undefined, 'http://worker.test', 'not an origin']) {
      const fetcher = vi.fn();
      const response = await serveReadAsset(req(), origin, asset, fetcher);
      expect(response.status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect((await serveReadAsset(req(), 'https://worker.test', asset, vi.fn().mockRejectedValue(new Error('offline')))).status).toBe(503);
  });
  it('does not deliver a source map, an unknown module, or a non-read method', async () => {
    const fetcher = vi.fn();
    expect((await serveReadAsset(req(), 'https://worker.test', undefined, fetcher)).status).toBe(404);
    expect((await serveReadAsset(req(undefined, 'POST'), 'https://worker.test', asset, fetcher)).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks every story a shared private module contains', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const response = await serveReadAsset(req(), 'https://worker.test', { ...asset, paths: ['/read/ritual', '/read/history'] }, fetcher);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(marker);
  });
  it('checks HEAD exactly like GET, returning no body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const response = await serveReadAsset(req(undefined, 'HEAD'), 'https://worker.test', asset, fetcher);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
