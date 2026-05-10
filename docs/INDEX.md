# Teajia Documentation — Index

> Start here. Documentation is organized by purpose, not by type.

**Last updated:** 2026-05-10

---

## Read me first

| Doc | What | Read if |
|---|---|---|
| **VISION.md** | What Teajia is, who uses it, why it exists | New to the platform; need the philosophy |
| **ROADMAP.md** | What's being built next, by phase | Want to know what's coming |
| **STATE_OF_THE_SITE.md** | Current state: what works, what doesn't | Prioritizing work or fixing something broken |
| **CHANGELOG.md** | What shipped, by date | Need to know when something went live |
| **POST_AUDIT_ROADMAP.md** | Three-body forward plan after audit close | Picking the next project |
| **DESIGN_SYSTEM_PHASING.md** | 4-phase plan for closing finding #36 | Touching tokens, themes, or visual scales |
| **IA_REVIEW.md** | Scoping doc for the information architecture project | Considering route renames, navigation moves, or section restructuring |
| **plan/product-architecture-initiative.md** | Product architecture playback + initiative overview | Aligning product taste, architecture, and next implementation work |
| **OPERATIONAL_NOTES.md** | Intentional tradeoffs, residual risks, things to revisit | Onboarding to the codebase; before changing auth or infra |
| **STORE_LAUNCH_PLAYBOOK.md** | Public and admin routes for the web launch playbook | Onboarding any new store |
| **AUSTRALIA_LAUNCH_PLAYBOOK.md** | First-store launch checklist for Teajia Australia | Reviewing the first external launch |
| **OPENING_STOCK_CSV_GUIDE.md** | Inventory import fields and first-batch rules | Preparing or reviewing opening stock |
| **STORE_OPERATOR_DAILY_WORKFLOWS.md** | Daily operating guide for store owners and staff | Training Australia staff |
| **MEMBERS_AND_ACCESS_GUIDE.md** | Role, bundle, and invite guide | Granting staff access safely |

## For product / design

| Doc | What | Read if |
|---|---|---|
| **FLOWS.md** | End-to-end user journeys per tier | Designing features or understanding how surfaces relate |
| **SITE_MAP.md** | Every route + action, by tier | Adding a link, designing nav, checking if a page exists |
| **ACTIVE_BRIEFS.md** | Index of in-progress feature briefs | Implementing a feature; need to find its spec |
| **PLAYBOOK_SURFACE_PATTERN.md** | Reusable visual/UX pattern from the store launch playbook | Applying the new guided look to Tea Compass or other tools |
| **COLOR_RULES.md** | Design tokens, safe colors, theme contract | Writing CSS or adding a color |

## For engineering

| Doc | What | Read if |
|---|---|---|
| **ARCHITECTURE.md** | Tenancy, auth, roles, bundles, data model, frontend invariants | Touching accounts, authorization, or cross-store concerns |
| **NETWORK_ROLLOUT_PLAN.md** | Phase 1B detail: profiles, listings, wholesale, locked decisions | Building network features |
| **MULTI_STORE_PLAN.md** | Phase 1A reference (shipped) | Understanding how multi-tenancy was built |

## Strategy & briefs

- **brief/PERSONAS.md** — 10 audience personas
- **brief/OFFER_AND_STRATEGY.md** — What Teajia offers each persona
- **brief/DEVELOPMENT_PRIORITIES.md** — Ranked feature backlog
- **brief/SPRINT_APRIL_2026.md** — Sprint record

## Implementation specs

In `docs/plan/` — read directly when implementing:
- `event-system-v2.md` · `event-rsvp-capacity-engine.md` · `magazine-editor-spec.md`
- `tea-compass-spec.md` · `consult-redesign-spec.md` · `learn-archive-redesign.md`
- `teajia-tasting-usage-guide.md`
- `product-architecture-initiative.md` · `product-architecture-prd.md` · `product-architecture-implementation.md`
- `product-architecture-discussion-log.md` · `product-architecture-phase-0-inventory.md`
- `product-architecture-route-auth-inventory.md` · `customer-contact-taxonomy.md`
- `your-table-completion-plan.md`

## Audit artifacts

In `docs/_audit/`:
- `01_guest_member.md` — 98 Guest+Member flows
- `02_owner_master.md` — 127 Owner+Master actions, by bundle
- `03_platform_crosscutting.md` — 15 platform actions + 8 cross-cutting systems
- `04_doc_inventory.md` — 46-file doc census
- `05_your_table_member_level_links.md` — Your Table link/home audit by member level
- `FINDINGS.md` — 37 ranked findings (P0–P3)
- `CONSOLIDATION_PLAN.md` — execution recipe for this consolidation

## Code-area indexes

Cheap-to-load navigation files for the major code areas. Load these instead of doing fresh codebase sweeps.

- [/src/admin/INDEX.md](../src/admin/INDEX.md) — admin routes, views, components, bundle gates
- [/src/components/AccountPanel/INDEX.md](../src/components/AccountPanel/INDEX.md) — launchpad role-adaptive views, toolRegistry
- [/worker/INDEX.md](../worker/INDEX.md) — API endpoints by bundle, RPC hotspots, migrations

## Archived

In `docs/_archive/` — superseded docs kept for history. Each has a one-line stamp at the top noting where its content moved.

## Tea House Rules (kept)

- **TODO.md** — living todo
- **NETWORK_UI_BRIEF.md** — network design language
- **MAGAZINE_PLAN.md** — magazine UI
- **ORDER_SYSTEM_PLAN.md** — order inquiry flow

---

## How to maintain this

- When you ship something, add a CHANGELOG entry and remove from ROADMAP/ACTIVE_BRIEFS.
- When you start a new brief, add a pointer in ACTIVE_BRIEFS.md.
- When you supersede a doc, move it to `_archive/` with a stamp; update this index.
- When you add a new doc, add a row to one of the tables above.
