# Teajia documentation: index

> Start here. This index routes to current truth; historical audits and session artifacts are not active work sources.

**Last updated:** 2026-11-25

## Start here

| Document | Authority |
|---|---|
| [plans/README.md](plans/README.md) | **Every plan in one folder (2026-11-27):** links to all repo docs, plus copies of the plans that lived only on Adrian's Mac and the project's shared notes. Point ChatGPT or any reader here |
| [PILLAR.md](PILLAR.md) | What the site is and how it works, in one read; the file every session is pointed at first |
| [STATE_OF_THE_SITE.md](STATE_OF_THE_SITE.md) | Snapshot verified 2026-08-10 (marked stale 2026-11-25; PILLAR is current) |
| [agents/TEA-SYSTEM-MAP.md](agents/TEA-SYSTEM-MAP.md) | **The tea system, end to end (2026-11-27):** the ten steps from finding a tea to after the cup, where each is done, its agent tools, its owner doc, and what is missing between them. Has a whiteboard twin |
| [SECTIONS.md](SECTIONS.md) | **Proposed section overhaul (2026-11-25):** the four words, the Tea Table, Your Table, Tea Houses, the route map, the rule change and the build order. A proposal until Adrian says yes |
| [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md) | The single directional list: every plan filed under its section, with status and next step, and what is still only on Adrian's Mac |
| [VERIFIED_RELEASES.md](VERIFIED_RELEASES.md) | Worker-first background publishing and exact-revision live proof |
| [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md) | **Only canonical checklist for Adrian, operator, editorial, deployed-environment, and other external validation** |
| [CHANGELOG.md](CHANGELOG.md) | Dated implementation history |
| [VISION.md](VISION.md) | Product philosophy, audience, and boundaries |

The launch-to-real-use implementation spec is
[`superpowers/specs/2026-07-12-launch-to-real-use-program-design.md`](superpowers/specs/2026-07-12-launch-to-real-use-program-design.md).
It records the locally verified Releases 1 to 3. It is an implementation record, not a second launch checklist.

## Section plans (proposed 2026-11-25)

| Plan | Section |
|---|---|
| [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md) | The centre of the overhaul: guests, hosts, the loop, six functions, what each person gets |
| [guests-and-tea-masters-build.md](../todo/plans/guests-and-tea-masters-build.md) | The build: five launches, work packages, tiers, gates, and how a multi-agent build is run |
| [tea-table.md](../todo/plans/tea-table.md) | The Tea Table: what people put on the table, with Sessions and People |
| [your-table.md](../todo/plans/your-table.md) | Your Table: the person's own table as a real page |
| [tea-houses.md](../todo/plans/tea-houses.md) | Tea Houses: building them as an offering, the houses built, the houses to visit |

Every other plan in `todo/plans/` and `docs/` is filed by section in [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md). Documents marked stale carry a banner under their title that says what to read instead.

## Active engineering tracks

Only three engineering queues remain active. Human, operator, editorial, and deployed-environment work is not a fourth queue; it lives only in [Launch Validation](LAUNCH_VALIDATION.md).

| # | Track | Current job |
|---|---|---|
| 01 | [Launch Integrity](tracks/01-launch-integrity.md) | Close the reading-memory/saved-story discrepancy; keep launch behavior trustworthy |
| 05 | [Product & Curate Integrity](tracks/05-curate-tea-memory.md) | Keep sourcing, member tea memory, and first-operator product loops coherent |
| 08 | [Platform Hardening](tracks/08-platform-hardening.md) | Await one explicit Sources/Personal navigation approval; shipped hardening is in the changelog |

## Product and design references

| Document | Use |
|---|---|
| [FLOWS.md](FLOWS.md) | End-to-end user journeys (marked stale 2026-11-25) |
| [SITE_MAP.md](SITE_MAP.md) | Route and action map (marked partly stale 2026-11-25) |
| [TEA_DISCOVERY.md](TEA_DISCOVERY.md) | Discovery-profile behavior and integration |
| [COLOR_RULES.md](COLOR_RULES.md) | Mandatory color and styling rules |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Canonical visual system |
| [Shop listing hierarchy](design/catalog-listing-hierarchy.md) and [field guide](design/catalog-listing-field-guide.md) | Approved tea and teaware reading order, sources and empty states |
| [UI_CONSISTENCY.md](UI_CONSISTENCY.md) | Lint-enforced UI consistency contract |

## Engineering references

| Document | Use |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tenancy, authorization, data model, and frontend invariants |
| [MULTI_STORE_PLAN.md](MULTI_STORE_PLAN.md) | Shipped multi-store and stock-spine implementation context |
| [OPERATIONAL_NOTES.md](OPERATIONAL_NOTES.md) | Intentional tradeoffs and revisit triggers |
| [src/admin/INDEX.md](../src/admin/INDEX.md) | Admin code-area map |
| [src/components/AccountPanel/INDEX.md](../src/components/AccountPanel/INDEX.md) | Account-panel code-area map |
| [worker/INDEX.md](../worker/INDEX.md) | Worker routes and migration hotspots |

## Operator procedure guides

These explain how to perform operating tasks. They do not track whether launch obligations are complete; that status belongs only in [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md).

- [AUSTRALIA_LAUNCH_PLAYBOOK.md](AUSTRALIA_LAUNCH_PLAYBOOK.md)
- [OPENING_STOCK_CSV_GUIDE.md](OPENING_STOCK_CSV_GUIDE.md)
- [PURCHASE_LOGISTICS.md](PURCHASE_LOGISTICS.md)
- [STORE_OPERATOR_DAILY_WORKFLOWS.md](STORE_OPERATOR_DAILY_WORKFLOWS.md)
- [MEMBERS_AND_ACCESS_GUIDE.md](MEMBERS_AND_ACCESS_GUIDE.md)

## Maintenance contract

- Implementation work belongs in one of the three active tracks.
- Human, deployed-environment, editorial, and optional decision status belongs only in `LAUNCH_VALIDATION.md`.
- Shipped work gets a dated `CHANGELOG.md` entry.
- Reference docs describe current behavior; they do not carry independent roadmaps or launch checklists.
- A stale plan is retired instead of being kept beside current direction.

- [Curate workspace](CURATE_WORKSPACE.md): structured tea/vendor/quote facts, private evidence, Samples only, agent corrections and undo.
- [Curate consumer contract](CURATE_CONSUMER_CONTRACT.md): shared identities, agent/browser operations and editorial privacy boundaries.
