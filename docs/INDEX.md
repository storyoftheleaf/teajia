# Teajia Documentation — Index

> Start here. Documentation is organized by purpose, not by type.

**Last updated:** 2026-07-11 (July consolidation: 57 planning docs collapsed into one direction + 9 build tracks)

---

## The plan (start here)

| Doc | What | Read if |
|---|---|---|
| **CONSOLIDATED_DIRECTION.md** | The single directional list. 9 tracks, what's shipped vs open, drift check, doc-disposition table | You want the whole picture in one sitting |
| **tracks/** | One working build queue per track. Ordered checkboxes, real file refs, done-when criteria | You're picking up work and want a checklist to run down |
| **CHANGELOG.md** | What shipped, by date | Need to know when something went live |

The nine tracks:

| # | Track | Build items |
|---|---|---|
| 01 | [Launch Integrity](tracks/01-launch-integrity.md) — bugs a first user hits | 9 |
| 02 | [First Operator & Trusted Users](tracks/02-first-operator-and-users.md) — put someone in the network | 4 |
| 03 | [Read & the Editorial Engine](tracks/03-read-editorial-engine.md) — content + contributors | 12 |
| 04 | [China Reachability](tracks/04-china-reachability.md) — works where the tea is | 8 |
| 05 | [Curate & Personal Tea Memory](tracks/05-curate-tea-memory.md) — sourcing + the member's record | 10 |
| 06 | [Commerce in the Inquiry Model](tracks/06-commerce-inquiry-model.md) — WhatsApp checkout, invoice lifecycle | 2 |
| 07 | [Events & Gatherings](tracks/07-events-gatherings.md) — invite, gather, remember | 6 |
| 08 | [Platform Hardening](tracks/08-platform-hardening.md) — worker, MCP, architecture | 17 |
| 09 | [Coherence & IA Finishing](tracks/09-coherence-ia-finishing.md) — personal routing, mental model, homepage | 4 |

---

## Orientation

| Doc | What | Read if |
|---|---|---|
| **VISION.md** | What Teajia is, who uses it, why it exists | New to the platform; need the philosophy |
| **STATE_OF_THE_SITE.md** | Concise, verified snapshot of what works and what remains | Getting the lay of the land |
| **OPERATIONAL_NOTES.md** | Intentional tradeoffs, residual risks, things to revisit | Onboarding; before changing auth or infra |

## Live audits & active contracts

| Doc | What | Read if |
|---|---|---|
| **AUDIT_2026-07_READ_CURATE_CHINA.md** | July audit: Read, Curate, and China reachability findings (feeds Tracks 1 + 4) | Working those tracks; close findings as you fix them |
| **STRUCTURAL_AUDIT_2026-06-10.md** | Worker/tenancy hardening checklist (feeds Track 8) | Working platform hardening |
| **UI_CONSISTENCY.md** | Visual contract: button / corner-radius / input rules + lint enforcement | Touching buttons, radii, or form inputs |

## For product / design

| Doc | What | Read if |
|---|---|---|
| **FLOWS.md** | End-to-end user journeys per tier | Designing features or understanding how surfaces relate |
| **SITE_MAP.md** | Every route + action, by tier | Adding a link, designing nav, checking if a page exists |
| **TEA_DISCOVERY.md** | Onboarding profile flow + how the Tea Profile connects to every surface | Touching discovery or wiring recommendations |
| **COLOR_RULES.md** | Design tokens, safe colors, theme contract | Writing CSS or adding a color |
| **DESIGN_SYSTEM.md** / **DESIGN_WORKFLOW.md** | Design system reference + how design work flows | Design work of any kind |
| **PLAYBOOK_SURFACE_PATTERN.md** | Reusable guided-surface visual/UX pattern | Applying the guided look to a tool |
| **MAGAZINE_PLAN.md** / **MAGAZINE_WRITING_SURFACE_SPEC.md** | Locked magazine design decisions + the writing surface spec | Touching the reader or the editor (Track 3) |
| **NETWORK_UI_BRIEF.md** | Network design language for the unbuilt store-network surfaces | Building network UI (Track 2) |
| **CONTRIBUTOR_PROFILES_PLAN.md** | Contributor profile spec | Building the contributor layer (Track 3) |

## For engineering

| Doc | What | Read if |
|---|---|---|
| **ARCHITECTURE.md** | Tenancy, auth, roles, bundles, data model, frontend invariants | Touching accounts, authorization, or cross-store concerns |
| **MULTI_STORE_PLAN.md** | Multi-tenancy + stock spine implementation reference | Understanding how multi-store was built (Track 2) |

## Operator / launch playbooks

- **STORE_LAUNCH_PLAYBOOK.md** — public + admin routes for launching any store
- **AUSTRALIA_LAUNCH_PLAYBOOK.md** — first-store launch checklist (the Track 2 checklist, still to run)
- **OPENING_STOCK_CSV_GUIDE.md** — inventory import fields and first-batch rules
- **STORE_OPERATOR_DAILY_WORKFLOWS.md** — daily operating guide for owners and staff
- **MEMBERS_AND_ACCESS_GUIDE.md** — role, bundle, and invite guide

## Strategy & briefs

- **brief/PERSONAS.md** — audience personas (audience ground truth)
- **brief/OFFER_AND_STRATEGY.md** — what Teajia offers each persona

## Implementation specs

In `docs/plan/` — read directly when implementing:
- `event-system-v2.md` — canonical event spec (Track 7)
- `magazine-editor-spec.md` — editor AI layer + template dropdown (Track 3)
- `customer-contact-taxonomy.md` — relationship model reference (Track 8)
- `product-architecture-phase-0-inventory.md` · `product-architecture-route-auth-inventory.md` — live domain/route/auth inventories (Track 8)
- `teajia-tasting-usage-guide.md` — tasting taxonomy usage

## Audit artifacts

In `docs/_audit/` — the April 2026 flow audit that seeded much of this:
- `01_guest_member.md` · `02_owner_master.md` · `03_platform_crosscutting.md` · `04_doc_inventory.md` · `05_your_table_member_level_links.md`
- `FINDINGS.md` — 37 ranked findings (P0–P3) · `CONSOLIDATION_PLAN.md`

## Code-area indexes

Cheap-to-load navigation files for the major code areas. Load these instead of doing fresh codebase sweeps.

- [/src/admin/INDEX.md](../src/admin/INDEX.md) — admin routes, views, components, bundle gates
- [/src/components/AccountPanel/INDEX.md](../src/components/AccountPanel/INDEX.md) — launchpad role-adaptive views, toolRegistry
- [/worker/INDEX.md](../worker/INDEX.md) — API endpoints by bundle, RPC hotspots, migrations

## Archived

- `docs/_archive/consolidated-2026-07/` — the 37 planning docs folded into the tracks on 2026-07-11. See the README there and the disposition table in CONSOLIDATED_DIRECTION.md.
- `docs/_archive/session-artifacts-2026-07/` — retired root TODOs, handoffs, run logs, and the superseded article-template plan.
- `docs/_archive/` — older superseded docs kept for history.

---

## How to maintain this

- Work from `tracks/`. When you finish a build item, check its box and add a CHANGELOG entry.
- When a whole track's queue is empty, note it in CONSOLIDATED_DIRECTION.md.
- When a plan doc no longer matches what's on main, archive it (move to `_archive/` with a stamp) rather than annotating it. That drift is what the July consolidation cleaned up; don't let it rebuild.
- When you add a new doc, add a row to one of the tables above.
