# Track 5: Curate & Personal Tea Memory

> One spine, two ends: Adrian's sourcing intelligence at `/admin/compass` and the member's quiet record at `/account/journal`. The one loop still open, human curation of starred notes, replaces reviews and ratings for good.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Shared-tea acceptance writes into Compass, not the Journal.** `handleCompassAcceptShare` in `worker/src/index.ts:10378` inserts the accepted share into `tea_compass_entries` (line 10404-10419), but the recipient lands on `/account/journal` which reads from the tasting-journal source of truth. Accepted shares never appear in the member's journal. (hours)
  - Fix at the handler: either write the accepted share into the journal table directly, or do this as part of the schema unification below and drop the special case.
- [ ] **Worker permission gate on the six Compass handlers.** `handleGetCompassEntries` (`worker/src/index.ts:8670`), `handleCreateCompassEntry` (8696), `handleUpdateCompassEntry` (8727), `handleDeleteCompassEntry` (8769), `handlePromoteCompassEntry` (8783), `handleSyncCompassEntries` (8974) all call `requireAccount` only, with no capability check. Add `requireBundle(request, env, 'catalog')` (pattern already used at `worker/src/index.ts:2051`, `2141`, `2515`) to each, and hide the Compass sidebar entry in the admin nav for accounts without the `catalog` bundle. (hours)
- [ ] **Schema unification: fold `tea_compass_entries` into `products`.** Two parallel tables exist for "tea I've touched": `products` (has `is_personal`, `status`) and `tea_compass_entries` (per-user rows, `draft_product_id` after auto-promotion). Unify to one table: a compass entry is a product with `is_personal=1`, `status='Draft'`. (multi-day)
  - One-time migration: every `tea_compass_entries` row with no `draft_product_id` becomes a `products` row (`account_id`, `created_by_user_id` carried over).
  - Orphan audit first: `SELECT COUNT(*) FROM tea_compass_entries WHERE account_id NOT IN (SELECT id FROM accounts WHERE owner_role = 'owner')`. If > 0, fold those rows into the migration instead of dropping them.
  - Drop `tea_compass_entries` or keep as a thin per-user view over `products` filtered by `created_by_user_id` and `is_personal=1`.
  - Rewrite the six handlers above as thin wrappers over `products`; `/promote` becomes a no-op.
  - Resolves the shared-tea write-target bug above as a side effect, since there's only one table left.
- [ ] **Currency symbol/label map consolidation.** Nine independent `CURRENCY_SYMBOLS` / `CURRENCY_LABELS` / `CURRENCY_MAP` object literals exist across Curate: `src/components/TeaCompass/LedgerPdf.tsx:14`, `LedgerOverviewPanel.tsx:10`, `PricingRow.tsx:27` (labels), `CaptureCard.tsx:75`, `BrowseCard.tsx:37`, `LedgerView.tsx:32`, `OrderSummary.tsx:17`, `IntentBar.tsx:16` (a differently-shaped reverse map), and `src/admin/components/SourcesView.tsx:282`. Extract one shared source (constants file), import everywhere, delete the duplicates. (hours)
- [ ] **Phase 2 — per-section voice capture in the Tasting Journal.** `NoteEntry.section` already exists in `src/types.ts:13` (`'flavor' | 'feeling' | 'body' | 'finish' | 'general'`) but nothing writes or reads it. `src/components/tasting/NotesPanel.tsx` has no section grouping today. (day)
  - Add a section-scoped mic affordance to each of Flavor, Feeling, Body, Finish (alongside the existing NOTE-tab press-and-hold).
  - Section-captured notes write with the `section` field set.
  - Group notes in `NotesPanel` by section with header labels; pre-feature notes with `section: undefined` render under "General".
- [ ] **Phase 2b — customer starring in the journal.** Prerequisite for the Phase 3 queue below; without customer stars there's nothing to promote. (day)
  - Journal entry view: star toggle per note, private to the customer until an admin promotes it.
  - Persist the starred flag on `tasting.notes[]` via the existing journal sync path (`src/lib/tastingJournalSync.ts`).
  - Copy above the section sets expectations ("candidates for Adrian's review").
- [ ] **Phase 3 — `/admin/community-impressions` promote/dismiss queue.** No route or handler exists yet (confirmed: no hits for "community-impressions" in `src/` or `worker/`). Depends on Phase 2b shipping first. (day)
  - New admin view listing customer-starred notes across all products, grouped by product; each row shows customer initial/account, text, product, date, and a Promote button.
  - Promote opens a small editor pre-filled with the customer's text; on save it writes into the product's `tasting.notes[]` with `starred: true` and `sourceAuthor: { initial, accountName }` (field already exists at `src/types.ts:17`).
  - Promoted notes already render on `AlcoveCard`'s Impressions block with attribution styling, `— M., Oct 2026`, so no reader-side work needed.
  - Dismiss action hides a suggestion from the queue without touching the customer's journal.

