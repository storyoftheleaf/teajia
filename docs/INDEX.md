# Teajia Documentation — Index

> Start here. This index routes to current truth; historical audits and session artifacts are not active work sources.

**Last updated:** 2026-07-13

## Start here

| Document | Authority |
|---|---|
| [STATE_OF_THE_SITE.md](STATE_OF_THE_SITE.md) | Concise verified snapshot of what exists and what remains |
| [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md) | Current product map and the seven active tracks |
| [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md) | **Only canonical checklist for Adrian, operator, editorial, deployed-environment, and other external validation** |
| [CHANGELOG.md](CHANGELOG.md) | Dated implementation history |
| [VISION.md](VISION.md) | Product philosophy, audience, and boundaries |

The launch-to-real-use implementation spec is
[`superpowers/specs/2026-07-12-launch-to-real-use-program-design.md`](superpowers/specs/2026-07-12-launch-to-real-use-program-design.md).
It records the locally verified Releases 1–3. It is an implementation record, not a second launch checklist.

## Active tracks

Tracks 4 and 6 are retired: their technical scope was absorbed by Releases 1–3, and their remaining real-world checks live only in [Launch Validation](LAUNCH_VALIDATION.md).

| # | Track | Current job |
|---|---|---|
| 01 | [Launch Integrity](tracks/01-launch-integrity.md) | Close the reading-memory/saved-story discrepancy; keep launch behavior trustworthy |
| 02 | [First Operator & Trusted Users](tracks/02-first-operator-and-users.md) | Learn from the first operator and trusted users after validation begins |
| 03 | [Read & the Editorial Engine](tracks/03-read-editorial-engine.md) | Editorial quality, real content, and contributor practice |
| 05 | [Curate & Personal Tea Memory](tracks/05-curate-tea-memory.md) | Deepen human-curated sourcing and personal tea memory |
| 07 | [Events & Gatherings](tracks/07-events-gatherings.md) | Improve the invite → gather → remember loop from real use |
| 08 | [Platform Hardening](tracks/08-platform-hardening.md) | Reduce structural risk and operational debt |
| 09 | [Coherence & IA Finishing](tracks/09-coherence-ia-finishing.md) | Finish connective UX and naming without reopening the product model |

## Product and design references

| Document | Use |
|---|---|
| [FLOWS.md](FLOWS.md) | End-to-end user journeys |
| [SITE_MAP.md](SITE_MAP.md) | Route and action map |
| [TEA_DISCOVERY.md](TEA_DISCOVERY.md) | Discovery-profile behavior and integration |
| [COLOR_RULES.md](COLOR_RULES.md) | Mandatory color and styling rules |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Canonical visual system |
| [DESIGN_WORKFLOW.md](DESIGN_WORKFLOW.md) | Design-system application workflow |
| [UI_CONSISTENCY.md](UI_CONSISTENCY.md) | Lint-enforced UI consistency contract |
| [MAGAZINE_PLAN.md](MAGAZINE_PLAN.md) | Magazine format and locked editorial presentation decisions |
| [MAGAZINE_WRITING_SURFACE_SPEC.md](MAGAZINE_WRITING_SURFACE_SPEC.md) | External writing-surface specification |

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

- [STORE_LAUNCH_PLAYBOOK.md](STORE_LAUNCH_PLAYBOOK.md)
- [AUSTRALIA_LAUNCH_PLAYBOOK.md](AUSTRALIA_LAUNCH_PLAYBOOK.md)
- [OPENING_STOCK_CSV_GUIDE.md](OPENING_STOCK_CSV_GUIDE.md)
- [STORE_OPERATOR_DAILY_WORKFLOWS.md](STORE_OPERATOR_DAILY_WORKFLOWS.md)
- [MEMBERS_AND_ACCESS_GUIDE.md](MEMBERS_AND_ACCESS_GUIDE.md)

## Maintenance contract

- Implementation work belongs in one of the seven active tracks.
- Human, deployed-environment, editorial, and optional decision status belongs only in `LAUNCH_VALIDATION.md`.
- Shipped work gets a dated `CHANGELOG.md` entry.
- Reference docs describe current behavior; they do not carry independent roadmaps or launch checklists.
- A stale plan is retired instead of being kept beside current direction.
