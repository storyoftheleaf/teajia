# Teajia — Combined Audit Todo Tracker

Four audits, one backlog. Tasks 01–15 come from the [Website Teardown](../WEBSITE_TEARDOWN.md) (performance, design system, SEO). Tasks 21–40 come from the [Functional Audit](../FUNCTIONAL_AUDIT.md) (UX flows, friction, interactions). Tasks 41–46 come from the backend performance audit (Cloudflare Worker + D1). Tasks 47–55 come from the UI consistency audit (styling, interaction patterns, accessibility).

---

## All Tasks at a Glance

### Website Teardown (01–15)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 01 | [Tailwind PostCSS Build](./01-tailwind-postcss-build.md) | P0 | Half-day |
| 02 | [SEO Meta + Sitemap](./02-seo-meta-sitemap.md) | P0 | 1–2 weeks |
| 03 | [Product Detail Pages](./03-product-detail-pages.md) | P0 | 2–3 days |
| 04 | [Checkout Flow](./04-checkout-flow.md) | P1 | 1–2 weeks |
| 05 | [Font Optimization](./05-font-optimization.md) | P1 | 1 hour |
| 06 | [rgba() Remediation](./06-rgba-remediation.md) | P1 | 1–2 weeks |
| 07 | [Split CartPanel](./07-split-cart-panel.md) | P1 | 2–3 days |
| 08 | [Homepage Product Showcase](./08-homepage-product-showcase.md) | P1 | 1 day |
| 09 | [Texture Overlay Optimization](./09-texture-overlay-optimization.md) | P2 | 2 hours |
| 10 | [Banned Token Migration](./10-banned-token-migration.md) | P2 | 3–5 days |
| 11 | [Z-Index Scale](./11-zindex-scale.md) | P2 | Half-day |
| 12 | [Lazy-Load Content](./12-lazy-load-content.md) | P2 | 1–2 days |
| 13 | [Scope ImagePreloader](./13-scope-image-preloader.md) | P2 | 1 hour |
| 14 | [Unified Button Component](./14-unified-button-component.md) | P3 | 2–3 days |
| 15 | [Trust Signals](./15-trust-signals.md) | P3 | 1 day |

### Functional Audit (21–40)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 21 | [Product URLs (modal → route)](./21-product-urls.md) | Critical | 1–2 days |
| 22 | [Fix Dead Share Button](./22-fix-share-button.md) | Critical | 2 hours |
| 23 | [Clarify Checkout Model](./23-clarify-checkout-model.md) | Critical | Half-day |
| 24 | [Connect Newsletter Signup](./24-fix-newsletter-signup.md) | Critical | Half-day |
| 25 | [Network/Offline Indicator](./25-network-error-indicator.md) | Critical | Half-day |
| 26 | [Global Search](./26-global-search.md) | High | 2–3 days |
| 27 | [Price-Per-Gram Display](./27-price-per-gram.md) | High | Half-day |
| 28 | [View Cart Toast](./28-view-cart-toast.md) | High | 2 hours |
| 29 | [Simplify Inquiry Form](./29-simplify-inquiry-form.md) | High | Half-day |
| 30 | [Content-Type Indicators](./30-content-type-indicators.md) | High | Half-day |
| 31 | [Quantity Presets](./31-quantity-presets.md) | Medium | Half-day |
| 32 | [Product Comparison](./32-product-comparison.md) | Medium | 2–3 days |
| 33 | [Stock Level Indicators](./33-stock-indicators.md) | Medium | Half-day |
| 34 | [Carousel Indicators](./34-carousel-indicators.md) | Medium | 2 hours |
| 35 | [Sync Favorites to Account](./35-sync-favorites-to-account.md) | Medium | 1–2 days |
| 36 | [Skeleton Loading Screens](./36-skeleton-loading.md) | Polish | Half-day |
| 37 | [Theme Toggle on Mobile](./37-theme-toggle-mobile.md) | Polish | 1 hour |
| 38 | [Learn Hub Breadcrumbs](./38-learn-breadcrumbs.md) | Polish | 2 hours |
| 39 | [JWT Expiry Handling](./39-jwt-expiry-handling.md) | Polish | Half-day |
| 40 | [Populate About Page](./40-about-page.md) | Polish | 1 day |

