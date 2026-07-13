# Track 1: Launch Integrity

> Make it true before it's public: close the bugs a real user hits in their first week, not polish. This track gates every other track.

Status: launch-program trust floor implemented and locally verified; broader cleanup items below remain open and external launch evidence is pending.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Blockers (do first)

- [x] **Fix confirm-picks invoice inflation (K1).** Collection confirmation now stores the correct per-unit sale rate through the shared invoice invariant. Focused invariant/integration coverage passes. Historical rows have a previewable, confirmed, audited repair path; applying it to production business data remains an explicit operator decision.
- [x] **Fix journal-article tap blanking the app (R1).** Article entries now navigate by slug to `/article/:slug`; draft and missing destinations remain absent from public entry points. Focused desktop/mobile Read routing coverage passes.

### Core build

- [ ] **Reading memory: wire or remove (R2-R4, R6).** The whole "reading memory" feature is dead; per the audit, wire it or remove it, no third option. (day)
  - R2: `/account/history` (`src/pages/ReadingHistoryPage.tsx:21-39`) reads `localStorage` keys prefixed `teajia_progress_${story.id}`, but only the legacy `Reader.tsx` (`src/components/Reader.tsx:360,374`) writes that key, and `Reader.tsx` is unreachable (see R8). The live reader, `ArticlePage.tsx`, writes progress under a different key, `teajia_article_${article.id}` (`src/pages/ArticlePage.tsx:2465,2485`). History is permanently empty.
  - R3: Saved Stories (`src/pages/SavedStoriesPage.tsx`) reads ids from `localStorage['teajia_saved_stories']` and resolves them against `api.articles.listPublished()` (real `DbArticle.id` values). The only wired `toggleSave` (`src/App.tsx:591`, called from `:1117`, `:1133`, `:1146`) saves ids from the legacy `stories` array (`useStories()` in `src/context/StoryContext.tsx`, sourced from hardcoded `src/content` `STORIES`, not the DB). The ids never match, so saves never appear.
  - R4: `MEMBER_MEMORY_LINKS` (`src/components/AccountPanel/workflows.ts:43-49`, routes `/account/saved` and `/account/history`) is defined but has zero renderers anywhere in `src/`, confirmed by grep. Compare `READER_EXPLORE_LINKS` in the same file, which is rendered by `src/components/AccountPanel/ReaderView.tsx:4,99`. The two orphaned routes are unreachable from any UI.
  - R6: `AtlasMapOfMountains.tsx:94` (live page) links to `/read/history`, and `CraftPotThatRemembers.tsx:14`/`CraftRenewalPorcelain.tsx:26-27`/`RockRemembers.tsx:14`/`BeforeTheMist.tsx:15`/`LegendImmortalsCliff.tsx:14`/`FieldStudyWaterBeforeLeaf.tsx:16` link to `/read/earth-water-fire` and `/read/craft`. All three targets are registered routes in `src/App.tsx` (lines 890, 900, 915) but are marked draft (no `live: true`) in `ReadIndex.tsx`'s `INDEX_GROUPS` (`:61`, `:70`, `:90`). `live` is described there as "the publish gate," but nothing gates the routes themselves, only the index listing.
  - Decide once: either fix `ReadingHistoryPage.tsx` to read the `teajia_article_` key and repoint `toggleSave` at real `DbArticle` ids, then render `MEMBER_MEMORY_LINKS` in the AccountPanel reader view; or delete `ReadingHistoryPage.tsx`, `SavedStoriesPage.tsx`, `MEMBER_MEMORY_LINKS`, and strip the R6 next-page links to unpublished drafts.
