export type ReadAsset = { paths: string[]; code: string };

// These modules are embedded in the Pages Function, never in its static asset
// store. The Worker is the only authority for both publication and editor
// access. A missing/slow authority must not fall back to a bundled live map.
export async function serveReadAsset(
  request: Request,
  configuredOrigin: string | undefined,
  asset: ReadAsset | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Vary': 'Cookie, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, noarchive',
  });
  const refuse = (status: number) => new Response(null, { status, headers });
  if (!asset || !asset.paths.length || !['GET', 'HEAD'].includes(request.method)) return refuse(404);
  let origin: URL;
  try {
    origin = new URL(configuredOrigin || '');
    if (origin.protocol !== 'https:') return refuse(503);
  } catch { return refuse(503); }
  const authHeaders = new Headers();
  for (const key of ['Cookie', 'Authorization']) {
    const value = request.headers.get(key);
    if (value) authHeaders.set(key, value);
  }
  try {
    for (const path of asset.paths) {
      const url = new URL('/api/read/access', origin);
      url.searchParams.set('path', path);
      const decision = await fetcher(url.toString(), {
        headers: authHeaders, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(4000),
      });
      if (decision.status !== 204) return refuse(decision.status >= 500 ? 503 : 404);
    }
  } catch { return refuse(503); }
  headers.set('Content-Type', 'text/javascript; charset=utf-8');
  return new Response(request.method === 'HEAD' ? null : asset.code, { headers });
}
