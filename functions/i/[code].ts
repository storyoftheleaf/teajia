// The short invoice link, teajia.com/i/TJB-00007-c6c1e92016bf (Adrian, 2026-11-27).
//
// Asks the Worker which long pay link the code stands for and redirects there,
// so the customer lands on the same pay page an old long link opens. The amount
// is what the invoice owes now. A code that matches nothing falls through to
// the app, which shows its own not-found page.

interface Env { WORKER_ORIGIN?: string }

const UPSTREAM_TIMEOUT_MS = 8_000;

function invoiceLinkTarget(body: unknown, requestUrl: string): string | null {
  const path = (body as { path?: unknown } | null)?.path;
  if (typeof path !== 'string' || !path.startsWith('/people/') || path.startsWith('//')) return null;
  return new URL(path, requestUrl).toString();
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params, next }) => {
  const code = Array.isArray(params.code) ? params.code.join('/') : String(params.code ?? '');
  let workerOrigin: URL;
  try {
    workerOrigin = new URL(env.WORKER_ORIGIN || '');
    if (workerOrigin.protocol !== 'https:') return next();
  } catch { return next(); }
  try {
    // The visitor's own headers travel with the lookup, as the /api proxy
    // sends them, so the worker's per-address limit counts this visitor.
    const lookup = new URL(`/api/public/invoice-links/${encodeURIComponent(code)}`, workerOrigin);
    const upstream = await fetch(new Request(lookup.toString(), { headers: request.headers }), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return next();
    const target = invoiceLinkTarget(await upstream.json(), request.url);
    if (!target) return next();
    return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } });
  } catch {
    return next();
  }
};
