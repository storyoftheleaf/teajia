// Edge SEO meta injection — Cloudflare Pages Function.
//
// The Teajia app is a React SPA: crawlers and link-preview scrapers (WhatsApp,
// iMessage, Facebook, X, Slack, Discord, Google) fetch a URL and get the empty
// index.html shell with only the homepage's meta. This middleware runs at the
// edge BEFORE the shell is returned, looks up per-page meta, and rewrites the
// <head> so shared links and search results carry the right title, description,
// and preview image.
//
// Two sources of truth:
//   - /read/*  -> STATIC_META below (the hand-coded magazine pages).
//   - /article/:slug -> live fetch from the Worker API (DB-backed articles),
//     done only for known crawler user-agents to keep human page loads fast.
//
// Humans still get the normal SPA + client-side Helmet title updates; this only
// changes the first HTML response, which is all a scraper ever reads.

interface Meta {
  title: string;
  description: string;
  image?: string;
}

const SITE = 'https://www.teajia.com';
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

// Per-page meta for the hand-coded /read/* story pages. Titles/descriptions
// taken verbatim from each story component. Add a line here when a new story
// ships. Keys are the exact path (no trailing slash).
const STATIC_META: Record<string, Meta> = {
  '/read': {
    title: 'The Art of Tea · Read · Teajia',
    description: 'An editorial reading room for the world of tea: interviews, visual stories, and field notes.',
  },
  '/read/porcelain-and-tea': {
    title: 'Porcelain and Tea · Teajia',
    description: 'A porcelain restorer on repair, patience, and how mending what we love mends us in return.',
  },
  '/read/leaf-to-liquor': {
    title: 'From Leaf to Liquor · Teajia',
    description: 'How a single leaf becomes the six colours of tea, and why the craft turns on knowing when to stop.',
  },
  '/read/rock-remembers': {
    title: 'The Rock Remembers · Teajia',
    description: 'A Wuyi rock-tea roaster on fire, patience, and lineage.',
  },
  '/read/earth-water-fire': {
    title: 'Earth, Water, Fire · Teajia',
    description: 'A Jingdezhen potter on the vessels that hold the tea.',
  },
  '/read/before-the-mist': {
    title: 'Before the Mist Burns Away · Teajia',
    description: 'A photo essay from a Yunnan spring harvest, from first grey light to first cup.',
  },
  '/read/atlas': {
    title: 'A Map of Mountains · Teajia',
    description: 'An interactive terroir atlas of the great tea mountains of China.',
  },
  '/read/craft': {
    title: 'The Pot That Remembers · Teajia',
    description: 'A Yixing zisha teapot essay: the clay, the seasoning, and the patina of years.',
  },
  '/read/essay': {
    title: 'The Long Way to the Cup · Teajia',
    description: 'A personal essay on growing up surrounded by tea without tasting it, and the journey that brought it home.',
  },
  '/read/field-notes': {
    title: 'Two Rooms in Bali · Teajia',
    description: 'Two tea rooms in the hills above Ubud: one dark as a drum, one open to the sky.',
  },
  '/read/field-study': {
    title: 'The Water Before the Leaf · Teajia',
    description: "Lu Yu's forgotten half: water hardness, temperature, and the classical ranking of sources.",
  },
  '/read/history': {
    title: 'Ten Thousand Mornings · Teajia',
    description: 'Five thousand years of tea history, told along a horizontal ink spine.',
  },
  '/read/legend': {
    title: "The Immortals' Cliff · Teajia",
    description: 'The Da Hong Pao mother trees of Wuyi: six bushes, a red robe, and a retirement.',
  },
  '/read/ritual': {
    title: 'Seven Steeps · Teajia',
    description: 'Gongfu cha, told as you scroll: a single handful of leaves brewed again and again.',
  },
  '/read/tasting': {
    title: 'The Vocabulary of Taste · Teajia',
    description: 'A radial flavour wheel and a switchable tasting radar.',
  },
  '/read/tea-house': {
    title: 'Quiet Hours · Teajia',
    description: 'How a homesick cup and reclaimed timber became a tea house at the far end of the world.',
  },
};

interface Env { WORKER_ORIGIN?: string }

const WORKER_PROXY_PATHS = new Set([
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-authorization-server/mcp',
  '/.well-known/openid-configuration',
]);

export function isWorkerProxyPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/') ||
    pathname.startsWith('/oauth/') || WORKER_PROXY_PATHS.has(pathname);
}

