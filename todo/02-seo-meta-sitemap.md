# TODO 02: Add SEO Foundation — Meta Tags, Sitemap, Structured Data

> **Branch progress:** Meta tags (canonical, og:, twitter:), robots.txt, favicon, and security headers done on `claude/comprehensive-review-audit-YGUXB`. Remaining: sitemap.xml generation, structured data (JSON-LD), per-route Helmet tags.

**Priority:** P0 — CRITICAL
**Impact:** Discoverability, organic traffic, social sharing
**Effort:** High (1–2 weeks)
**Category:** SEO / Structure

---

## Problem

As a client-side SPA with no SSR, Teajia is effectively invisible to search engines:

- Search engines see an empty `<div id="root">` until JavaScript loads
- No `<meta>` description per route — only a single tag in `index.html`
- No structured data (JSON-LD) for products, articles, or business info
- No `sitemap.xml` — only `robots.txt` exists
- No canonical URLs — hash-based tab state creates duplicate content signals
- No Open Graph or Twitter Card meta tags for social sharing

## Scope

### Phase A: Per-Route Meta Tags (2–3 days)
- Install `react-helmet-async`
- Add `<Helmet>` to every page component with unique title, description, og:image
- Pages: Home, Magazine, Learn, Shop, Consult, About, Product Detail (if #03 done)

### Phase B: Sitemap Generator (1 day)
- Create `public/sitemap.xml` (static) or build-time generated
- Include all public routes: `/`, `/magazine`, `/learn`, `/shop`, `/consult`, `/about`
- If product detail pages exist (#03), include `/shop/:slug` for each product
- Update `robots.txt` to reference sitemap

### Phase C: Structured Data (2–3 days)
- Add JSON-LD `Organization` schema on homepage
- Add JSON-LD `Product` schema on product pages (requires #03)
- Add JSON-LD `Article` schema on magazine articles
- Add JSON-LD `BreadcrumbList` for navigation

### Phase D: Pre-rendering or SSR (1 week, optional)
- Options: Remix migration (Cloudflare-native), `vite-plugin-ssr`, or static pre-rendering
- At minimum: use a prerender service or Cloudflare Workers to serve meta tags for crawlers

## Files to Create/Modify

- `package.json` — Add `react-helmet-async`
- `src/index.tsx` — Wrap app in `<HelmetProvider>`
- `src/components/HomePage.tsx` — Add `<Helmet>`
- `src/components/Shop.tsx` — Add `<Helmet>`
- `src/components/MagazineTabbed.tsx` — Add `<Helmet>`
- `src/components/LearnHub.tsx` — Add `<Helmet>`
- `src/components/ConsultPage.tsx` — Add `<Helmet>`
- `src/pages/AboutPage.tsx` — Add `<Helmet>`
- `public/sitemap.xml` — New
- `public/robots.txt` — Update with sitemap URL

## Verification

- View page source shows correct `<title>` and `<meta>` per route
- Social share previews (Facebook debugger, Twitter card validator) show correct data
- Google Search Console validates sitemap
- Lighthouse SEO score improves

## Related Issues

- #03 (product detail pages — needed for product-level SEO)
