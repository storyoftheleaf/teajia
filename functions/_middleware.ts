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
//
// STATIC_META alone used to be enough to decide what a /read/* path shows a
// crawler. It is not, now that the ten drafts among these pages are gated
// from a human visitor by src/pages/read/publishGate.ts (JOBC-2): before this
// import, this file injected every draft's real title, description and og:*
// tags for any crawler or share-card scraper regardless of publish status, so
// a search result or a WhatsApp preview could name and describe an unreleased
// piece even though the SPA itself sent that same visitor to ReadNotFound.
// ARTICLE_LIVE is the single source both sides read now. It lives in
// src/pages/read/articleLive.ts rather than publishGate.ts itself: this
// function runs in the Cloudflare Pages Workers runtime, not a browser, and
// publishGate.ts pulls in React, the Zustand store and the token client
// (a localStorage read) to build its own React hook, none of which belong in
// an edge bundle that only needs one plain object. articleLive.ts carries
// nothing but that object and a pure function, so importing it here adds
// nothing else to the bundle.
import { ARTICLE_LIVE } from '../src/pages/read/articleLive';

interface Meta {
  title: string;
  description: string;
  image?: string;
  /** Serialized JSON-LD block to append to <head> (already <-escaped). */
  jsonLd?: string;
}

const SITE = 'https://www.teajia.com';
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

