# Teajia Documentation — Index

> Start here. This index routes to current truth; historical audits and session artifacts are not active work sources.

**Last updated:** 2026-07-13

## Start here

| Document | Authority |
|---|---|
| [STATE_OF_THE_SITE.md](STATE_OF_THE_SITE.md) | Concise verified snapshot of what exists and what remains |
| [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md) | Current product map and the three active engineering tracks |
| [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md) | **Only canonical checklist for Adrian, operator, editorial, deployed-environment, and other external validation** |
| [CHANGELOG.md](CHANGELOG.md) | Dated implementation history |
| [VISION.md](VISION.md) | Product philosophy, audience, and boundaries |

The launch-to-real-use implementation spec is
[`superpowers/specs/2026-07-12-launch-to-real-use-program-design.md`](superpowers/specs/2026-07-12-launch-to-real-use-program-design.md).
It records the locally verified Releases 1–3. It is an implementation record, not a second launch checklist.

## Active engineering tracks

Only three engineering queues remain active. Human, operator, editorial, and deployed-environment work is not a fourth queue; it lives only in [Launch Validation](LAUNCH_VALIDATION.md).

| # | Track | Current job |
|---|---|---|
| 01 | [Launch Integrity](tracks/01-launch-integrity.md) | Close the reading-memory/saved-story discrepancy; keep launch behavior trustworthy |
| 05 | [Product & Curate Integrity](tracks/05-curate-tea-memory.md) | Keep sourcing, member tea memory, and first-operator product loops coherent |
| 08 | [Platform Hardening](tracks/08-platform-hardening.md) | Reduce structural risk and operational debt |

## Product and design references

| Document | Use |
|---|---|
| [FLOWS.md](FLOWS.md) | End-to-end user journeys |
| [SITE_MAP.md](SITE_MAP.md) | Route and action map |
| [TEA_DISCOVERY.md](TEA_DISCOVERY.md) | Discovery-profile behavior and integration |
| [COLOR_RULES.md](COLOR_RULES.md) | Mandatory color and styling rules |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Canonical visual system |
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
- [STORE_OPERATOR_DAILY_WORKFLOWS.md](STORE_OPERATOR_DAILY_WORKFLOWS.md)
- [MEMBERS_AND_ACCESS_GUIDE.md](MEMBERS_AND_ACCESS_GUIDE.md)

## Maintenance contract

- Implementation work belongs in one of the three active tracks.
- Human, deployed-environment, editorial, and optional decision status belongs only in `LAUNCH_VALIDATION.md`.
- Shipped work gets a dated `CHANGELOG.md` entry.
- Reference docs describe current behavior; they do not carry independent roadmaps or launch checklists.
- A stale plan is retired instead of being kept beside current direction.
