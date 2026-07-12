# State of the Site

> A concise current snapshot, not a roadmap. For priorities and exact build queues, use [Consolidated Direction](CONSOLIDATED_DIRECTION.md) and [tracks/](tracks/). Historical audits live in [_audit/](_audit/) and [_archive/](_archive/).

**Verified:** 2026-07-12 against the July consolidation and current repository.

## Executive summary

Teajia's platform foundations exist: multi-store tenancy, account roles and capability bundles, inventory and stock movements, inquiry-led commerce, events, Curate, the tasting journal, the D1 article engine, contributor profiles, and more than 40 MCP tools. The product is no longer blocked on foundational feature construction.

The immediate work is narrower: correct a small launch-integrity set, prove tenancy isolation, make sign-in delivery real, then put the platform in front of a second operator, trusted Curate users, and real event guests. Editorial curation and real content now gate the public experience more than new infrastructure does.

## Current scorecard

| Category | Current status | Remaining issue |
|---|---|---|
| Editorial and content | **Strong** | Fix Read launch bugs; curate keeper templates and publish the real interview archive |
| Commerce | **Strong, with one critical bug** | Repair confirm-picks invoice inflation; add the customer order-detail page |
| Authorization | **Mostly enforced** | Add cross-account tenancy-isolation coverage and close remaining inconsistent bundle gates |
| Design system | **Strong** | Enforced tokens and lint are live; remaining work is long-tail cleanup, not systemic fragmentation |
| Performance | **Mixed** | Heavy optional/admin chunks remain; CDN Tailwind and remote-font problems are gone |
| Architecture coherence | **Partially connected** | Finish personal-tea routing and a few event/editorial connective loops |
| Mobile UX | **Improved, verification pending** | Restore the Playwright dependency and rerun the mobile suite on real screens |
| Conversion | **Clear and inquiry-led** | Protect invoice trust, expose order detail, and provide a China-safe contact fallback |
| Documentation | **Consolidated** | This snapshot and the nine tracks now replace the old overlapping scorecards and roadmaps |

## Launch and trust floor

These are the only technical items that block putting more real people on the platform:

1. Fix confirm-picks invoice inflation and repair affected invoice data.
2. Fix the journal article blank screen and dead or draft Read links.
3. Deliver verification codes through a real channel.
4. Add cross-account tenancy-isolation tests before exposing a second store.
5. Add the missing customer order-detail page.

Exact acceptance criteria and code references live in [Track 1](tracks/01-launch-integrity.md), [Track 6](tracks/06-commerce-inquiry-model.md), and [Track 8](tracks/08-platform-hardening.md).

## The work that proves the product

After the trust floor:

1. Complete the Australia launch checklist with a real operator and a real inquiry-to-fulfillment cycle.
2. Onboard trusted Curate users and run events with real guests.
3. Finish China-critical reachability: owned media, same-origin APIs, non-Google sign-in, and a reachable contact path.
4. Curate the keeper article templates, publish the interview archive, and validate contributor publishing with Barry.
5. Build the starred-notes loop: member notes → human review → attributed product impressions.

These are owned by [Tracks 2–5](tracks/). They outrank additional platform expansion.

## Explicitly not on the roadmap

- Social feeds, follows, likes, or member-network mechanics
- Algorithmic recommendations, similarity engines, or aggregated reviews
- Streaks, badges, adaptive learning, and engagement gamification
- Conventional automated checkout or auto-replenishment
- Live phone-at-the-table tasting experiences
- Analytics theater: health scores, vendor scorecards, and velocity dashboards at one-store scale
- Premature network directory, portability, and verification systems

## Recently established foundations

- Multi-store account model, role/bundle enforcement, Launch Center, and Australia account
- Inventory, stock spine, receipts, samples, personal cellars, and purpose-based ingestion
- Inquiry → confirmation commerce, payment status, fulfillment, and customer order/sample histories
- Events v2, tasting events, join codes, control room, and recap pages
- Curate sourcing capture and the member tasting journal
- Unified D1 article engine, block editor, Smart Paste, immersive reader, edge metadata, and contributor schema
- Design tokens, color/UI lint enforcement, self-hosted fonts, and compiled Tailwind
- MCP OAuth, public shop assistant, durable confirmations, rate limiting, and 40+ tools

See [CHANGELOG.md](CHANGELOG.md) for dated shipping history.

## Documentation contract

- [VISION.md](VISION.md): product philosophy and boundaries
- [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md): one ordered program
- [tracks/](tracks/): the only active checklists
- [CHANGELOG.md](CHANGELOG.md): shipped history
- Architecture, design, and operator documents: references, not competing roadmaps
- [_archive/](_archive/): historical context only

New work enters the relevant track. If it has not yet earned a track, place one sentence in the root `TODO.md` intake inbox. Do not revive old audit checklists or create a second roadmap.
