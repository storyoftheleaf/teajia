import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalUrlFor, isTeaAtlasPath, isWorkerProxyPath, onRequest, readPublishStatesAtEdge, resetReadStatesCacheForTests, resolveStaticReadMeta, STATIC_META } from './_middleware';
import { ARTICLE_LIVE, isReadPathPublic, isUngatedReadPath } from '../src/pages/read/articleLive';

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

describe('draft /read/ meta stays out of crawler-facing head', () => {
  // Before resolveStaticReadMeta existed, STATIC_META alone decided what a
  // /read/ path showed a crawler: this middleware injected every draft's
  // real title, description, and og:*/twitter:* tags unconditionally, so a
  // search result or a WhatsApp/iMessage/Slack preview for one of the ten
  // unpublished pieces named and described it, while the SPA itself sent
  // that same visitor to ReadNotFound. JOBC-2, prime-time audit 2026-09.
  //
  // Tests resolveStaticReadMeta directly rather than the full onRequest ->
  // HTMLRewriter path: HTMLRewriter is a Workers-runtime global with no
  // vitest polyfill, and onRequest's own tests above never exercised the
  // rewrite branch for exactly that reason. resolveStaticReadMeta is the
  // whole of the decision this bug lived in; nothing past it depends on
  // ARTICLE_LIVE.

  it('swaps a draft article route\'s meta for the not-found meta', () => {
    const meta = resolveStaticReadMeta('/read/rock-remembers');
    expect(meta?.title).not.toBe(STATIC_META['/read/rock-remembers'].title);
    expect(meta?.title).toBe('Not found · Teajia');
  });

  it('keeps a live article route\'s real meta', () => {
    const meta = resolveStaticReadMeta('/read/ritual');
    expect(meta?.title).toBe(STATIC_META['/read/ritual'].title);
  });

  it('leaves /read/leaf-to-liquor alone: not in ARTICLE_LIVE, never gated', () => {
    const meta = resolveStaticReadMeta('/read/leaf-to-liquor');
    expect(meta?.title).toBe(STATIC_META['/read/leaf-to-liquor'].title);
  });

  it('leaves /read (the index itself) alone: not in ARTICLE_LIVE, not an article', () => {
    const meta = resolveStaticReadMeta('/read');
    expect(meta?.title).toBe(STATIC_META['/read'].title);
  });

  it('agrees with ARTICLE_LIVE about every /read/ path they both carry meta for', () => {
    // The general form of the tests above: if this middleware and
    // publishGate.ts's map ever disagree about any of the fourteen curated
    // pieces, one of them is leaking a draft or hiding a live piece, and
    // this fails on that path by name.
    for (const [routePath, live] of Object.entries(ARTICLE_LIVE)) {
      const meta = resolveStaticReadMeta(routePath);
      const realTitle = STATIC_META[routePath]?.title;
      expect(realTitle, `${routePath} has no STATIC_META entry to compare against`).toBeTruthy();
      if (live) {
        expect(meta?.title, `${routePath} is live but its real title is missing`).toBe(realTitle);
      } else {
        expect(meta?.title, `${routePath} is a draft but its real title leaked into the head`).not.toBe(realTitle);
        expect(meta?.title, `${routePath} is a draft but did not get the not-found meta`).toBe('Not found · Teajia');
      }
    }
  });

  it('carries no /read entry the live map has never heard of', () => {
    // The sweep above walks ARTICLE_LIVE and asks this file about each entry,
    // which is one direction only. A key added HERE with no entry there was
    // invisible to it: adding /read/unlisted-draft to STATIC_META left all 31
    // tests green and that path still handing a crawler its full title,
    // description and og:* tags. This walks the other way.
    const unknown = Object.keys(STATIC_META).filter(
      (p) => p.startsWith('/read') && !isUngatedReadPath(p) && !Object.prototype.hasOwnProperty.call(ARTICLE_LIVE, p),
    );
    expect(
      unknown,
      'these /read paths carry crawler meta but are in neither ARTICLE_LIVE nor the named exceptions',
    ).toEqual([]);
  });

  it('fails closed for a /read path the live map does not know', () => {
    // The guard behind the sweep above. Even if a key slips into STATIC_META
    // without an entry in the live map, it gets not-found meta rather than its
    // own, so the leak needs two mistakes rather than one.
    expect(resolveStaticReadMeta('/read/never-heard-of-it')).toBeNull();
    const smuggled = { ...STATIC_META };
    expect(Object.keys(smuggled).every((p) => !p.startsWith('/read') || isReadPathPublic(p) || !ARTICLE_LIVE[p])).toBe(true);
    // The decision itself, asked directly: an unknown /read path is not public.
    expect(isReadPathPublic('/read/never-heard-of-it')).toBe(false);
  });
});

