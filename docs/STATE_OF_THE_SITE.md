# State of the Site

> **Marked 2026-11-25: stale.** Verified 2026-08-10, before the September to November work. For the site today read [PILLAR.md](PILLAR.md); for where every plan stands read [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md).

> Concise current snapshot. Product direction lives in [Consolidated Direction](CONSOLIDATED_DIRECTION.md); all human and external launch checks live only in [Launch Validation](LAUNCH_VALIDATION.md).

**Verified:** 2026-08-10 against the Tea Master operating-program branch and current repository.

## Executive summary

Teajia is a working multi-store tea operating platform, not a foundation waiting to be built. It includes account-scoped inventory and stock movement, inquiry-led commerce, customer order detail, events, Curate, tasting memory, personal Cellar/Favorites/Journal surfaces, a unified D1 article engine, global Tea Master identities, external payment destinations, structured Wisdom relationships, and more than 40 MCP tools.

The Tea Master operating program now treats a Tea Master as one global person with a primary hosted `accounts.kind='master'` operational home. Rayi or Barry's visible store selection belongs to that hosted Tea Master account; guest account associations do not become their selection. Public favorites remain separate cross-network human curation.

Releases 1–3 of the launch-to-real-use program are implemented on the branch and locally verified. Invoice semantics and repair tooling, Read entry routing, email OTP delivery, tenancy-isolation coverage, customer order detail, starred-note curation, event-to-article drafting, personal-tea wiring, China-critical dependency removal, same-origin browser APIs, contact fallback, and contributor publishing are present and tested. Platform hardening now also includes strict frontend null checking, reproducible browser tests, stable REST errors, verified-email identity activation, protected owner invariants, tenant-safe synchronization, domain-scoped product/contact mutations, live MCP authorization, durable and locked provider limits, private retryable transcription, paged recording expiry, bounded `.xlsx` intake, immutable CI action pins, and exact browser origins.

The real-world launch is not complete. Deployment, production-data judgment, real operators, mainland conditions, and approved editorial content cannot be proven by local fixtures. Their single checklist is [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md).

## Launch 1 and Launch 4 update, 2026-11-26

Launch 1 is live (`FIRST_TABLE_OPEN`, on, in `src/lib/firstTable.ts`): the thank-you page with its teas, playlist and one reading, "Keep this tea", bought tea into the Tea Chest, and where a thank-you's order began. Launch 4 holds eight switches, all off, and with all of them closed each address answers as absent (`worker/src/launch4Closed.ts`):

- `TEA_TABLE_OPEN`: the Tea Table, and photograph credit.
- `FAVOURITES_OPEN`: private favourites at `/account/favourites`.
- `YOUR_TABLE_PAGE_OPEN`: the grouped Your Table page and shared tastings.
- `YOUR_TABLE_PLACE_OPEN`: "Add your table"; also needs `FEW_HOSTS_OPEN`.
- `HOST_ARTICLES_OPEN`: a host offers an article, reviewed in Publish.
- `TOP_TEAS_OPEN`: a host's top teas on their page.
- `TEA_HOUSES_OPEN`: Tea Houses with Visit, Build and Work.
- `HOME_BAR_OPEN`: the new bar words, Home in full and Read's three shelves.

## Launch 5 branch update, 2026-11-26

**Built on `build/launch-5`, finished on `build/l5-finish`. Every part is off until shipped.** Tea credit for hosts (`HOST_CREDIT_OPEN`) earns on orders that began from a host's thank-you once the shop fills them, and is used on the host's own order only with the owner's approval; the host reads it at `/account/tea-credit`, the owner approves in Manage, Sales, Waiting, and the checkout offers a use-my-credit tile, all behind that switch. The shop may set a per-order ceiling; there is none by default. Circles and series (`CIRCLES_OPEN`) and a host's own assistant key (`HOST_TOKENS_OPEN`) are on `/account/host`. The card for the table (`TABLE_CARD_OPEN`) prints from a public session in Manage. Does anyone know this tea (`KNOW_THIS_TEA_OPEN`, which also needs `TEA_TABLE_OPEN`) lets a signed-in person put a photograph of a tea they cannot name on the Tea Table, with others answering privately and nothing counted or sent. Circles and the host's key also need `FEW_HOSTS_OPEN`; tea credit and the card for the table do not. Checked by `tests/launch-5.spec.ts` in the offline sandbox and by the worker tests named in the review, `/mnt/project-files/guests-build/a5-launch-5-review.md`.

## Launch 3 branch update, 2026-11-26

