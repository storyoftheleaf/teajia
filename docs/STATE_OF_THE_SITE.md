# State of the Site

> Concise current snapshot. Product direction lives in [Consolidated Direction](CONSOLIDATED_DIRECTION.md); all human and external launch checks live only in [Launch Validation](LAUNCH_VALIDATION.md).

**Verified:** 2026-08-11 against the current repository and the locally isolated retail-sales safety branch.

## Executive summary

Teajia is a working multi-store tea operating platform, not a foundation waiting to be built. It includes account-scoped inventory and stock movement, inquiry-led commerce, customer order detail, events, Curate, tasting memory, personal Cellar/Favorites/Journal surfaces, a unified D1 article engine, global Tea Master identities, external payment destinations, structured Wisdom relationships, and more than 40 MCP tools.

The Tea Master operating program now treats a Tea Master as one global person with a primary hosted `accounts.kind='master'` operational home. Rayi or Barry's visible store selection belongs to that hosted Tea Master account; guest account associations do not become their selection. Public favorites remain separate cross-network human curation.

Releases 1–3 of the launch-to-real-use program are implemented on the branch and locally verified. Invoice semantics and repair tooling, Read entry routing, email OTP delivery, tenancy-isolation coverage, customer order detail, starred-note curation, event-to-article drafting, personal-tea wiring, China-critical dependency removal, same-origin browser APIs, contact fallback, and contributor publishing are present and tested. Platform hardening now also includes strict frontend null checking, reproducible browser tests, stable REST errors, verified-email identity activation, protected owner invariants, tenant-safe synchronization, domain-scoped product/contact mutations, live MCP authorization, durable and locked provider limits, private retryable transcription, paged recording expiry, bounded `.xlsx` intake, immutable CI action pins, and exact browser origins.

The retail-sales safety phase is implemented and locally verified on its isolated branch. A public basket belongs to exactly one store, checkout contact and inquiry persistence follow that store, and mixed-store additions are rejected without replacing the existing basket. Inquiry retries reuse a private capability token, public tracking is token-only and redacted, and the operator inbox is authenticated, account/JWT-fenced, and visibly reports load or save failures. Customer order history and detail convert stored USD amounts before applying a requested currency label. Retail invoice creation and editing reject malformed or cross-account inputs before writes; edit, fulfill, void, split, and inventory-link commands share a lifecycle fence so concurrent commands cannot apply stale stock changes.

This does not add automated checkout or money custody. An immutable payment ledger and reconciliation, inquiry-to-invoice conversion, explicit sales-versus-cash reporting, Tea Master seller attribution/settlement policy, and the wholesale transfer rebuild remain subsequent approved phases.

The real-world launch is not complete. Deployment, production-data judgment, real operators, mainland conditions, and approved editorial content cannot be proven by local fixtures. Their single checklist is [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md).

## One technical discrepancy remains

The reading-memory/saved-story system is still conceptually dead: it must either become a real, durable user feature or be removed completely. Until that choice is implemented and verified, the technical program cannot honestly be called closed. This is the only remaining in-scope technical discrepancy; Track 1 owns it.

This is distinct from the repaired Read entry paths and live editorial article routes, which are implemented.

## Current scorecard

| Area | Current state |
|---|---|
| Commerce | Store-bound inquiry-led checkout, private redacted tracking, account-fenced operator inbox, currency-correct customer orders, validated invoice writes, lifecycle-fenced stock commands, fulfillment, and previewable repair path implemented locally |
| Authentication | Email OTP and Google OAuth retained; signup and invitation privilege require verified email, protected owner credentials cannot be reset by lower tiers, deleted users cannot refresh, and browser/MCP authority is revalidated or revoked on security changes |
| Tenancy | Account scoping, owner-floor rules, tenant/author-safe note synchronization, capability-partitioned product creation, private recording ownership, and dedicated cross-account denial coverage implemented |
| Personal tea | Journal, Favorites, and API-backed Cellar are distinct and connected |
| Events | Event lifecycle and idempotent post-session article drafting implemented |
| Editorial | Unified article engine, contributor administration, author selection, pull quotes, and public contributor rendering implemented |
| Tea Masters | Draft-reviewed global profiles, hosted master-account selection, account associations, Public favorites, share links, and payment destinations implemented |
| Inventory | Lifecycle sections, truthful personal/product tasting separation, writing/incoming facets, exact Journal entry links, and incoming-only publication guards implemented |
| Wisdom | Typed node relationships, public-state gating, integrity findings, name-first repair, and article/tea reverse links implemented |
| China readiness | Runtime stock-media dependencies removed; browser APIs centralized/same-origin; contact fallback and service-worker policy implemented |
| Design system | Semantic tokens, named text scale, tap targets, modal layers, strict null checking, and blocking action-button lint active |
| Launch | Incomplete until the checks in `LAUNCH_VALIDATION.md` are performed |

## Product boundary

Teajia remains deliberately human-led:

- Orders close through a personal WhatsApp or email conversation, not automated checkout.
- Curation is performed by people, not voting, rankings, or aggregated reviews.
- Journal, Favorites, and Cellar remain different records rather than one engagement system.
- No social feed, gamification, streaks, engagement notifications, or auto-replenishment.
- The product supports tea practice before and after a session, not phone use at the table.

## Documentation contract

- [VISION.md](VISION.md): philosophy and boundaries
- [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md): current map and three active engineering tracks
- [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md): only manual/external/editorial launch checklist
- [CHANGELOG.md](CHANGELOG.md): implementation history
- Architecture, design, route, and operator documents: current references, not competing roadmaps
