# Product Architecture PRD

*Requirements for the Product Architecture Initiative.*

Last updated: 2026-05-09

---

## Summary

This PRD defines the product requirements for refining Teajia's architecture so the codebase preserves the full product intention: art and science, taste and operations, editorial authority and backend rigor.

The goal is not to add one large feature. The goal is to make the next phase of building safer, clearer, and more coherent by turning Teajia's product philosophy into implementation-ready requirements.

## Goals

1. Preserve Teajia's identity as tea infrastructure shaped by taste, not generic commerce or SaaS.
2. Make the core domain distinctions explicit in types, APIs, UI language, and tests.
3. Prepare the codebase for network growth without compromising account isolation or trust.
4. Bring editorial, personal memory, network, and admin systems into better alignment.
5. Produce implementation plans that let future work proceed without re-litigating product philosophy.

## Non-Goals

These are explicitly out of scope for this initiative:

- Gamification, streaks, engagement notifications, likes, follows, social feeds.
- Algorithmic recommendations before the catalog and community outgrow human curation.
- Live tasting mode or phone-at-the-table features.
- Franchise-style operator branding.
- Generic CMS expansion detached from Teajia's editorial voice.
- Generic analytics dashboards for personal tea practice.
- Subscription or auto-replenishment mechanics.

## Primary Users

| User | Need |
|---|---|
| Adrian | A daily curation and operations system that matches how he actually works |
| Tea professionals | Tools for sourcing, inventory, events, and contribution without forcing brand adoption |
| Tea house operators | Access to quality tea, operational tools, public scaffolding, education, and trust signals |
| Tea workers | Scoped tools for learning, preparing, serving, and restocking |
| Home practitioners | A private tea record, event participation, learning, buying, and light hosting |
| Guests | Simple attendance, post-session recall, purchase inquiry, and discovery |
| Contributors | Recognition, editorial standards, and a dignified contribution path |

## Product Requirements

### PA-REQ-001 - Domain ontology

The system must define and document the core domain objects and their boundaries.

Required objects:

- Tea profile
- Product listing
- Product or inventory item
- Tasting session
- Personal journal entry
- Compass entry
- Article
- Contributor profile
- Event
- Order inquiry
- Wholesale order
- Account
- Membership
- Bundle
- Trust tier

Acceptance criteria:

- Each object has an owner, scope, lifecycle, and source of truth.
- Identity fields and experience fields are separated.
- Product, profile, listing, tasting, and journal language is consistent across public, admin, and API layers.
- The distinction appears in docs and TypeScript types.

### PA-REQ-002 - Article contract unification

The magazine reader, single-page renderer, admin editor, parser scripts, and API types must share one article block contract.

Acceptance criteria:

- There is one canonical article block type source.
- The admin editor can create or preserve every block type the reader supports, or unsupported blocks are intentionally hidden behind a documented migration path.
- The magazine editor does not reduce rich editorial layouts into generic paragraphs.
- Tests or fixtures cover representative article block families.

### PA-REQ-003 - Editorial engine

The magazine must become a curated publishing system.

Acceptance criteria:

- A curated keeper set of templates is available to the editor.
- Contributor attribution is supported as a first-class concept.
- Product and tea references can be attached to articles without turning articles into sales pages.
- Preview matches reader output closely enough for editorial review.
- The system supports Adrian's existing interviews and imagery as real launch content.

### PA-REQ-004 - Personal tea memory spine

The product must support a private, cumulative tea record across the person's journey.

Acceptance criteria:

- Tasting journal, Compass, favorites, collection, attended events, post-session notes, and order history have a coherent relationship.
- Personal memory remains private by default.
- The interface avoids dashboards, rankings, streaks, and quantified-self framing.
- The same tea can be encountered through multiple paths without duplicating identity.
- Guest-to-member continuity is supported where feasible.

### PA-REQ-005 - Account and user scoped client state

Client cache and persisted state must not leak stale data across account or user switches.

Acceptance criteria:

- React Query keys include active account or user scope where data is account-sensitive.
- Persisted Zustand slices are classified as global, account-scoped, user-scoped, or guest-local.
- Account switching invalidates or namespaces sensitive data.
- Logout clears sensitive personal and account data while preserving safe guest state where intentional.

### PA-REQ-006 - Declarative route authorization

Backend routes should have explicit authorization requirements.

Acceptance criteria:

- Worker routes can be inventoried by method, path, handler, account requirement, role requirement, and bundle requirement.
- Sensitive handlers use `requireBundle` or stricter platform checks as appropriate.
- Public routes are intentionally public and documented.
- Tests cover representative allowed and denied cases for each bundle.

### PA-REQ-007 - Migration discipline

The database setup must have a reliable source of truth for fresh and migrated environments.

Acceptance criteria:

- Fresh database setup can reach the same schema as a migrated database.
- Duplicate or ambiguous migration numbering is resolved or documented with a safe replay strategy.
- Recovery migrations are called out with rationale and follow-up cleanup.
- CI or a local script can test migration replay.

### PA-REQ-008 - Network lineage model

Network features must preserve autonomy, attribution, and trust.

Acceptance criteria:

- Canonical tea profiles and per-account listings remain separate.
- Curator and originator attribution is visible where network context requires it.
- Wholesale access remains trust-gated.
- Partner accounts can express their own store note, photos, price, and stock without overwriting canonical identity.
- The system avoids marketplace/review/rating patterns that would weaken the trust model.

### PA-REQ-009 - Admin as curation studio

Admin should feel like a workbench for sourcing, publishing, gathering, selling, and stewarding relationships.

Acceptance criteria:

- Admin navigation reflects product jobs, not generic software categories.
- Bundle gating is visible in tool metadata and enforced by the server.
- Daily workflows for Adrian remain faster than generalized operator workflows.
- Professional complexity is available without making simple work feel heavy.

### PA-REQ-010 - Interface grammar

Each major surface must have a clear product role and visual language.

Acceptance criteria:

- Public site, AccountPanel, `/me`, Compass, Admin, Magazine, and Network views each have documented jobs.
- New surfaces follow COLOR_RULES.md and designTokens typography guidance.
- Network surfaces follow NETWORK_UI_BRIEF.md: editorial register, rare bronze, sentences over labels, errors as prose.
- Personal memory surfaces follow TASTING_JOURNAL_BRIEF.md: private, calm, non-performative.

## Taste Requirements

These requirements are not decorative. They protect the product's meaning.

- Copy must avoid generic productivity language where tea-specific language is available.
- Interface density should match the task: quieter for personal reflection, more operational for admin work.
- Bronze is used sparingly for focus and commitment, not as decoration.
- Metrics are acceptable for operations, but personal tea memory should not become performance tracking.
- Product pages may sell, but articles should offer understanding first.
- Network pages should feel like stewardship, not marketplace optimization.

## Technical Requirements

- TypeScript remains the contract language for frontend domain models.
- Worker code must keep account scoping explicit in every data route.
- Cloudflare Worker bundle size remains a constraint.
- Existing mobile bottom-nav clearance and admin height-chain rules remain mandatory.
- Color lint must continue to pass before commit.
- Existing Playwright mobile tests should be extended, not bypassed.

## Release Criteria

Before implementation work from this initiative is considered complete:

- `npm run lint` passes.
- `npm run lint:colors` passes.
- Relevant Playwright tests pass for touched public/account/admin surfaces.
- Worker route/auth tests or equivalent local verification exist for backend authorization changes.
- Docs updated: INDEX, ACTIVE_BRIEFS, ROADMAP or CHANGELOG as applicable.
- Product ontology updates are reflected in implementation docs and not only in chat.