export async function proxyToWorker(request: Request, configuredOrigin?: string): Promise<Response> {
  const workerOrigin = configuredWorkerOrigin(configuredOrigin);
  if (!workerOrigin) {
    return Response.json({ error: 'API upstream is not configured.' }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, workerOrigin);
  try {
    const headers = new Headers(request.headers);
    // Never forward a client-supplied value: only Pages establishes the public
    // origin that OAuth discovery metadata is allowed to advertise.
    headers.set('X-Teajia-Public-Origin', incoming.origin);
    const proxied = new Request(new Request(target.toString(), request), { headers });
    return await fetch(proxied, { redirect: 'manual' });
  } catch {
    return Response.json({ error: 'Upstream API unreachable. Please try again.' }, { status: 502 });
  }
}

function configuredWorkerOrigin(value?: string): URL | null {
  try {
    const origin = new URL(value || '');
    return origin.protocol === 'https:' ? origin : null;
  } catch { return null; }
}

// User-agents we always inject for (link-preview scrapers + search crawlers).
const CRAWLER_RE =
  /(facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|googlebot|bingbot|applebot|google-inspectiontool|redditbot|skypeuripreview|ia_archiver|embedly|quora link preview|vkshare|w3c_validator)/i;

async function articleMeta(slug: string, workerOrigin: URL): Promise<Meta | null> {
  try {
    const res = await fetch(new URL(`/api/articles/${encodeURIComponent(slug)}`, workerOrigin), {
      headers: { 'X-Teajia-Account': 'acc_teajia_bali' },
      // short timeout via AbortSignal so a slow API never blocks the page
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const a = (await res.json()) as { title?: string; subtitle?: string; cover_image_url?: string };
    if (!a?.title) return null;
    return {
      title: `${a.title} · Teajia`,
      description: a.subtitle || 'An editorial story from Teajia.',
      image: a.cover_image_url || undefined,
    };
  } catch {
    return null;
  }
}

class HeadRewriter {
  constructor(private meta: Meta, private path: string) {}
  // Overwrite the existing tags in place rather than appending duplicates.
  element(el: Element) {
    const tag = el.tagName;
    const m = this.meta;
    const img = m.image || DEFAULT_IMAGE;
    if (tag === 'title') {
      el.setInnerContent(m.title);
    } else if (tag === 'link') {
      // index.html ships one canonical pointing at the homepage; repoint it.
      if (el.getAttribute('rel') === 'canonical') {
        el.setAttribute('href', `${SITE}${this.path === '/' ? '' : this.path}`);
      }
    } else if (tag === 'meta') {
      const prop = el.getAttribute('property');
      const name = el.getAttribute('name');
      if (prop === 'og:title' || name === 'twitter:title') el.setAttribute('content', m.title);
      else if (prop === 'og:description' || name === 'description' || name === 'twitter:description')
        el.setAttribute('content', m.description);
      else if (prop === 'og:image' || name === 'twitter:image') el.setAttribute('content', img);
      else if (prop === 'og:url') el.setAttribute('content', `${SITE}${this.path === '/' ? '' : this.path}`);
    }
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  // These protocol endpoints must reach the Worker before the SPA fallback.
  if (isWorkerProxyPath(url.pathname)) return proxyToWorker(request, context.env.WORKER_ORIGIN);
  // Normalize trailing slashes but keep "/" as the homepage (not "/read").
  const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');

  // Only consider GET navigations to HTML; let assets/api pass straight through.
  if (request.method !== 'GET') return next();

  let meta: Meta | null = STATIC_META[path] || null;

  // Dynamic DB-backed article — only pay the API call for crawlers.
  if (!meta && path.startsWith('/article/')) {
    const ua = request.headers.get('user-agent') || '';
    if (CRAWLER_RE.test(ua)) {
      const workerOrigin = configuredWorkerOrigin(context.env.WORKER_ORIGIN);
      if (!workerOrigin) return Response.json({ error: 'API upstream is not configured.' }, { status: 503 });
      const slug = path.slice('/article/'.length);
      meta = await articleMeta(slug, workerOrigin);
    }
  }

  // Nothing to inject — serve the SPA shell unchanged.
  if (!meta) return next();

  const response = await next();
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  const rw = new HeadRewriter(meta, path);
  return new HTMLRewriter()
    .on('title', rw)
    .on('meta', rw)
    .on('link', rw)
    .transform(response);
};