### Backend Performance Audit (41–46)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 41 | [D1 Database Indexes](./41-d1-database-indexes.md) | P0 | 1 hour |
| 42 | [Cache-Control Headers](./42-cache-control-headers.md) | P0 | 1–2 hours |
| 43 | [Batch Sequential Queries](./43-batch-sequential-queries.md) | P1 | 2–3 hours |
| 44 | [SELECT * Elimination](./44-select-star-elimination.md) | P1 | Half-day |
| 45 | [Loop → Batch Operations](./45-loop-batch-operations.md) | P1 | 1–2 hours |
| 46 | [CORS Preflight Caching](./46-cors-preflight-caching.md) | P2 | 30 minutes |

### UI Consistency Audit (47–55)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 47 | [Standardize Border-Radius Scale](./47-standardize-border-radius.md) | Low | 1–2 hours |
| 48 | [Unify Icon Sizing System](./48-unify-icon-sizing.md) | Low | 2–3 hours |
| 49 | [Establish Text Size Hierarchy](./49-establish-text-hierarchy.md) | Low | 2–3 hours |
| 50 | [Replace Hardcoded Hex Colors](./50-replace-hardcoded-hex-colors.md) | High | 2–3 hours |
| 51 | [Standardize Focus/Hover States](./51-standardize-focus-hover-states.md) | Medium | 2–3 hours |
| 52 | [Card/Panel Recipe](./52-card-panel-recipe.md) | Medium | 2–3 hours |
| 53 | [Normalize Spacing Scale](./53-spacing-scale-consistency.md) | Low | 1–2 hours |
| 54 | [Unify Transitions](./54-unify-transitions.md) | Low | 1–2 hours |
| 55 | [Accessibility / ARIA Audit](./55-accessibility-aria-audit.md) | Medium | 2–3 hours |

---

## Overlap & Deduplication Notes

### Completed on Other Branches

5 teardown tasks were completed on feature branches not yet merged to main:

| # | Task | Completed On |
|---|------|-------------|
| 05 | Font Optimization | `claude/comprehensive-review-audit-YGUXB` |
| 08 | Homepage Product Showcase | `claude/improve-desktop-design-n1X2M` |
| 09 | Texture Overlay Optimization | `claude/improve-desktop-design-n1X2M` |
| 12 | Lazy-Load Content | `claude/comprehensive-review-audit-YGUXB` |
| 15 | Trust Signals | `claude/comprehensive-review-audit-YGUXB` |

### Cross-Audit Overlap

Some tasks across the audits address related areas. Here's how they relate:

| Teardown | Functional Audit | Relationship |
|----------|-----------------|--------------|
| 03 Product Detail Pages | 21 Product URLs | **Complementary** — 03 builds the page, 21 adds URL routing. Do 21 first or together. |
| 04 Checkout Flow | 23 Clarify Checkout Model | **Complementary** — 23 is the quick copy/framing fix, 04 is the full flow redesign. Do 23 first. |
| 07 Split CartPanel | 28 View Cart Toast | **Independent** — 07 refactors the component, 28 adds a toast. Can parallelize. |
| 08 Homepage Product Showcase | 27 Price-Per-Gram | **Independent** — different aspects of product display. |
| 15 Trust Signals | 40 About Page | **Complementary** — both build brand confidence. Can combine into one effort. |

Backend tasks (41–46) have **no overlap** with teardown or functional audit tasks — they operate entirely within `worker/src/index.ts` and D1.

UI consistency task 50 (hardcoded hex colors) complements teardown task 06 (rgba remediation) — 06 targets `rgba()` in inline styles, 50 targets hex literals in Tailwind classes. Can be done together or separately.

---

## Parallel Work Groups

### Group A — Performance (Teardown)
`01`, `05`, `09`, `13` — No overlap, all independent.

### Group B — Design System (Teardown)
`06`, `10`, `11`, `14` — Can split files between workers.

