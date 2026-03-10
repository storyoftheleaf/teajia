# Teajia — Audit Todo Tracker

21 actionable tasks: 01–15 from the [Website Teardown](../WEBSITE_TEARDOWN.md) (frontend), 16–21 from the backend performance audit (Cloudflare Worker + D1). Organized by priority so you can tackle several in parallel.

---

## Parallel Work Groups

These tasks are independent and can be worked on simultaneously:

### Group A: Performance (no overlap)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 01 | [Tailwind PostCSS Build](./01-tailwind-postcss-build.md) | P0 | Half-day |
| 05 | [Font Optimization](./05-font-optimization.md) | P1 | 1 hour |
| 09 | [Texture Overlay Optimization](./09-texture-overlay-optimization.md) | P2 | 2 hours |
| 13 | [Scope ImagePreloader](./13-scope-image-preloader.md) | P2 | 1 hour |

### Group B: Design System Cleanup (can parallelize across files)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 06 | [rgba() Remediation (328 instances)](./06-rgba-remediation.md) | P1 | 1–2 weeks |
| 10 | [Banned Token Migration (49 files)](./10-banned-token-migration.md) | P2 | 3–5 days |
| 11 | [Z-Index Scale](./11-zindex-scale.md) | P2 | Half-day |
| 14 | [Unified Button Component](./14-unified-button-component.md) | P3 | 2–3 days |

### Group C: Product & Conversion (sequential dependency)
| # | Task | Priority | Effort | Depends On |
|---|------|----------|--------|------------|
| 03 | [Product Detail Pages](./03-product-detail-pages.md) | P0 | 2–3 days | — |
| 08 | [Homepage Product Showcase](./08-homepage-product-showcase.md) | P1 | 1 day | — |
| 04 | [Checkout Flow](./04-checkout-flow.md) | P1 | 1–2 weeks | #07 |
| 07 | [Split CartPanel](./07-split-cart-panel.md) | P1 | 2–3 days | — |
| 15 | [Trust Signals](./15-trust-signals.md) | P3 | 1 day | — |

### Group D: Architecture (independent)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 02 | [SEO Meta + Sitemap](./02-seo-meta-sitemap.md) | P0 | 1–2 weeks |
| 12 | [Lazy-Load Content](./12-lazy-load-content.md) | P2 | 1–2 days |

### Group E: Backend / Worker Performance (no frontend overlap)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 16 | [D1 Database Indexes](./16-d1-database-indexes.md) | P0 | 1 hour |
| 17 | [Cache-Control Headers](./17-cache-control-headers.md) | P0 | 1–2 hours |
| 18 | [Batch Sequential Queries](./18-batch-sequential-queries.md) | P1 | 2–3 hours |
| 19 | [SELECT * Elimination](./19-select-star-elimination.md) | P1 | Half-day |
| 20 | [Loop → Batch Operations](./20-loop-batch-operations.md) | P1 | 1–2 hours |
| 21 | [CORS Preflight Caching](./21-cors-preflight-caching.md) | P2 | 30 minutes |

---

## Priority Legend

| Priority | Meaning | Action |
|----------|---------|--------|
| **P0** | Critical — directly harms conversion, performance, or discoverability | Do first |
| **P1** | High — noticeably degrades experience | Next sprint |
| **P2** | Medium — polishes the experience | Quality pass |
| **P3** | Low — nice-to-have refinements | When time allows |

---

## Suggested Sprints

### Sprint 1: Foundation (1 week)
Work in parallel:
- **01** Tailwind PostCSS + **05** Fonts + **09** Textures + **13** ImagePreloader *(Group A — all performance, no overlap)*
- **11** Z-Index Scale *(Group B — quick win, standalone)*

### Sprint 2: Product Experience (1 week)
Work in parallel:
- **03** Product Detail Pages + **08** Homepage Showcase *(Group C — independent of each other)*
- **07** Split CartPanel *(Group C — prerequisite for #04)*

### Sprint 3: Design System (1–2 weeks)
Work in parallel:
- **06** rgba Remediation + **10** Banned Tokens *(Group B — can split files between two people)*
- **14** Unified Button Component *(Group B — can start once tokens are clean)*

### Sprint 1.5: Backend Quick Wins (can run alongside Sprint 1)
Work in parallel with Group A:
- **16** D1 Database Indexes + **21** CORS Preflight Caching *(Group E — deploy-only, no code review needed)*
- **17** Cache-Control Headers *(Group E — small worker change)*

### Sprint 2.5: Backend Deeper Fixes (can run alongside Sprint 2)
- **18** Batch Sequential Queries + **20** Loop → Batch *(Group E — refactor worker handlers)*
- **19** SELECT * Elimination *(Group E — query optimization)*

### Sprint 4: SEO & Conversion (1–2 weeks)
- **02** SEO Foundation *(Group D)*
- **04** Checkout Flow *(Group C — depends on #07 being done)*
- **15** Trust Signals *(Group C — quick add)*
- **12** Lazy-Load Content *(Group D)*

---

## Status Tracking

Mark tasks as you go:

- [ ] 01 — Tailwind PostCSS Build
- [ ] 02 — SEO Meta + Sitemap
- [ ] 03 — Product Detail Pages
- [ ] 04 — Checkout Flow
- [ ] 05 — Font Optimization
- [ ] 06 — rgba Remediation
- [ ] 07 — Split CartPanel
- [ ] 08 — Homepage Product Showcase
- [ ] 09 — Texture Overlay Optimization
- [ ] 10 — Banned Token Migration
- [ ] 11 — Z-Index Scale
- [ ] 12 — Lazy-Load Content
- [ ] 13 — Scope ImagePreloader
- [ ] 14 — Unified Button Component
- [ ] 15 — Trust Signals
- [ ] 16 — D1 Database Indexes
- [ ] 17 — Cache-Control Headers
- [ ] 18 — Batch Sequential Queries
- [ ] 19 — SELECT * Elimination
- [ ] 20 — Loop → Batch Operations
- [ ] 21 — CORS Preflight Caching
