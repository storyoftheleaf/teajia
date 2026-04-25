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

### Collector-tier platform (the bigger vision)

Teajia isn't just a storefront. Other tea makers / collectors have the
same collection-management need Adrian does — they have shelves of tea
they're not selling but want to track, taste, and keep personal notes on.
Same tasting infrastructure, same Impressions, same inventory tools, but
with the public storefront optionally turned off or limited.

Open questions worth sitting with before scoping:

- Do collectors sign up as their own *Account* (like a store), or as a
  *Member* with a richer private inventory surface?
- If Account-level: what's the onboarding shape when commerce isn't the
  goal? The current account setup leans heavily on shop/WhatsApp flow.
- How does tasting data flow between a collector's private inventory and
  the community/network layer (if at all)? Do their starred impressions
  help other collectors, or stay fully private?
- Pricing model for non-commercial users — flat fee, per-tea, free tier
  with limits?
- Does `is_personal = 1` at scale mean we need a view that treats "my
  collection" as a distinct surface from "my shop," not just a filter?
- Naming: we already have "Your Table" as the personal panel. Does that
  extend, or does a collector deserve their own top-level workspace
  (e.g. "My Cellar" or "My Archive")?

Not ready to build. Revisit when the immediate tasting work settles;
could become its own multi-quarter product track.

### Section header in the review/notes panel
If you accumulate 15+ notes on a tea over time, a flat list gets hard to
scan. Group them by capture date or section. Only worth building if note
counts actually grow that far — lightweight as an idea.

### Promotion of community-starred journal entries
(This is Phase 3 above — listed here if we want to reconsider scope.)
The data shape already supports `sourceAuthor` attribution and the Impressions
block renders it; what's missing is the admin review queue UI.

### (resolved) Drafts vs is_public
Not redundant — these carry different intents:
- `status = 'Draft'` → workflow state: "still being filled in, incomplete."
- `is_public = 0` → visibility state: "complete product, but not for
  public sale." Adrian uses this to manage his personal tea collection
  through Teajia without listing it on the storefront.
- `is_personal = 1` → ownership state: "my own collection, not catalog."

Keep all three. No consolidation needed.

---

## Loose ends

Not urgent, but worth resolving when convenient.

- [ ] The 3 Bali products currently stamped `tasting_source='common'` are
      all status `Draft`, so the public storefront filter hides them.
      Decide per-product: promote to Active or clear the stamp.
- [ ] For each of the 3 `common`-stamped Drafts, decide: finish the
      product data and promote to Active, or keep as personal reference
      (set `is_public = 0` + `is_personal = 1`, status Active).
- [ ] "Untasted" admin filter currently bundles "never reviewed" with
      "on community data — upgrade to your voice". One-line filter change
      if you want to split them.
- [ ] Local D1 migration tracker was bulk-marked during recovery. Any
      future local migrations will skip properly, but if you ever need to
      re-run an old migration locally, the tracker will block it. Solve
      by dropping + recreating local D1 when convenient.
- [ ] Local D1 is missing the `inquiries` table entirely (migration
      `045_inquiry_source` failed locally with `no such table: inquiries`,
      but ran clean on remote). Symptom of the bulk-marked tracker above.
      Ties into the same drop-and-recreate fix.
- [ ] **Advise project images.** `AdviseProject.heroImage` and `gallery`
      are wired up in `src/types/advise.ts`; the views in
      `src/components/advise/{Projects,ProjectDetail}.tsx` render real
      `<img>` when present and fall back to a minimal SVG placeholder
      (initial + type label, in `ProjectPlaceholder.tsx`) when not.
      Populate `heroImage` (and optionally `gallery`) in
      `src/data/adviseProjects.ts` once real images are ready for the
      10 projects.

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
