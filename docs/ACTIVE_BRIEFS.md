# Active Briefs — In-Progress Work

> Index of feature briefs and specs currently being built or scoped. For shipped work see CHANGELOG.md. For locked architectural decisions see ARCHITECTURE.md.

**Last updated:** 2026-05-09

## Product Architecture & Taste Preservation

- **plan/product-architecture-initiative.md** — Playback of what Teajia is, how it is being built, and where attention should go next.
- **plan/product-architecture-prd.md** — Product requirements for preserving Teajia's domain distinctions, taste, editorial authority, personal memory, and network trust.
- **plan/product-architecture-implementation.md** — Implementation plan covering domain contracts, robustness fixes, editorial engine, personal memory, network hardening, and IA.
- **plan/product-architecture-discussion-log.md** — Persistent record of the thread that produced this initiative.
- **plan/product-architecture-phase-0-inventory.md** — Current domain, route/auth, client state, and article contract inventory.
- **plan/product-architecture-route-auth-inventory.md** — Maintained route authorization map with access levels, bundle intent, applied fixes, and product-policy decisions still needed.

## Network & Multi-Store (Phase 1B)

- **NETWORK_ROLLOUT_PLAN.md** — Phase 1B master plan: profiles, listings, wholesale, cross-pollination, members & access. Primary source of truth.
- **NETWORK_UI_BRIEF.md** — Design language for network surfaces (catalog, listings, members, wholesale). Editorial register, bronze accents, card-as-editor pattern.

## Members & Access

Tier model (5 tiers + Guest) with 6 capability bundles. Account-scoped access control. Shipped Phase 1A; Phase 1B integration in progress.

- Platform-tier endpoints (platform owner operations)
- Tea Master invite and upgrade flow
- Per-account access roster with role assignments
- Bundle-based authorization infrastructure

## Compass (Tea Sourcing Tool)

- **plan/tea-compass-spec.md** — Complete spec (capture, tasting, sourcing, offline). The active working tool for tea professionals.
- **COMPASS_SOCIAL_PLAN.md** — Phase 1: tab restructure, sharing, command center (`/me`). LogoIcon navigation, floating actions repositioned.
- **plan/teajia-tasting-usage-guide.md** — Tasting taxonomy & data model (102 mood/flavor terms, session-based entry).
- **TASTING_JOURNAL_BRIEF.md** — Customer-facing journal UX (personal record, contemplative pace, bronze accents, serif typography).

## Events

- **plan/event-system-v2.md** — Event flow redesign (approval-based RSVP, flyer-first, story cards, journey system).
- **plan/event-rsvp-capacity-engine.md** — RSVP capacity engine (tiered capacity 80/20, magic links, waitlist reallocation, post-session archival).

## Magazine & Articles

- **MAGAZINE_PLAN.md** — Magazine UI spec (4:5 format, gallery frame, push transitions, canvas-to-PNG export, progress counter).
- **plan/magazine-editor-spec.md** — Admin editor (D1 articles table, Smart Paste system, block editor, hybrid authoring model).
- **ARTICLE_UNIFICATION_PLAN.md** — Unification status: Phases A–D shipped; Path C migration (5 selected articles); legacy system deprecated.

## Learn Section (Craft)

- **plan/learn-archive-redesign.md** — Learn section overhaul (renamed Craft; visual abundance, carousels, treasure-trove feeling, mobile-first discovery).

## Consult

- **plan/consult-redesign-spec.md** — Consult page redesign (question-driven, "What brings you here?", 5 path cards, inline content reveal).

## Order & Fulfillment

- **ORDER_SYSTEM_PLAN.md** — Order inquiry flow (customer request, admin confirm/adjust, payment flexibility: cash/transfer/payment-link).

## Launch & Restore

From **LAUNCH_CHECKLIST.md**:

### PREVIEW_MODE Gates
| Route | Status | To restore |
|---|---|---|
| `/community` | ComingSoonPage | Build placeholder content |
| `/for-your-space` | New B2B inquiry form | Complete |
| `/spaces` | 3 Bali locations | Seed data live |
| `/start` | 6 entry paths | Complete |
| LeftSidebar "Our spaces" link | Hidden | Remove `{\!PREVIEW_MODE}` wrapper |

**To restore everything:** set `PREVIEW_MODE = false` in `src/constants.ts`.

### Known Stub Pages
- `/account/orders` — empty state only; no order data wired
- `/account/samples` — empty state only; no sample data wired

## Open Ideas (TODO.md excerpts)

### Committed / Ready to build

- **Phase 2 — Per-section voice capture** — Section-scoped voice notes in Compass (Flavor, Feeling, Body, Finish). Metadata wire-up + NotesPanel grouping.
- **Phase 2b — Customer starring in Compass journal** — Stars on journal entries for customers; candidates for admin promotion.
- **Phase 3 — Admin community-stars review queue** — `/admin/community-impressions`; customer-starred notes grouped by product; Promote/Dismiss actions.

### Ideas — for review

- **Seed mood and flavor tags** — Walk through the full loop end-to-end: admin Inventory, tag 5–30 teas with mood/flavor, verify `/shop` filters work across moods, flavors, and multi-select combos.
- Other unresolved concepts tracked in TODO.md

---

**Maintenance:** When a brief ships, move its summary to CHANGELOG.md and remove from this index. When a new brief is created, add it here under its category.