describe('a draft does not claim its own URL as canonical', () => {
  // Swapping the title and description still left the canonical link and og:url
  // pointing at the draft's own address, which tells a crawler that address is
  // the real, preferred one, and tells a share card what to link back to. So a
  // pasted draft link kept minting a share of itself even after the words on it
  // changed to "Not found". JOBC-2 round three.

  it('points a draft at the Read index instead', () => {
    const meta = resolveStaticReadMeta('/read/rock-remembers');
    expect(meta).toBeTruthy();
    expect(canonicalUrlFor(meta!, '/read/rock-remembers')).toBe('https://www.teajia.com/read');
  });

  it('leaves a live page pointing at itself', () => {
    const meta = resolveStaticReadMeta('/read/ritual');
    expect(canonicalUrlFor(meta!, '/read/ritual')).toBe('https://www.teajia.com/read/ritual');
  });

  it('leaves the homepage as the bare origin', () => {
    expect(canonicalUrlFor({ title: 't', description: 'd' }, '/')).toBe('https://www.teajia.com');
  });

  it('sends every draft to the index, and no live page anywhere but itself', () => {
    for (const [routePath, live] of Object.entries(ARTICLE_LIVE)) {
      const meta = resolveStaticReadMeta(routePath);
      const url = canonicalUrlFor(meta!, routePath);
      if (live) {
        expect(url, `${routePath} is live and should be its own canonical`).toBe(`https://www.teajia.com${routePath}`);
      } else {
        expect(url, `${routePath} is a draft but still claims its own URL as canonical`).toBe('https://www.teajia.com/read');
      }
    }
  });
});

describe('a story published or taken down from its own page', () => {
  // Migration 0030: a stored state overrides ARTICLE_LIVE in both directions,
  // and the edge must say the same thing to a crawler that the page says to a
  // visitor. No stored state, or no way to read it, leaves the map deciding.
  afterEach(() => { resetReadStatesCacheForTests(); vi.unstubAllGlobals(); });

  it('gives a draft published from the page its own meta', () => {
    expect(ARTICLE_LIVE['/read/history']).toBe(false);
    expect(resolveStaticReadMeta('/read/history')?.title).toBe('Not found · Teajia');
    const meta = resolveStaticReadMeta('/read/history', { '/read/history': 'live' });
    expect(meta?.title).toBe('Ten Thousand Mornings · Teajia');
    expect(canonicalUrlFor(meta!, '/read/history')).toBe('https://www.teajia.com/read/history');
    // No share card was drawn for it, so no picture is promised that is not there.
    expect(meta?.image).toBeUndefined();
  });

  it('gives a live story taken down from the page not-found meta', () => {
    expect(ARTICLE_LIVE['/read/porcelain-and-tea']).toBe(true);
    const meta = resolveStaticReadMeta('/read/porcelain-and-tea', { '/read/porcelain-and-tea': 'draft' });
    expect(meta?.title).toBe('Not found · Teajia');
    expect(canonicalUrlFor(meta!, '/read/porcelain-and-tea')).toBe('https://www.teajia.com/read');
  });

  it('reads the states from the worker, once per fifteen seconds', async () => {
    const upstream = vi.fn(async () => Response.json({ states: { '/read/history': 'live', '/read/x': 'nonsense' } }));
    const origin = new URL('https://worker.example');
    expect(await readPublishStatesAtEdge(origin, upstream as any, 1_000)).toEqual({ '/read/history': 'live' });
    expect(await readPublishStatesAtEdge(origin, upstream as any, 10_000)).toEqual({ '/read/history': 'live' });
    expect(upstream).toHaveBeenCalledTimes(1);
    await readPublishStatesAtEdge(origin, upstream as any, 20_000);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(String((upstream.mock.calls[0] as unknown[])[0])).toBe('https://worker.example/api/public/read/publish-state');
  });

  it('falls back to the map when the worker fails, so a live story is never hidden', async () => {
    for (const failing of [
      vi.fn(async () => new Response('down', { status: 503 })),
      vi.fn(async () => { throw new TypeError('network'); }),
      vi.fn(async () => new Response('<html>shell</html>', { headers: { 'content-type': 'text/html' } })),
    ]) {
      resetReadStatesCacheForTests();
      const states = await readPublishStatesAtEdge(new URL('https://worker.example'), failing as any);
      expect(states).toBeUndefined();
      expect(resolveStaticReadMeta('/read/porcelain-and-tea', states)?.title).toBe('Porcelain and Tea · Teajia');
      expect(resolveStaticReadMeta('/read/history', states)?.title).toBe('Not found · Teajia');
    }
  });
});

describe('Tea Atlas pages are a 404 at the edge for everyone', () => {
  it('serves the shell with a 404 status and noindex, whoever asks', async () => {
    for (const path of ['/atlas', '/atlas/', '/atlas/read/2012-02-p03-answering-some-puerh-questions', '/atlas/search?q=puerh', '/tea-atlas', '/tea-atlas/', '/tea-atlas/read/2012-02-p03-answering-some-puerh-questions', '/tea-atlas/search?q=puerh']) {
      const next = vi.fn(async () => new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } }));
      const response = await onRequest({ request: new Request(`https://www.teajia.com${path}`), env: {}, next } as any);
      expect(response.status, path).toBe(404);
      expect(response.headers.get('x-robots-tag'), path).toContain('noindex');
      expect(await response.text(), path).toBe('<html>SPA</html>');
    }
  });

  it('leaves neighbouring paths alone', async () => {
    expect(isTeaAtlasPath('/tea-atlas-other')).toBe(false);
    expect(isTeaAtlasPath('/read/atlas')).toBe(false);
    expect(isTeaAtlasPath('/atlases')).toBe(false);
  });
});