### Polish

- [ ] **Journal brief alignment, three small items** (from TASTING_JOURNAL_BRIEF, verified against `src/components/tasting/TastingJournal.tsx` and `src/components/AccountPanel/TastingJournalView.tsx`): (hours)
  - Sort labels: current UI renders three separate pills, "Recent" / "Rating" / "Type" (`TastingJournal.tsx:216-219`). Brief specifies a single cycling chip reading "Most recent · By tea · By rating". Decide: keep the three-pill pattern and just fix the copy, or build the cycling chip. Either way, "Type" should become "By tea" language-wise.
  - Empty-state link: both empty states (`TastingJournal.tsx:250-259`, `TastingJournalView.tsx:310-320`) render the correct copy ("The teas you taste will show up here...") but neither has the "Browse teas" text-link to `/shop` that the brief specifies.
  - Side-by-side note comparison on re-tasting: not implemented anywhere in the journal components. When a new tasting's values differ from the current note, the brief wants the user shown old vs. new values side by side to pick or merge, never a silent overwrite.
- [ ] **"My Tea Life" personal timeline.** Unify tastings, orders, favorites, events, and reading into one chronological archive (PA-REQ-004, POST_AUDIT B2). Genuinely new build, not a fix. No `personal_timeline` table or `/account/timeline` route exists today; the closest thing is the AccountPanel's Your Table preview. Sequence this after real users exist to have timelines worth showing. (multi-day)
- [ ] **Discovery deferred pair** (from `docs/TEA_DISCOVERY.md` "Remaining"): drift visualization in the Journey/Passport surfaces (the learned disposition is opt-in today but not shown as a trajectory), and per-article/per-product deep links in `recommendations.ts` (currently routes to section surfaces like `/craft`, `/shop` rather than a specific article or product). (day each)

## Gated on launch decision

- None. Every open item in this track is a code/schema fix or a build task Adrian can do solo; nothing here depends on onboarding a real operator or user.

## Already shipped

- Curate capture through Phase 11: photo/voice/parse/verdict/promotion flow, capture card redesigned (PR #268, `src/components/TeaCompass/CaptureCard.tsx`).
- Sample-minimum capture + permanent bag photos (migration `085_bag_photo.sql`).
- Tasting journal: one `CustomerTasting` per `(user × productId)` model, top-level note + `tastings[]` array.
- Tasting events: join codes, guest auth, control room.
- Tea Discovery Phases 1-2 + evolution loop: observed palate derived from the journal, opt-in "Adopt this" suggestions, "Still true?" re-ask (`docs/TEA_DISCOVERY.md`).
- Stock spine personal cellar (`is_personal` on `products`, migration `048_tea_profiles.sql`).
- Journal as the member surface: `/account/journal` is the live route; `/compass` redirects there for members (`src/App.tsx:1009-1011`); `/admin/compass` is the admin-only sourcing tool.

## Not building (killed)

- COMPASS_SOCIAL_PLAN Phase 1A/1B/1D (member connections), 2B/2C/2D (co-tasting, orders, feedback aggregation), 3A/3B/3C (QR table-share pages, taste-profile recommendation surfacing) — social/aggregation, contradicts the no-social, no-aggregation vision. The starred-notes promotion loop is the only survivor, deliberately reshaped as hand curation instead of algorithmic surfacing.

## Sources

- `docs/TODO.md` (Compass phases 2/2b/3, live)
- `docs/TEA_DISCOVERY.md` (live)
- `docs/_archive/consolidated-2026-07/tea-compass-spec.md` (archived, historical reference)
- `docs/_archive/consolidated-2026-07/COMPASS_SOCIAL_PLAN.md` (archived)
- `docs/_archive/consolidated-2026-07/compass-tasting-separation-followups.md` (archived)
- `docs/_archive/consolidated-2026-07/TASTING_JOURNAL_BRIEF.md` (archived)
- `docs/_archive/consolidated-2026-07/TASTING_EVENT_PLAN.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/POST_AUDIT_ROADMAP.md` (archived, B2 personal timeline)
- `docs/_archive/consolidated-2026-07/product-architecture-prd.md` (archived, PA-REQ-004)

## Cross-track dependencies

- The "My Tea Life" timeline touches Track 9's "one mental model for tea thoughts" (Journal / Collection / Cellar naming pass) — sequence the naming fix before or alongside the timeline build, not after.
- The starred-notes loop (Phase 2/2b/3) is the sole surviving community mechanism referenced by Track 8's kill list (`product_similarity` Jaccard cron, analytics tracking) as the reason those stay killed; no code dependency, just keep the two consistent if either changes.
