> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md sec 5 and docs/FLOWS.md.

# Teajia Vision Audit — Index & Priority Roadmap

## Documents

| File | Focus | Key Idea |
|---|---|---|
| [Part 1: Overview](VISION_AUDIT_1_OVERVIEW.md) | Philosophy & the 3 missing layers | Teajia should be the Tea Practice OS |
| [Part 2: Shop](VISION_AUDIT_2_SHOP.md) | Discovery, product pages, post-purchase | Flavor Map, Taste Similarity, Sample Economy |
| [Part 3: Compass](VISION_AUDIT_3_COMPASS.md) | Daily practice tool | Session templates, voice pipeline, practice dashboard |
| [Part 4: Learning](VISION_AUDIT_4_LEARNING.md) | Content connected to practice | Contextual surfacing, brew-along, adaptive paths |
| [Part 5: Events](VISION_AUDIT_5_EVENTS.md) | Community & event lifecycle | Pre/during/post event flow, Tea Circles |
| [Part 6: Admin](VISION_AUDIT_6_ADMIN.md) | Adrian's daily workflow | Morning dashboard, one-click fulfill, receipt pipeline |
| [Part 7: Technical](VISION_AUDIT_7_TECHNICAL.md) | Infrastructure foundations | Unified activity stream, offline-first, search, analytics |

---

## The 3 Missing Layers (from Part 1)

1. **The Personal Timeline** — A unified "My Tea Life" feed weaving purchases, sessions, events, reading, and favorites into one chronological story
2. **The Knowledge Graph** — Contextual intelligence that surfaces the right content at the right moment based on what the user is doing
3. **The Social Layer** — Tea Circles: small private groups sharing their tea practice together

---

## Priority Roadmap

### Tier 1: High Impact, Low Effort (do first)

These use existing data and infrastructure. Mostly frontend work.

| # | Feature | From | Effort |
|---|---|---|---|
| 1 | "Continue Where You Left Off" on shop | Part 2 | 2 hrs |
| 2 | Brewing guide per product (lookup table) | Part 2 | 4 hrs |
| 3 | Reading progress tracking on Learn | Part 4 | 3 hrs |
| 4 | "Today" dashboard for admin | Part 6 | 4 hrs |
| 5 | Glossary tooltips on product pages | Part 4 | 3 hrs |
| 6 | Quick stock adjustment in inventory table | Part 6 | 2 hrs |
| 7 | New arrivals badge on products | Part 2 | 1 hr |
| 8 | Post-event purchase link emails | Part 5 | 3 hrs |
| 9 | Related articles on product pages | Part 4 | 3 hrs |
| 10 | Autocomplete tea names in Compass | Part 3 | 2 hrs |

### Tier 2: High Impact, Medium Effort (next sprint)

These require new data tables or modest backend work.

| # | Feature | From | Effort |
|---|---|---|---|
| 11 | Tasting note similarity engine | Part 2 | 1-2 days |
| 12 | Flavor Map discovery UI | Part 2 | 1-2 days |
| 13 | Session templates in Tea Compass | Part 3 | 1-2 days |
| 14 | Unified activity stream (DB + API) | Part 7 | 2-3 days |
| 15 | Service worker with Workbox | Part 7 | 1 day |
| 16 | Voice-to-structured-notes pipeline | Part 3 | 2 days |
| 17 | Receipt → Quick Capture → Shelf pipeline | Part 6 | 2-3 days |
| 18 | Community tasting aggregation on products | Part 5 | 2-3 days |
| 19 | Sample size option in shop | Part 2 | 1 day |
| 20 | Shareable tasting cards | Part 3 | 2 days |

### Tier 3: Transformative, Higher Effort (roadmap items)

These create new capabilities and require significant work.

| # | Feature | From | Effort |
|---|---|---|---|
| 21 | "Start Your Practice" guided flow | Part 2 | 3-5 days |
| 22 | Tea Circles (social layer) | Part 5 | 1-2 weeks |
| 23 | Adaptive learning paths | Part 4 | 1 week |
| 24 | Live tasting mode for events | Part 5 | 1 week |
| 25 | Content CMS migration to D1 | Part 7 | 1-2 weeks |
| 26 | Full analytics pipeline | Part 7 | 1 week |
| 27 | Practice dashboard (heat map, evolution) | Part 3 | 1 week |
| 28 | Mobile admin view | Part 6 | 1-2 weeks |
| 29 | Unified search (D1 FTS5) | Part 7 | 3-5 days |
| 30 | Personal collection tracker | Part 3 | 1 week |

---

## The One Sentence Version

Teajia has built six excellent rooms — now it needs to build the hallways between them, so that every cup logged, every article read, every event attended, and every purchase made enriches every other part of the experience.