**Built on `build/launch-3`. `ANYONE_HOSTS_OPEN` defaults to off until shipped, and needs `FEW_HOSTS_OPEN` too.** Anyone signed in can host by request from their own private account. Adrian's approval adds the by-link door; he can stop a host and set their reach in Manage. Reports, the host's guest book review, the after-sit gallery, tastings, the waiting list with released seats and seat notices, reach and the open door, the contribution line and the [Launch 3 agent tools](../worker/src/mcpTools/launch3.ts) all close with the switch. The privacy review is `guests-build/a3-launch-3-privacy-review.md`; its fixes are guarded by [a3-launch-3-privacy.test.ts](../worker/tests/a3-launch-3-privacy.test.ts).

## Launch 2 branch update, 2026-11-26

**Built on `build/launch-2`. `FEW_HOSTS_OPEN` defaults to off until shipped.** An approved host opens `/account/host` directly to make an unlisted table from their own private Tea Chest account. By-link guests can take a seat by name while seats are available. By-request guests give a name and contact and need the host's approval. Adrian controls who can host in Manage → Settings → Platform.

The shared session page may show house photographs. The guest page returns the address, map link and arrival guide to a confirmed guest until the session ends, while their seat and the host's approval hold. The host's page brings together guests, teas, the reusable arrival guide, attendance and individual thank-you links. Private guest-book notes belong to the host alone. The host can download their record as JSON, covering their own tables, guest names and attendance, teas and private notes. The file omits guest contacts, private guest links and arrival details. The [authenticated agent tools](../worker/src/mcpTools/fewHosts.ts) cover table creation and listing, guest decisions, adding tea, private notes and platform-owner host approval, with preview and confirmation for writes.

The guest page checks the seat before returning the arrival guide. The [media route](../worker/src/index.ts) serves a step photograph to anyone who already has its URL, including after the session ends or a seat is revoked. The [record API](../worker/src/hostRecord.ts) still serves a former host's own tables while the flag is open. The download button appears only while they can host.

## Library handoff update, 2026-10-21

Library now prepares teas for Inventory through one editable record shared with Source and Stock. Type-coloured three-line rows retain price comparisons and purchase quantities; imports live under Add. Transfer creates a private draft, keeps the source record and places it in Transferred. Linked inventory teas reopen that record, and reorder drafts use Ledger without changing stock until arrival acceptance. Release status is recorded separately by the Worker-first publication runner.

## Curate update, 2026-10-08

The [Curate workspace](CURATE_WORKSPACE.md) adds structured vendor/tea/quote fields, private source-file uploads, corrections and guarded undo, account-wide manager access, and the Samples only inventory view with explicit tasting consumption and orders. Implementation and release proof are separate: deployment status lives in release artifacts. Existing LKY/XWT cleanup remains pending a successful scoped live read.

## One technical discrepancy remains

The reading-memory/saved-story system is still conceptually dead: it must either become a real, durable user feature or be removed completely. Until that choice is implemented and verified, the technical program cannot honestly be called closed. This is the only remaining in-scope technical discrepancy; Track 1 owns it.

This is distinct from the repaired Read entry paths and live editorial article routes, which are implemented.

## Current scorecard

| Area | Current state |
|---|---|
| Commerce | Inquiry-led flow, per-unit invoice invariant, customer order detail, fulfillment, and previewable repair path implemented |
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
| Hosting | Approved hosts, anyone, circles, the key and the card (Launches 2, 3 and 5) are built, all behind switches, closed |
| Tea Table | Built, closed (`TEA_TABLE_OPEN`) |
| Tea credit | Ledger and screens built, closed (`HOST_CREDIT_OPEN`) |
| Launch | Incomplete until the checks in `LAUNCH_VALIDATION.md` are performed |

## Product boundary

Teajia remains deliberately human-led:

- Orders close through a personal WhatsApp or email conversation, not automated checkout.
- Curation is performed by people, not voting, rankings, or aggregated reviews.
- Journal, Favorites, and Cellar remain different records rather than one engagement system.
- No social feed, gamification, streaks, engagement notifications, or auto-replenishment. The Tea Table is the one public page that lists what people chose to put there, newest first; see `CLAUDE.md`.
- The product supports tea practice before and after a session, not phone use at the table.

## Documentation contract

- [VISION.md](VISION.md): philosophy and boundaries
- [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md): current map and three active engineering tracks
- [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md): only manual/external/editorial launch checklist
- [CHANGELOG.md](CHANGELOG.md): implementation history
- Architecture, design, route, and operator documents: current references, not competing roadmaps
