# Teajia — Audit Todo Tracker

10 remaining tasks from the original 15-item [Website Teardown](../WEBSITE_TEARDOWN.md) audit. Reorganized after deduplicating against work completed on other branches.

---

## Completed on Other Branches (Removed)

These 5 tasks were completed on other feature branches and removed from this tracker:

| Original # | Task | Completed On |
|------------|------|-------------|
| 05 | Font Optimization | `claude/comprehensive-review-audit-YGUXB` |
| 08 | Homepage Product Showcase | `claude/improve-desktop-design-n1X2M` |
| 09 | Texture Overlay Optimization | `claude/improve-desktop-design-n1X2M` |
| 12 | Lazy-Load Content | `claude/comprehensive-review-audit-YGUXB` |
| 15 | Trust Signals | `claude/comprehensive-review-audit-YGUXB` |

---

## Parallel Work Groups

These tasks are independent and can be worked on simultaneously:

### Group A: Performance
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 01 | [Tailwind PostCSS Build](./01-tailwind-postcss-build.md) | P0 | Half-day |
| 09 | [Scope ImagePreloader](./09-scope-image-preloader.md) | P2 | 1 hour |

### Group B: Design System Cleanup
| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 05 | [rgba() Remediation (328 instances)](./05-rgba-remediation.md) | P1 | 1–2 weeks | Not started |
| 07 | [Banned Token Migration (49 files)](./07-banned-token-migration.md) | P2 | 3–5 days | Partial (design plan exists) |
| 08 | [Z-Index Scale](./08-zindex-scale.md) | P2 | Half-day | Not started |
| 10 | [Unified Button Component](./10-unified-button-component.md) | P3 | 2–3 days | Not started |

### Group C: Product & Conversion
| # | Task | Priority | Effort | Depends On |
|---|------|----------|--------|------------|
| 03 | [Product Detail Pages](./03-product-detail-pages.md) | P0 | 2–3 days | — |
| 04 | [Checkout Flow](./04-checkout-flow.md) | P1 | 1–2 weeks | #06 |
| 06 | [Split CartPanel](./06-split-cart-panel.md) | P1 | 2–3 days | — |

### Group D: Architecture
| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 02 | [SEO Meta + Sitemap](./02-seo-meta-sitemap.md) | P0 | 1 week | Partial (meta tags done, sitemap remaining) |

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

### Sprint 1: Foundation
Work in parallel:
- **01** Tailwind PostCSS Build + **09** Scope ImagePreloader *(Group A — performance, no overlap)*
- **08** Z-Index Scale *(Group B — quick win, standalone)*

### Sprint 2: Product Experience
Work in parallel:
- **03** Product Detail Pages *(Group C — independent)*
- **06** Split CartPanel *(Group C — prerequisite for #04)*

### Sprint 3: Design System
Work in parallel:
- **05** rgba Remediation + **07** Banned Tokens *(Group B — can split files)*
- **10** Unified Button Component *(Group B — can start once tokens are clean)*

### Sprint 4: SEO & Conversion
- **02** SEO Foundation — sitemap + structured data *(Group D)*
- **04** Checkout Flow *(Group C — depends on #06 being done)*

---

## Status Tracking

- [ ] 01 — Tailwind PostCSS Build
- [ ] 02 — SEO Meta + Sitemap *(partial — meta tags done)*
- [ ] 03 — Product Detail Pages
- [ ] 04 — Checkout Flow
- [ ] 05 — rgba Remediation
- [ ] 06 — Split CartPanel
- [ ] 07 — Banned Token Migration *(partial — design plan exists)*
- [ ] 08 — Z-Index Scale
- [ ] 09 — Scope ImagePreloader
- [ ] 10 — Unified Button Component
