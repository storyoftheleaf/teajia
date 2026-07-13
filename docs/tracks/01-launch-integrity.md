# Track 1: Launch Integrity

> Make it true before it's public: close the bugs a real user hits in their first week, not polish. This track gates every other track.

Status: launch-program trust floor implemented and locally verified, except for the reading-memory/saved-story discrepancy below. Broader cleanup remains backlog work. External launch evidence is tracked in [Launch Validation](../LAUNCH_VALIDATION.md).

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Blockers (do first)

- [x] **Fix confirm-picks invoice inflation (K1).** Collection confirmation now stores the correct per-unit sale rate through the shared invoice invariant. Focused invariant/integration coverage passes. Historical rows have a previewable, confirmed, audited repair path; applying it to production business data remains an explicit operator decision.
- [x] **Fix journal-article tap blanking the app (R1).** Article entries now navigate by slug to `/article/:slug`; draft and missing destinations remain absent from public entry points. Focused desktop/mobile Read routing coverage passes.

### Core build

- [ ] **Launch-program discrepancy — reading memory: wire or remove (R2-R4, R6).** This is the one remaining technical requirement from the launch-program design that Release 1 did not fully close. The old account history/saved pages are gone, but their underlying legacy system was not retired coherently. (day)
  - `App.tsx` still owns and persists `teajia_saved_stories` for legacy `Story` records, while the live D1 article path has no corresponding durable saved-story flow.
  - `MEMBER_MEMORY_LINKS` still advertises `/account/saved` and `/account/history`, but no UI renders the registry and those account routes no longer exist.
  - The dead `viewState === 'READER'` branch and `Reader.tsx` still carry the old `teajia_progress_*` behavior, while live articles use their own route and progress model.
  - Live Read pages still link to `/read/history`, `/read/earth-water-fire`, and `/read/craft`, even though `ReadIndex.tsx` withholds those stories from the published index.
  - Recommended closure: remove the unused memory-link registry, legacy saved/progress state, unreachable Reader branch, and links to unpublished stories. Only build a new D1-backed reading-memory feature if real use establishes a need.