### Group C — Product & Conversion (Both audits)
`03`+`21` (product pages + URLs), `07` (split cart), `04`+`23` (checkout), `08`, `15`+`40` (trust).

### Group D — Architecture (Teardown)
`02`, `12` — Independent.

### Group E — Shop UX (Functional Audit)
`22`, `27`, `28`, `31`, `33`, `34` — All independent shop improvements.

### Group F — Content & Navigation (Functional Audit)
`26`, `29`, `30`, `37`, `38` — Independent content/nav improvements.

### Group G — Data & Accounts (Functional Audit)
`24`, `25`, `35`, `39` — Backend-touching tasks.

### Group H — Visual Polish (Functional Audit)
`32`, `36` — Independent visual enhancements.

### Group I — Backend / Worker Performance (Backend Audit)
`41`, `42`, `43`, `44`, `45`, `46` — All within the Cloudflare Worker. No frontend overlap.

### Group J — UI Consistency: Styling (Consistency Audit)
`47`, `48`, `49`, `53`, `54` — Low-priority styling normalization. All independent.

### Group K — UI Consistency: Theme & Interaction (Consistency Audit)
`50` (hex colors, related to `06`), `51` (focus/hover), `52` (card recipe). Medium-high priority.

### Group L — Accessibility (Consistency Audit)
`55` — Standalone ARIA/a11y sweep.

---

## Suggested Sprint Order

### Sprint 1: Foundation + Quick Wins (1 week)
- **Performance:** 01, 05, 09, 13 (Group A)
- **Quick UX fixes:** 22 (share button), 28 (cart toast), 23 (checkout copy), 37 (theme toggle)
- **Design cleanup:** 11 (z-index)
- **Backend quick wins:** 41 (D1 indexes), 46 (CORS preflight), 42 (Cache-Control headers) — can run alongside, deploy-only

### Sprint 2: Product Experience (1 week)
- **Product pages:** 03 + 21 (detail pages + URL routing)
- **Shop UX:** 27 ($/g), 33 (stock), 34 (carousel)
- **Cart:** 07 (split CartPanel)
- **Backend deeper:** 43 (batch queries) + 45 (loop → batch) + 44 (SELECT * elimination)

### Sprint 3: Design System (1–2 weeks)
- **Tokens:** 06 (rgba), 10 (banned tokens)
- **Components:** 14 (unified button), 36 (skeletons)
- **Content:** 30 (type indicators), 38 (breadcrumbs)

### Sprint 4: Conversion & Trust (1–2 weeks)
- **Checkout:** 04 + 23 (full flow + framing)
- **SEO:** 02
- **Trust:** 15 + 40 (signals + about page)
- **Backend:** 24 (newsletter), 25 (network), 39 (JWT)

### Sprint 5: Advanced Features
- **Search:** 26 (global search)
- **Comparison:** 32
- **Accounts:** 35 (sync favorites)
- **Forms:** 29 (simplify inquiry)
- **Lazy loading:** 12

---

## Status Key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

## Status Tracking

### Teardown (01–15)
- [x] 01 — Tailwind PostCSS Build *(done on `distribute-todos-agents`)*
- [x] 02 — SEO Meta + Sitemap *(done on `distribute-todos-agents` — Helmet + sitemap.xml)*
- [x] 03 — Product Detail Pages *(done on `distribute-todos-agents` — /shop/product/:id)*
- [x] 04 — Checkout Flow *(done on `distribute-todos-agents` — form element, confirmation step)*
- [x] 05 — Font Optimization *(done on `comprehensive-review-audit`)*
- [x] 06 — rgba Remediation *(done on `distribute-todos-agents`)*
- [x] 07 — Split CartPanel *(done on `distribute-todos-agents` — PublicCart + AdminCart)*
- [x] 08 — Homepage Product Showcase *(done on `improve-desktop-design`)*
- [x] 09 — Texture Overlay Optimization *(done on `improve-desktop-design`)*
- [x] 10 — Banned Token Migration *(done on `distribute-todos-agents` — 637 occurrences across 69 files)*
- [x] 11 — Z-Index Scale *(done on `distribute-todos-agents`)*
- [x] 12 — Lazy-Load Content *(done on `comprehensive-review-audit`)*
- [x] 13 — Scope ImagePreloader *(done on `distribute-todos-agents` — moved to Reader only)*
- [x] 14 — Unified Button Component *(done on `distribute-todos-agents` — adopted in CTAs)*
- [x] 15 — Trust Signals *(done on `comprehensive-review-audit`)*

