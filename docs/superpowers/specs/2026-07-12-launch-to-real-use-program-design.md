# Launch-to-Real-Use Program Design

**Date:** 2026-07-12

**Status:** Approved direction; implementation has not started

**Program owner:** Teajia

**Implementation entrypoint:** Start the next session by writing the task-by-task implementation plan. Use test-driven development and an isolated `codex/` worktree branch.

## Goal

Complete Teajia's remaining trust-floor, product-loop, China-reachability, and contributor-publishing development as three integrated releases, then verify the whole platform before publishing the implementation branch.

This program implements the development work identified by the July documentation consolidation. It does not revive superseded audit work or expand into social, algorithmic, gamified, or conventional-checkout features.

## Why three releases

The work crosses commerce, authentication, editorial routing, tenancy, Curate, events, member surfaces, China access, and contributor publishing. A single undifferentiated change would make failures difficult to isolate. Separate long-lived branches would create migration and integration drift.

The program therefore uses one isolated branch with three sequential, internally verified releases:

1. Trust floor
2. Product loops
3. Reach and publishing

Each release must be green before the next begins. The full verification matrix runs again after all three are integrated.

## Release 1 — Trust floor

### 1. Invoice correctness and repair

- Correct confirm-picks so `price_at_sale`, quantity, and line totals have one unambiguous meaning.
- Ensure admin and customer views calculate totals from the same invariant.
- Add regression tests covering quantities, unit conversions, and persisted invoice lines.
- Create a safe, idempotent repair path for affected invoice records.
- The repair must support a read-only preview before mutation and report exactly which invoices would change.

### 2. Read entry-path integrity

- Route journal article taps to the live article reader instead of the removed `PAGE_READER` overlay.
- Remove or properly wire dead reading-history and saved-story destinations.
- Prevent published surfaces from linking to draft or nonexistent articles.
- Add route-level tests for each repaired entry path.

### 3. Verification-code delivery

- Email OTP is the default delivery channel.
- Reuse the existing verification-code lifecycle rather than creating a second auth system.
- Cover sign-in verification and event/guest verification with the same delivery abstraction.
- Delivery failure must be explicit, logged without exposing codes, and retryable.
- Google OAuth remains available; email OTP becomes the non-Google path required for China.

### 4. Tenancy-isolation coverage

- Add cross-account denial tests for customers, events, invoices, inventory/stock, and Curate records.
- Exercise both direct resource IDs and list/query endpoints.
- Test platform-tier exceptions separately from ordinary account membership.
- Treat any cross-account read or write as release-blocking.

### 5. Customer order details

- Add an order-detail destination reached from the existing order history.
- Show reference, status, dates, line items, quantities, prices, totals, and the appropriate contact path.
- Preserve the inquiry-led commerce model; do not add automated payment or conventional checkout.
- Use existing account-page and loading/error/empty-state patterns.

## Release 2 — Product loops

### 1. Starred-notes curation loop

- Add section-scoped voice capture for tasting notes.
- Let members privately star their own notes as review candidates.
- Add an admin review queue that supports promote, edit, dismiss, and attributed publication.
- Preserve human curation: no voting, aggregation, ranking, or algorithmic selection.
- Store attribution durably and render it on the resulting product impression.

### 2. Event-to-photo-essay editor

- Turn an event's existing gallery, host notes, energy, and related metadata into an article draft.
- Reuse the D1 article engine and block editor; do not create a parallel event-content system.
- Draft creation must be idempotent or explicitly warn when an event already has an associated draft.
- Publication remains a deliberate editorial action.

### 3. Personal-tea wiring

- Add a real `/account/cellar` page around the existing API-backed Cellar surface.
- Repair the dead Remember/Favorites destination.
- Add quiet cross-links among Journal, Favorites, and Cellar using existing editorial-link patterns.
- Do not rename existing routes or navigation labels in this program.
- Do not merge the three data models; they represent tasting memory, affinity, and ownership respectively.

## Release 3 — Reach and publishing

### 1. China reachability

- Replace public Unsplash, Picsum, or similar runtime image dependencies with owned media.
- Remove hardcoded API origins in favor of same-origin or centralized configured access.
- Use Release 1's email OTP as the non-Google authentication path.
- Provide a configurable email/contact fallback where WhatsApp is unreachable.
- Keep WeChat-specific integration out of scope unless credentials and a concrete operating workflow already exist.
- Verify CSP and service-worker behavior for the resulting owned/same-origin paths.

### 2. Contributor administration