- [x] **Verification-code delivery, email leg.** Sign-in and event/guest verification now share a purpose-aware challenge lifecycle and the Resend delivery boundary. Codes use CSPRNG generation and HMAC storage; delivery failures are explicit and codes are never logged. Worker/provider-boundary and frontend tests pass locally. Deployed receipt evidence belongs in [Launch Validation](../LAUNCH_VALIDATION.md).
- [x] **Per-order detail page.** The account-scoped detail endpoint, typed client, `/account/orders/:id` route, linked history rows, and all loading/error/empty states are implemented and covered by ownership and browser tests. The public inquiry lookup remains a separate flow.
- [ ] **Curate integrity: account partitioning + dead nav (P3, P1).** (hours each)
  - P3: Compass captures aren't partitioned per account. `teaCompassStore.ts` persists under a single fixed key, `name: 'teajia-compass'` (`:330`), regardless of active account or user. `useCompassSync.ts:16-24` documents the risk explicitly ("If cross-account bleed ever becomes a concern, this hook is the single place to add an `activeAccountId` dependency that clears the store on change") but the guard was never added. On a shared device, switching accounts can surface unsynced captures from the wrong account until the next sync cycle. Fix: key the persisted store name (or clear/reload it) on `activeAccountId` change inside `useCompassSync.ts`.
  - P1: `/admin/sources` and `/admin/personal` are dead-end nav children. `src/admin/AdminApp.tsx:790` redirects `sources` to `/admin/people` (lands on the Customers tab, not Sources: `PeopleView.tsx:44` defaults to `visibleTabs[0]`, and `sourcesAccess` defaults to `['owner']` at `PeopleView.tsx:25`, so non-owner admins can't reach the Sources tab at all even with the right query param). `AdminApp.tsx:788` redirects `personal` to `/admin/stock`, same destination as the parent "Stock" link, no distinct personal-collection view exists. Sidebar links are `src/components/LeftSidebar.tsx:209-210`. Fix: repoint the Sources redirect to `/admin/people?tab=sources` and loosen `sourcesAccess` if non-owner admins should see it; decide whether `/admin/personal` needs its own view or should be removed as a nav child.
  - Note: P4 (silent draft-promotion failure in `useCommitAndPromote.ts`) is already fixed, see Already shipped. The consolidated direction's open-item list is stale on this one.
- [ ] **Fix owner edit pill missing on cold loads (R5).** `StoryEditProvider` (`src/pages/read/storyEdit.tsx:73-75`) gates the inline edit UI on `selectIsOwnerTier(s) || s.isDevAdmin`, which reads the Zustand store's `platformRole`, never hydrated on a public cold load (no admin login flow ran). `ReadIndex.tsx` already works around the identical problem by decoding the JWT directly: `getTokenClaims()` (exported from `src/lib/api.ts:704`, used at `ReadIndex.tsx:309`) reads `claims?.role` / `claims?.platform_role` / `claims?.memberships` regardless of store hydration. `storyEdit.tsx` never got the same fix. Explains "edit sometimes not there" reports on `/read/porcelain-and-tea` and other cold-loaded story pages. (hours)
  - Fix: replace or supplement the `selectIsOwnerTier` check in `storyEdit.tsx:73-75` with the same `getTokenClaims()` pattern `ReadIndex.tsx` uses.
- [ ] **Dead reader code sweep (R8).** Confirmed zero importers anywhere in `src/` for: `src/components/ReadPage.tsx`, `src/components/SinglePageRenderer.tsx`, `src/components/reader/ReadingStreak.tsx` (also on the DO-NOT-BUILD list), `src/components/read/TagFilter.tsx`, `src/components/read/EndOfArticle.tsx`, `src/components/read/ReadableCard.tsx`. `src/components/Reader.tsx` is still imported (`src/App.tsx`, rendered only under the dead `viewState === 'READER'` branch, `:1108`) but is unreachable since nothing ever calls `setViewState('READER')`. Delete `Reader.tsx` and its render branch too once R2-R4 above is resolved (it's the same legacy-progress-key writer named in R2). (hours)
- [ ] **Migrate the final 3 `.pill-*` action buttons, then promote lint Rule 9 to blocking.** All three are in `src/admin/views/PlatformAdminView.tsx`, confirmed by grep to be the only file left with `pill-primary`/`pill-destructive` classes: line 93 (`ConfirmButton`'s default `confirmClassName = 'pill pill-destructive-confirm'`, used by both the Suspend and Reactivate account buttons when armed), line 424 (Save-profile button, `className="pill pill-primary ..."`), line 500 (Suspend-account idle state, `idleClassName="pill pill-destructive"`). Migrate all three to `<Button variant="primary">` / `<Button variant="destructive">`. Then flip lint Rule 9 in `scripts/lint-colors.sh:191` from `check_pattern_notice` to `check_pattern_ere` (blocking) so `.pill-*` action classes can't return. (mins)

## External and manual validation

All environment, production-data, operator, and human-only gates are maintained in [Launch Validation](../LAUNCH_VALIDATION.md), including the deployed OTP receipt and production invoice-repair decision.

## Already shipped

- All 24 `FIX_QUEUE.md` fixes (PR #172).
- All 17 RSVP friction items (`RSVP_FRICTION_AUDIT.md`).
- All 37 April audit findings (`AUDIT_2026-05.md` era).
- Design-system Phases A-D (`DESIGN_SYSTEM_PHASING.md`).
- June structural remediation: verify-code echo gated behind `DEV_RETURN_VERIFY_CODES` (`worker/src/index.ts:9867-9868`), CI lint gates.
- UI consistency Rules 1, 3, 8 lint-enforced and blocking; Rule 9 lint-enforced as a notice (`scripts/lint-colors.sh:70-193`), promoting it to blocking is the one remaining item above.
- P4 (silent Compass draft-promotion failure), fixed in commit `470c8025` ("fix(china): retry GFW timeouts, self-healing compass sync, unblock uploaded media"). `useCommitAndPromote.ts`'s `promotionError` is now read and rendered as a "Saved on this phone, drafts will update when the connection returns" toast (`src/components/TeaCompass/index.tsx:114,123-127,1539-1544`). The consolidated direction's open-item list is stale here; no build task needed.

## Sources

- `docs/superpowers/specs/2026-07-12-launch-to-real-use-program-design.md` (launch scope and reconciliation)
- `docs/_archive/consolidated-2026-07/AUDIT_2026-05.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/FIX_QUEUE.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/FRICTION_REVIEW.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/VISUAL_REVIEW.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/RSVP_FRICTION_AUDIT.md` (archived, shipped)
- `docs/UI_CONSISTENCY.md` (live, Rule 9 promotion still open)
- `docs/_archive/consolidated-2026-07/DESIGN_SYSTEM_PHASING.md` (archived, shipped)

## Cross-track dependencies

- Track 1 is the sole active track owner for the shipped invoice invariant, repair path, and customer order-detail trust floor; the completed commerce track has been removed.
- Verification-code delivery is one shared implementation used by sign-in and event/guest verification. External receipt evidence is not duplicated here; see [Launch Validation](../LAUNCH_VALIDATION.md).
- Track 2 owns real-operator rollout after this track's technical boundary is green.