// Per-page meta for the hand-coded /read/* story pages. Titles/descriptions
// taken verbatim from each story component. Add a line here when a new story
// ships. Keys are the exact path (no trailing slash).
//
// Exported for functions/_middleware.test.ts, which checks this map against
// ARTICLE_LIVE for every /read/ path they share.
export const STATIC_META: Record<string, Meta> = {
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

// What a crawler gets instead of a draft's own meta, for any /read/ path
// ARTICLE_LIVE names and does not mark live. Same title and description
// src/pages/read/ReadNotFound.tsx renders for a human visitor at that same
// URL, so a search snippet or a share-card preview says the same thing the
// page itself now says, instead of naming and describing an unpublished
// piece.
const NOT_FOUND_META: Meta = {
  title: 'Not found · Teajia',
  description: 'The page you are looking for does not exist or may have been moved.',
};

/**
 * The static-page half of onRequest's meta lookup, pulled out on its own so
 * it can be unit-tested without HTMLRewriter (a Workers-runtime global with
 * no vitest polyfill; onRequest's own tests never exercised the rewrite path
 * before this file gated /read/ paths, only the earlier proxy/fail-closed
 * branches that return before reaching it).
 *
 * A /read/ path ARTICLE_LIVE names and does not mark live is a draft: this
 * swaps its real meta for the same not-found meta a human visitor's browser
 * renders there (see src/pages/read/ReadNotFound.tsx). A path STATIC_META
 * carries but ARTICLE_LIVE has never heard of, /read itself and
 * /read/leaf-to-liquor, is not one of the fourteen gated pieces and keeps
 * its own meta unconditionally, the same as publishGate.ts treats it.
 */
export function resolveStaticReadMeta(path: string): Meta | null {
  const meta = STATIC_META[path] || null;
  if (meta && Object.prototype.hasOwnProperty.call(ARTICLE_LIVE, path) && !ARTICLE_LIVE[path]) {
    return NOT_FOUND_META;
  }
  return meta;
}

interface Env { WORKER_ORIGIN?: string }

const WORKER_PROXY_PATHS = new Set([
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-authorization-server/mcp',
  '/.well-known/openid-configuration',
  // Product sitemap is generated by the Worker from D1 (public products);
  // proxying keeps it on the site origin so robots.txt can reference it.
  '/sitemap-products.xml',
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

// Media URLs are stored canonically as https://media.teajia.co/<key>, but that
// hostname no longer resolves — serve through the site's /api/media proxy
// (mirrors src/lib/mediaUrl.ts).
function absoluteMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const MEDIA_HOST_PREFIX = 'https://media.teajia.co/';
  if (url.startsWith(MEDIA_HOST_PREFIX)) {
    return `${SITE}/api/media/${url.slice(MEDIA_HOST_PREFIX.length)}`;
  }
  return url;
}

// Public product shape (PUBLIC_FIELDS whitelist from the Worker — no cost,
// margin, or vendor data ever reaches this function).
interface PublicProduct {
  id?: string;
  type?: string;
  given_name?: string;
  product_name?: string;
  year?: string | number;
  origin_country?: string;
  origin_region?: string;
  description?: string;
  lore?: string;
  image_url?: string;
  stock_grams?: number;
  retail_price_per_gram_usd?: number;
  fixed_retail_price_usd?: number;
}

async function productMeta(id: string, workerOrigin: URL, path: string): Promise<Meta | null> {
  try {
    const res = await fetch(new URL(`/api/products/public/${encodeURIComponent(id)}`, workerOrigin), {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const p = (await res.json()) as PublicProduct;
    const name = p.product_name || p.given_name;
    if (!name) return null;

    const isTeaware = p.type === 'Teaware';
    const origin = [p.origin_region, p.origin_country].filter(Boolean).join(', ');
    const description = (
      p.description || p.lore ||
      (isTeaware ? `${name} — teaware from Teajia.` : `${name} — ${p.type || ''} tea${origin ? ` from ${origin}` : ''}, curated by Teajia.`)
    ).slice(0, 300);
    const image = absoluteMediaUrl(p.image_url);
    const soldOut = (p.stock_grams ?? 0) <= 0;
    // Tea is priced per gram (50 g reference serving); teaware per unit.
    const price = p.fixed_retail_price_usd != null && p.fixed_retail_price_usd > 0
      ? p.fixed_retail_price_usd
      : (p.retail_price_per_gram_usd || 0) * 50;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      ...(image && { image }),
      brand: { '@type': 'Brand', name: 'Teajia' },
      category: isTeaware ? 'Teaware' : `${p.type || ''} Tea`.trim(),
      ...(p.origin_country && { countryOfOrigin: { '@type': 'Country', name: p.origin_country } }),
      offers: {
        '@type': 'Offer',
        price: price.toFixed(2),
        priceCurrency: 'USD',
        availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'Teajia' },
        url: `${SITE}${path}`,
      },
    };

    return {
      title: `${name} · Teajia`,
      description,
      image,
      // Escape every "<" (unicode-escaped) so content can never close the
      // script element early.
      jsonLd: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
    };
  } catch {
    return null;
  }
}

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

  let meta: Meta | null = resolveStaticReadMeta(path);

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

  // Product pages — same crawler-only pattern as articles, plus a
  // Product+Offer JSON-LD block. Public-safe fields only (the Worker endpoint
  // whitelists them). Humans get the SPA; ProductPage renders the same meta
  // client-side via Helmet.
  if (!meta && path.startsWith('/shop/product/')) {
    const ua = request.headers.get('user-agent') || '';
    if (CRAWLER_RE.test(ua)) {
      const workerOrigin = configuredWorkerOrigin(context.env.WORKER_ORIGIN);
      if (!workerOrigin) return Response.json({ error: 'API upstream is not configured.' }, { status: 503 });
      const id = decodeURIComponent(path.slice('/shop/product/'.length));
      meta = await productMeta(id, workerOrigin, path);
    }
  }

  // Nothing to inject — serve the SPA shell unchanged.
  if (!meta) return next();

  const response = await next();
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  const rw = new HeadRewriter(meta, path);
  const jsonLd = meta.jsonLd;
  let rewriter = new HTMLRewriter()
    .on('title', rw)
    .on('meta', rw)
    .on('link', rw);
  if (jsonLd) {
    rewriter = rewriter.on('head', {
      element(el) {
        el.append(`<script type="application/ld+json">${jsonLd}</script>`, { html: true });
      },
    });
  }
  return rewriter.transform(response);
};
