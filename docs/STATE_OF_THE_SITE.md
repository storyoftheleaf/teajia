# State of the Site

> Concise current snapshot. Product direction lives in [Consolidated Direction](CONSOLIDATED_DIRECTION.md); all human and external launch checks live only in [Launch Validation](LAUNCH_VALIDATION.md).

**Verified:** 2026-07-13 against the launch-to-real-use implementation branch and current repository.

## Executive summary

Teajia is a working multi-store tea operating platform, not a foundation waiting to be built. It includes account-scoped inventory and stock movement, inquiry-led commerce, customer order detail, events, Curate, tasting memory, personal Cellar/Favorites/Journal surfaces, a unified D1 article engine, contributor publishing, and more than 40 MCP tools.

Releases 1–3 of the launch-to-real-use program are implemented on the branch and locally verified. Invoice semantics and repair tooling, Read entry routing, email OTP delivery, tenancy-isolation coverage, customer order detail, starred-note curation, event-to-article drafting, personal-tea wiring, China-critical dependency removal, same-origin browser APIs, contact fallback, and contributor publishing are present and tested.

The real-world launch is not complete. Deployment, production-data judgment, real operators, mainland conditions, and approved editorial content cannot be proven by local fixtures. Their single checklist is [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md).

## One technical discrepancy remains

The reading-memory/saved-story system is still conceptually dead: it must either become a real, durable user feature or be removed completely. Until that choice is implemented and verified, the technical program cannot honestly be called closed. This is the only remaining in-scope technical discrepancy; Track 1 owns it.

This is distinct from the repaired Read entry paths and live editorial article routes, which are implemented.

## Current scorecard

| Area | Current state |
|---|---|
| Commerce | Inquiry-led flow, per-unit invoice invariant, customer order detail, fulfillment, and previewable repair path implemented |
| Authentication | Email OTP provider boundary implemented with Google OAuth retained; real deployed receipt remains external validation |
| Tenancy | Account scoping plus dedicated cross-account denial coverage implemented |
| Personal tea | Journal, Favorites, and API-backed Cellar are distinct and connected |
| Events | Event lifecycle and idempotent post-session article drafting implemented |
| Editorial | Unified article engine, contributor administration, author selection, pull quotes, and public contributor rendering implemented |
| China readiness | Runtime stock-media dependencies removed; browser APIs centralized/same-origin; contact fallback and service-worker policy implemented |
| Design system | Semantic tokens, named text scale, tap targets, modal layers, and lint enforcement active |
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