- Add contributor list, create, edit, and publish workflows using the existing contributor schema.
- Support the fields already designed for beginnings, current practice, inspirations, closing, links, and account association.
- Keep account host-contributor linkage consistent when either side changes.
- Use established admin form and panel patterns.

### 3. Article author selection and pull quotes

- Replace free-text article author IDs with contributor selection and search.
- Add editing for `pull_quote` and `pull_quote_subject`.
- Render pull quotes at the existing contributor-profile insertion points.
- Preserve existing articles whose author data predates contributors.

### 4. Barry-ready validation

- Make the complete publishing path technically ready for Barry's contributor record and articles.
- Do not invent, rewrite, or publish Barry's personal voice without Adrian's supplied or approved content.
- Verification uses fixture/staging content until the real editorial material is available.

## Shared architecture

### Data and migrations

- Prefer additive migrations.
- Every new table and account-owned row includes `account_id` where tenancy applies.
- Every mutation has explicit ownership and capability enforcement.
- Repair and backfill operations are idempotent and previewable where business data can change.
- Reuse the existing article, event, tasting, product, invoice, and contributor models rather than introducing parallel stores.

### Frontend

- Follow current account-page, admin-panel, and article-editor patterns.
- Use design tokens and typography classes from the existing design system.
- Preserve bottom-navigation clearance, tap-target, modal-layering, and Inventory height-chain contracts.
- No navigation-label changes or route renames are authorized by this design.

### Error handling

- User-facing failures explain what happened and whether retrying is safe.
- API failures use the established error-envelope direction rather than matching arbitrary strings in new code.
- Auth and tenancy failures fail closed.
- Delivery logs never expose verification codes or secret values.

## Testing and verification contract

Development follows test-driven implementation: add a failing behavior test, confirm the expected failure, implement the smallest correct change, and rerun focused tests before integration.

### Per subsystem

- Focused unit or route tests for the changed behavior
- Worker tests for authorization, data invariants, and mutations
- Component/route tests for loading, empty, error, and success states
- Migration rehearsal from both clean schema and the current legacy snapshot when migrations are added

### After Release 1

- Invoice regression and repair preview tests
- Read route tests
- Verification delivery tests with provider boundaries mocked
- Cross-account tenancy suite
- Order history → detail journey

### After Release 2

- Member note capture/star → admin promotion → product attribution journey
- Event → article draft journey
- Journal/Favorites/Cellar account-page journey on desktop and mobile

### After Release 3

- China dependency scan for blocked third-party origins and hardcoded APIs
- Email OTP end-to-end in the deployed environment
- Contributor create/edit → author selection → profile/article rendering journey

### Final integrated gate

- `npm run lint`
- `npm run lint:colors`
- production build
- complete worker test suite
- relevant frontend/unit suites
- `npm run test:mobile` with the development server running
- migration rehearsal through the newest migration
- dependency/origin scan for China-critical public paths
- manual smoke tests of commerce, authentication, account switching, Read, Curate, events, Cellar, and contributor publishing

No completion claim is allowed until the final integrated gate has fresh passing evidence. Human-only validation is reported separately and cannot be replaced by fixtures.

## Human-only gates

The implementation can prepare these outcomes but cannot truthfully complete them without Adrian or the relevant person:

- Running the Australia launch checklist with its real operator
- Completing a real inquiry, fulfillment, and operator feedback loop
- Testing actual mainland-China network conditions
- Supplying or approving real contributor voice and Barry's profile content
- Curating keeper magazine references and final editorial layouts
- Providing external account configuration or credentials when a service requires them

These gates do not block building and verifying the underlying technical paths. They remain explicit launch checks after the implementation branch is green.

## Out of scope

- Social graphs, feeds, follows, likes, or community voting
- Algorithmic recommendations, similarity scoring, or review aggregation
- Streaks, badges, adaptive learning, or engagement notifications
- Automated checkout, payment orchestration, or replenishment
- Live phone-at-the-table tasting modes
- Broad worker modularization unrelated to a touched subsystem
- Route renames, navigation-label changes, or a general IA redesign
- Analytics dashboards, vendor scoring, and inventory-health scoring
- Premature network directory, portability, or verification-badge expansion

## Implementation sequencing rule

Release 1 must land before Release 2. Release 2 must land before Release 3. Within a release, independent tasks may be delegated in parallel only when they do not edit overlapping files or share an unfinished migration boundary. Integration and verification happen in release order on one isolated branch.

## Done definition

The development program is complete when all in-scope technical paths are implemented, migrations are rehearsed, focused and integrated verification passes, documentation and track status reflect reality, and the implementation is published for review. Human-only gates must be listed as pending until performed by the appropriate person.
