# TODO — Teajia follow-ups

Living document for work that's planned, planned-but-unstarted, or
still-an-idea. Organized by commitment level: **Ready to build** work has an
agreed shape; **Ideas — for review** is where unfinalized thoughts park.

---

## How to add things here

Just edit this file. Sections are in descending order of commitment, so
the higher up something sits, the closer it is to being built. Drop new
items under whichever section matches their confidence level; they can
move up/down as plans firm up or get shelved.

- **Committed / Ready to build** — scope agreed, just needs to be done.
- **Ideas — for review** — loose concepts worth considering. Review before
  committing; many of these will be reshaped or dropped.
- **Loose ends** — known corner cases, small cleanups, known-buggy
  state that won't block anything but should be resolved when convenient.
- **Deployed infrastructure state** — reference only; what's live.

In future sessions, ask Claude to "add X to the Ideas section of
docs/TODO.md" and it'll slot it in. Claude will also move items between
sections as plans firm up.

---

## Committed / Ready to build

### Phase 2 — Per-section voice capture

Voice notes tagged with which section of the tasting they came from, so the
NotesPanel groups them contextually.

- [ ] Add a section-scoped mic affordance in each of Flavor, Feeling, Body,
      Finish (in addition to the existing NOTE-tab press-and-hold).
- [ ] Section-captured notes write with `section: 'flavor' | 'feeling' | ...`
      metadata. The `NoteEntry.section` field in `src/types.ts` already
      exists — just needs the capture + rendering wire-up.
- [ ] Group notes in `NotesPanel` by section with header labels.
- [ ] Migration: notes captured pre-feature stay `section: undefined` and
      render under a "General" header.

### Phase 2b — Customer starring in Compass journal

Prerequisite for Phase 3. Without customer-side stars there's nothing for
admin to review.

- [ ] Compass journal entry view: for each note in a tasting, show a star
      toggle. Starring is private to the customer until an admin promotes.
- [ ] Persist starred flag on the customer's `tasting.notes[]` via the
      existing journal sync path.
- [ ] Copy above the starred section setting expectations ("These are
      candidates for Adrian's review").

### Phase 3 — Admin community-stars review queue

Once customers can star their own journal notes, admin gets a queue to
promote the good ones onto product tastings.

- [ ] New admin surface: `/admin/community-impressions` (or tab inside the
      existing admin panel). Lists customer-starred notes across all
      products, grouped by product.
- [ ] Each row: customer's initial/account, text, product, captured date,
      **Promote** button.
- [ ] Promotion flow: opens a small editor pre-filled with the customer's
      text. Admin polishes, clicks Save. The note inserts into the product's
      `tasting.notes[]` with `starred: true` and `sourceAuthor: { initial,
      accountName }` set.
- [ ] Promoted notes render on the `AlcoveCard` Impressions block with
      attribution (the `— M., Oct 2026` styling is already wired).
- [ ] **Dismiss** action on queue entries to hide suggestions you don't
      want to promote, without touching the customer's journal.

---

## Ideas — for review

Loose concepts. Think through before building; some will be dropped or
reshaped. If you want to commit one, move it up to *Committed*.

### Section header in the review/notes panel
If you accumulate 15+ notes on a tea over time, a flat list gets hard to
scan. Group them by capture date or section. Only worth building if note
counts actually grow that far — lightweight as an idea.

### Promotion of community-starred journal entries
(This is Phase 3 above — listed here if we want to reconsider scope.)
The data shape already supports `sourceAuthor` attribution and the Impressions
block renders it; what's missing is the admin review queue UI.

### Drafts status cleanup
The `Draft` product status and the `is_public` boolean are partially
redundant (both can hide a product from the public shop). Consider
consolidating: either drop `Draft` and rely on `is_public = 0`, or keep
`Draft` only for truly unfinished product entries and enforce that any
non-Draft product needs `is_public` explicitly set. See Loose ends for
the open question.

---

## Loose ends

Not urgent, but worth resolving when convenient.

- [ ] The 3 Bali products currently stamped `tasting_source='common'` are
      all status `Draft`, so the public storefront filter hides them.
      Decide per-product: promote to Active or clear the stamp.
- [ ] Decide whether `Draft` status is still needed (see Ideas → Drafts
      status cleanup). If kept, document when to use Draft vs `is_public
      = 0`.
- [ ] "Untasted" admin filter currently bundles "never reviewed" with
      "on community data — upgrade to your voice". One-line filter change
      if you want to split them.
- [ ] Local D1 migration tracker was bulk-marked during recovery. Any
      future local migrations will skip properly, but if you ever need to
      re-run an old migration locally, the tracker will block it. Solve
      by dropping + recreating local D1 when convenient.

---

## Deployed infrastructure state

Reference only; what's live in production.

- Remote D1 column `products.tasting_source` added via migration
  `038_inventory_tasting_source.sql` (worker-side).
- Worker `PUBLIC_FIELDS` allowlist includes `tasting_source`.
- Worker update-handler allowlist includes `tasting_source`.
- Defensive stamp: any admin write that omits `tasting_source` gets
  stamped `'owner'` when tasting has terms (see
  `TODO(second-writer)` comment in `worker/src/index.ts`).
- Edge cache on `/api/s/:slug/products` lowered from 60s → 10s for
  quicker admin feedback.
- Optimistic cache patch on save hits both `['products', 'public']` and
  `['storefront', 'products', slug]` query keys so edits reflect
  regardless of which storefront path is active.
