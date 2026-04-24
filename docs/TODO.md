# TODO — Tasting feature follow-ups

Current state (as of commit `4ee2616`): admin tasting editor, owner-stamping,
Impressions block, and per-product review flow all live. The items below were
deferred from the initial build but should be picked up next.

## Phase 2 — Per-section voice capture

Goal: capture voice notes that are tagged with which section of the tasting
session they came from, so the review screen groups them contextually
("here's what you said about Flavor, here's what you said about Feeling").

- [ ] Replace the single `VoiceNoteField` in the tasting overlay with one mic
      affordance per section (Flavor, Feeling, Body, Finish).
- [ ] New notes captured via a section-specific mic write with
      `section: 'flavor' | 'feeling' | ...` metadata. The shape already
      supports this (see `NoteEntry.section` in `src/types.ts`).
- [ ] `NoteReviewPanel` should visibly group notes by section — the card UI
      already renders the label, but the list is flat today; add headers.
- [ ] Migration path: notes captured pre-feature stay `section: undefined`.
      Render them under a "General" header.

## Phase 2b — Customer starring in Compass journal

Prerequisite for Phase 3. Without customer-side stars there's nothing for
admin to review.

- [ ] Compass journal entry view: for each note in a tasting, show a star
      toggle. Starring is private to the customer until an admin promotes it.
- [ ] Persist starred flag on the customer's `tasting.notes[]` via the
      existing journal sync path.
- [ ] Optional: "These are candidates for Adrian's review" copy above
      starred-by-customer section so expectations are set.

## Phase 3 — Admin community-stars review queue

Once customers can star their own journal notes, admin gets a queue to
promote the good ones onto product tastings.

- [ ] New admin surface: `/admin/community-impressions` (or tab inside the
      existing admin panel). Lists every customer-starred note across all
      products, grouped by product.
- [ ] Each row shows: customer's initial/account, text, product, captured
      date, and a "Promote" button.
- [ ] Promotion flow: opens a small editor pre-filled with the customer's
      text. Admin polishes, clicks Save. The note gets inserted into the
      product's `tasting.notes[]` with `starred: true` and
      `sourceAuthor: { initial, accountName }` set.
- [ ] Promoted notes render on the `AlcoveCard` Impressions block with
      attribution (`— M., Oct 2026` styling is already wired).
- [ ] "Dismiss" action on queue entries to hide suggestions you don't want
      to promote, without touching the customer's journal.

## Loose ends worth revisiting

- [ ] The 3 Bali products currently stamped `tasting_source='common'` are
      all status `Draft`, so the public storefront filter hides them.
      Decide per-product whether to promote to Active or clear the stamp.
- [ ] `CartPanel.tsx` has two pre-existing unresolved references
      (`useSampleCartStore`, `SampleCartPanel`) that throw TS errors —
      not caused by this work but still in the tree. Worth resolving.
- [ ] "Untasted" admin filter currently includes products with no tasting
      at all AND products with non-owner source. If you ever want to split
      them (e.g. "Never reviewed" vs "On community data — upgrade to your
      voice"), it's a one-line filter change.
- [ ] Local D1 migration tracker was bulk-marked during recovery. Any
      future local migrations will skip properly, but if you ever need to
      re-run an old migration locally (e.g. for a schema test), the
      tracker will block it. Solve by dropping + recreating local D1 when
      convenient.

## Deployed infrastructure state

- Remote D1 column `products.tasting_source` added via migration
  `038_inventory_tasting_source.sql` (worker-side).
- Worker `PUBLIC_FIELDS` allowlist includes `tasting_source`.
- Worker update-handler allowlist includes `tasting_source`.
- Defensive stamp: any admin write that omits `tasting_source` gets
  stamped `'owner'` when tasting has terms (see
  `TODO(second-writer)` comment in `worker/src/index.ts`).
- Edge cache on `/api/s/:slug/products` lowered from 60s → 10s for
  quicker admin feedback.
