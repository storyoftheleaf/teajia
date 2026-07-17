// Cloudflare Pages Function — same-origin media proxy (mainland-China reachability).
//
// Uploaded photos/audio live in R2 behind `media.teajia.co`. Like
// `api.teajia.com` before it (see functions/api/[[path]].ts), that hostname is
// a GFW-filterable subdomain on a different apex — the SPA loads in China but
// every uploaded image dies. Serving media from the app's OWN origin
// (`teajia.com/media/<key>`) rides the one hostname that stays reachable; the
// edge-side fetch to media.teajia.co below never crosses the firewall.
//
// The frontend rewrites `https://media.teajia.co/<key>` → `/media/<key>` at
// render time (src/lib/mediaUrl.ts); stored URLs stay canonical in D1.
//
// Objects are immutable (UUID-keyed uploads), so cache aggressively both at
// the edge and in the browser.

const MEDIA_ORIGIN = 'https://media.teajia.co';
const UPSTREAM_TIMEOUT_MS = 12_000;

function isTimeoutError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  return name === 'TimeoutError' || name === 'AbortError';
}

export const onRequest: PagesFunction = async ({ request, waitUntil }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }
  const incoming = new URL(request.url);
  const key = incoming.pathname.replace(/^\/media\//, '');
  if (!key) return new Response('Not found', { status: 404 });

  const target = `${MEDIA_ORIGIN}/${key}`;
  const cache = caches.default;
  const cacheKey = new Request(incoming.toString(), { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: { Accept: request.headers.get('Accept') ?? '*/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cf: { cacheTtl: 31536000, cacheEverything: true },
    } as RequestInit);
    if (!upstream.ok) {
      return new Response('Not found', { status: upstream.status });
    }
    const response = new Response(upstream.body, upstream);
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.delete('Set-Cookie');
    if (request.method === 'GET') {
      waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (error) {
    if (isTimeoutError(error)) {
      return Response.json(
        { error: 'The server took too long to respond. Please try again.' },
        { status: 504 },
      );
    }
    return new Response('Upstream media unreachable', { status: 502 });
  }
};
