// Dev-only: every API request made while a Tea Wisdom pilot page is open is
// answered here, so the preview never reads or writes the live shop.
import { PILOT_FIXTURES } from './fixtureProducts';

const LIST_ENDPOINTS = [
  /\/api\/products\/[^/]+\/impressions/,
  /\/api\/products\/[^/]+\/events/,
  /\/api\/events/,
  /\/api\/stories/,
];

export interface StubbedCall { method: string; path: string }

const calls: StubbedCall[] = [];
let realFetch: typeof fetch | null = null;

function stubResponse(path: string): Response {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  if (path.split('?')[0] === '/api/products/public') {
    const lots = [PILOT_FIXTURES.naka.item, PILOT_FIXTURES['type-only'].item];
    return json(lots.map(lot => ({
      id: lot.id, slug: lot.slug, product_name: lot.name, type: lot.type,
      origin_region: lot.origin, form: lot.form, status: 'Active',
      stock_grams: lot.stock_g, retail_price_per_gram_usd: lot.price_per_gram,
    })));
  }
  if (/\/api\/public\/xref\/products\//.test(path)) return json({ articles: [] });
  if (/\/api\/public\/xref\//.test(path)) return json([]);
  if (LIST_ENDPOINTS.some(pattern => pattern.test(path))) return json([]);
  return json({ error: 'Stubbed in the Tea Wisdom pilot preview' }, 404);
}

function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/__tea-reference-preview');
}

/** Installs the stub once per page load. Returns the calls answered so far. */
export function installPilotApiStub(): readonly StubbedCall[] {
  if (realFetch || typeof window === 'undefined') return calls;
  const passThrough = window.fetch.bind(window);
  realFetch = passThrough;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!/^\/preview\/wisdom-pilot(?:\/|$)/.test(window.location.pathname) || !isApiRequest(url)) return passThrough(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    calls.push({ method, path: url.pathname + url.search });
    return stubResponse(url.pathname + url.search);
  };
  return calls;
}

export function stubbedCalls(): readonly StubbedCall[] {
  return calls;
}