- [x] **Verification-code delivery, email leg.** Sign-in and event/guest verification now share a purpose-aware challenge lifecycle and the Resend delivery boundary. Codes use CSPRNG generation and HMAC storage; delivery failures are explicit and codes are never logged. Worker/provider-boundary and frontend tests pass locally. A real receipt through Resend on the deployed review environment remains an external launch gate.
- [x] **Per-order detail page.** The account-scoped detail endpoint, typed client, `/account/orders/:id` route, linked history rows, and all loading/error/empty states are implemented and covered by ownership and browser tests. The public inquiry lookup remains a separate flow.
- [ ] **Curate integrity: account partitioning + dead nav (P3, P1).** (hours each)
  - P3: Compass captures aren't partitioned per account. `teaCompassStore.ts` persists under a single fixed key, `name: 'teajia-compass'` (`:330`), regardless of active account or user. `useCompassSync.ts:16-24` documents the risk explicitly ("If cross-account bleed ever becomes a concern, this hook is the single place to add an `activeAccountId` dependency that clears the store on change") but the guard was never added. On a shared device, switching accounts can surface unsynced captures from the wrong account until the next sync cycle. Fix: key the persisted store name (or clear/reload it) on `activeAccountId` change inside `useCompassSync.ts`.
  - P1: `/admin/sources` and `/admin/personal` are dead-end nav children. `src/admin/AdminApp.tsx:790` redirects `sources` to `/admin/people` (lands on the Customers tab, not Sources: `PeopleView.tsx:44` defaults to `visibleTabs[0]`, and `sourcesAccess` defaults to `['owner']` at `PeopleView.tsx:25`, so non-owner admins can't reach the Sources tab at all even with the right query param). `AdminApp.tsx:788` redirects `personal` to `/admin/stock`, same destination as the parent "Stock" link, no distinct personal-collection view exists. Sidebar links are `src/components/LeftSidebar.tsx:209-210`. Fix: repoint the Sources redirect to `/admin/people?tab=sources` and loosen `sourcesAccess` if non-owner admins should see it; decide whether `/admin/personal` needs its own view or should be removed as a nav child.
  - Note: P4 (silent draft-promotion failure in `useCommitAndPromote.ts`) is already fixed, see Already shipped. The consolidated direction's open-item list is stale on this one.
- [ ] **Fix owner edit pill missing on cold loads (R5).** `StoryEditProvider` (`src/pages/read/storyEdit.tsx:73-75`) gates the inline edit UI on `selectIsOwnerTier(s) || s.isDevAdmin`, which reads the Zustand store's `platformRole`, never hydrated on a public cold load (no admin login flow ran). `ReadIndex.tsx` already works around the identical problem by decoding the JWT directly: `getTokenClaims()` (exported from `src/lib/api.ts:704`, used at `ReadIndex.tsx:309`) reads `claims?.role` / `claims?.platform_role` / `claims?.memberships` regardless of store hydration. `storyEdit.tsx` never got the same fix. Explains "edit sometimes not there" reports on `/read/porcelain-and-tea` and other cold-loaded story pages. (hours)
  - Fix: replace or supplement the `selectIsOwnerTier` check in `storyEdit.tsx:73-75` with the same `getTokenClaims()` pattern `ReadIndex.tsx` uses.
- [ ] **Dead reader code sweep (R8).** Confirmed zero importers anywhere in `src/` for: `src/components/ReadPage.tsx`, `src/components/SinglePageRenderer.tsx`, `src/components/reader/ReadingStreak.tsx` (also on the DO-NOT-BUILD list), `src/components/read/TagFilter.tsx`, `src/components/read/EndOfArticle.tsx`, `src/components/read/ReadableCard.tsx`. `src/components/Reader.tsx` is still imported (`src/App.tsx`, rendered only under the dead `viewState === 'READER'` branch, `:1108`) but is unreachable since nothing ever calls `setViewState('READER')`. Delete `Reader.tsx` and its render branch too once R2-R4 above is resolved (it's the same legacy-progress-key writer named in R2). (hours)
- [ ] **Migrate the final 3 `.pill-*` action buttons, then promote lint Rule 9 to blocking.** All three are in `src/admin/views/PlatformAdminView.tsx`, confirmed by grep to be the only file left with `pill-primary`/`pill-destructive` classes: line 93 (`ConfirmButton`'s default `confirmClassName = 'pill pill-destructive-confirm'`, used by both the Suspend and Reactivate account buttons when armed), line 424 (Save-profile button, `className="pill pill-primary ..."`), line 500 (Suspend-account idle state, `idleClassName="pill pill-destructive"`). Migrate all three to `<Button variant="primary">` / `<Button variant="destructive">`. Then flip lint Rule 9 in `scripts/lint-colors.sh:191` from `check_pattern_notice` to `check_pattern_ere` (blocking) so `.pill-*` action classes can't return. (mins)

## Gated on launch decision

- None. Every open item in this track is a code fix an agent or Adrian can do solo pre-launch; nothing here depends on a real operator or user existing.

## Already shipped

- All 24 `FIX_QUEUE.md` fixes (PR #172).
- All 17 RSVP friction items (`RSVP_FRICTION_AUDIT.md`).
- All 37 April audit findings (`AUDIT_2026-05.md` era).
- Design-system Phases A-D (`DESIGN_SYSTEM_PHASING.md`).
- June structural remediation: verify-code echo gated behind `DEV_RETURN_VERIFY_CODES` (`worker/src/index.ts:9867-9868`), CI lint gates.
- UI consistency Rules 1, 3, 8 lint-enforced and blocking; Rule 9 lint-enforced as a notice (`scripts/lint-colors.sh:70-193`), promoting it to blocking is the one remaining item above.
- P4 (silent Compass draft-promotion failure), fixed in commit `470c8025` ("fix(china): retry GFW timeouts, self-healing compass sync, unblock uploaded media"). `useCommitAndPromote.ts`'s `promotionError` is now read and rendered as a "Saved on this phone, drafts will update when the connection returns" toast (`src/components/TeaCompass/index.tsx:114,123-127,1539-1544`). The consolidated direction's open-item list is stale here; no build task needed.

## Sources

- `docs/AUDIT_2026-07_READ_CURATE_CHINA.md` (live, Read/Curate/China findings)
- `docs/_archive/consolidated-2026-07/AUDIT_2026-05.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/FIX_QUEUE.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/FRICTION_REVIEW.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/VISUAL_REVIEW.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/RSVP_FRICTION_AUDIT.md` (archived, shipped)
- `docs/UI_CONSISTENCY.md` (live, Rule 9 promotion still open)
- `docs/_archive/consolidated-2026-07/DESIGN_SYSTEM_PHASING.md` (archived, shipped)

## Cross-track dependencies

- K1 and the per-order detail page are also tracked in Track 6 (Commerce in the Inquiry Model), items owned here: Track 1 is the source of truth for the fix, Track 6 tracks it because it's the commerce trust floor. Don't duplicate the fix in two places.
- Verification-code delivery is shared with Track 7: the implemented email leg serves sign-in and event/guest verification through one challenge/delivery abstraction. Local coverage is green; only deployed receipt evidence remains pending.
- The launch-program technical gates for Track 2 are closed locally. Onboarding the Australia operator still requires deployed OTP receipt evidence and the real operator run.