### Functional Audit (21–40)
- [x] 21 — Product URLs *(done on `distribute-todos-agents` — useProductUrl hook)*
- [x] 22 — Fix Share Button *(done on `distribute-todos-agents`)*
- [x] 23 — Clarify Checkout Model *(done on `distribute-todos-agents` — renamed Checkout→Inquiry)*
- [x] 24 — Connect Newsletter Signup *(done on `distribute-todos-agents` — API endpoint + D1 table)*
- [x] 25 — Network/Offline Indicator *(done on `distribute-todos-agents` — NetworkStatus component)*
- [x] 26 — Global Search *(done on `distribute-todos-agents` — Cmd/Ctrl+K, fuse.js)*
- [x] 27 — Price-Per-Gram Display *(already implemented — AlcoveCard, TeaInventory list/grid, CollectionTab)*
- [x] 28 — View Cart Toast *(done on `distribute-todos-agents`)*
- [x] 29 — Simplify Inquiry Form *(done on `distribute-todos-agents` — 3 required + collapsible optional)*
- [x] 30 — Content-Type Indicators *(done on `distribute-todos-agents` — reading time estimates)*
- [x] 31 — Quantity Presets *(done on `distribute-todos-agents`)*
- [x] 32 — Product Comparison *(done on `distribute-todos-agents` — CompareView overlay)*
- [x] 33 — Stock Level Indicators *(done on `distribute-todos-agents`)*
- [x] 34 — Carousel Indicators *(done on `distribute-todos-agents`)*
- [x] 35 — Sync Favorites to Account *(done on `distribute-todos-agents` — useFavoritesSync hook)*
- [x] 36 — Skeleton Loading Screens *(done on `distribute-todos-agents` — shop + magazine variants)*
- [x] 37 — Theme Toggle on Mobile *(done on `distribute-todos-agents` — AccountPanel header)*
- [x] 38 — Learn Hub Breadcrumbs *(done on `distribute-todos-agents` — Breadcrumb component)*
- [x] 39 — JWT Expiry Handling *(done on `distribute-todos-agents` — SessionExpiredNotice)*
- [x] 40 — Populate About Page *(done on `distribute-todos-agents` — founder story, philosophy, CTA)*

### Backend Performance (41–46)
- [x] 46 — CORS Preflight Caching
- [x] 41 — D1 Database Indexes *(done on `distribute-todos-agents`)*
- [x] 42 — Cache-Control Headers *(done on `distribute-todos-agents`)*
- [x] 43 — Batch Sequential Queries *(done on `distribute-todos-agents`)*
- [x] 44 — SELECT * Elimination *(done on `distribute-todos-agents`)*
- [x] 45 — Loop → Batch Operations *(done on `distribute-todos-agents`)*

### UI Consistency Audit (47–55)
- [x] 47 — Standardize Border-Radius Scale *(done on `distribute-todos-agents`)*
- [x] 48 — Unify Icon Sizing System *(done on `distribute-todos-agents`)*
- [x] 49 — Establish Text Size Hierarchy *(done on `distribute-todos-agents`)*
- [x] 50 — Replace Hardcoded Hex Colors *(done on `distribute-todos-agents`)*
- [x] 51 — Standardize Focus/Hover States *(done on `distribute-todos-agents`)*
- [x] 52 — Card/Panel Recipe *(done on `distribute-todos-agents`)*
- [x] 53 — Normalize Spacing Scale *(done on `distribute-todos-agents`)*
- [x] 54 — Unify Transitions *(done on `distribute-todos-agents`)*
- [x] 55 — Accessibility / ARIA Audit *(done on `distribute-todos-agents`)*
