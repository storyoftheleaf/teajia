# Handoff: wire the tea knowledge into everything else

## 2026-08-08 audit deltas

This handoff is historical. Steps 1 and 2 landed in PR #284 and are live. Migration 122
is applied to `teajia-db`, the public product API carries `cultivar`, and the wisdom band
renders on the quiet-card product page when a product has a cultivar recorded. There is
no `producer` product column: producer is resolved from the shared record rather than
stored on each product.

The Tea domain is no longer empty. It contains Adrian's Tea stance and several captured
claims. More importantly, the knowledge-system trust boundary changed: agents must
propose through `capture`, and must never call `knowledge_assimilate` directly. The
AssimilationBanner remains Adrian's human review gate.

Step 3 is now specified as a deterministic, manual, hash-based proposal sync in
`docs/_notes/tea-knowledge-final-integration.md`. It includes only substantive reference
records and Adrian-authored tea write-ups, uses capped review batches, and preserves the
source class and drafted/review status as provenance. Vocabulary, thin variety rows,
standalone region facts and teaware are excluded.

The importer uncertainty is narrowed to a reversible live draft rehearsal against a
real public vendor record. It must be abandoned after field verification, without
finalizing inventory. Cloudflare/Infisical credential work is explicitly out of scope.

Adrian approved all three steps, in this order. Start a fresh session for it.

## Why this exists
The tea wisdom base was built and four surfaces read from it: import, capture, the shop,
and the public reference at `/wisdom`. It is not yet connected to the two other places
knowledge lives: his own records, and his knowledge system.

His question was "what works best to integrate it into what I already have", and the
finding that answered it: **his knowledge system has a Tea domain with zero entries in it**,
while the app now holds 630 tea records. The module registry also lists teajia with a
stated next step of "Phase 1.3 integration endpoint". The slot has been waiting.

## Step 1: two fields on the live database

`worker/migrations/122_tea_wisdom_cultivar.sql` adds a `cultivar` column to `products` and
to `tea_compass_entries`. A `producer` column is also carried end to end in the code and
needs the same treatment; check whether 122 covers it or whether a second file is needed.

**The only database in the account is `teajia-db` (2dbafe5c-10db-4ac6-9f17-4292b5beffc9),
and it is the live one.** There is no lab, staging or preview. Adrian was told this and
said to proceed anyway, because the change only adds empty columns: nothing existing moves
and nothing breaks.

Apply with wrangler from `worker/`. Verify by reading the table shape back, not by trusting
the command's exit code.

**What it unblocks:** until this lands, an import can resolve a plant and a maker and then
cannot save either. The whole cultivar and producer path is built and stops at the door.

## Step 2: the knowledge stays in the app

No work. This is recorded so nobody moves it later without knowing why.

The base is read on every page load by four surfaces. A database round trip would slow the
shop for no gain and break offline use, and the code form is what has been catching drift
all day through type checking. The database holds pointers into the knowledge, not the
knowledge itself.

## Step 3: feed the Tea domain

The knowledge system exposes `knowledge_assimilate`, `knowledge_read`, `knowledge_search`
and `knowledge_provenance` over its own interface, with a Tea domain that is empty today.

**Show Adrian the shape before writing anything.** He asked for that explicitly. Questions
worth deciding with him rather than for him:

- What becomes a claim: every one of the 630 records, or only the plants and places that
  carry real prose? Six hundred thin claims may be worse than eighty good ones.
- Where provenance points. Every entry in the base is on the "drafted from research" rung
  and none has been reviewed. That should survive the crossing rather than arriving as
  settled fact.
- Whether it syncs or is written once. The base is rebuilt from source files by
  `scripts/build-wisdom.mjs`; a claim written once will drift the first time a record is
  corrected.
- Whether the shop's own 303 tea write-ups belong there too. They are Adrian's own voice
  and the strongest material he has, and they are currently only markdown files.

## State when this was written
Branch `import-destination-options`, 43 commits, open at
https://github.com/technicianofthesacred/teajia/pull/284

All checks pass: 1,368 unit checks, the import and inventory browser tests, a clean build.

## Also still open, unrelated to this
- Production notes and descriptions on import are unverified against a real vendor record.
  The extractor was taught to write them; only a real import proves it.
- A separate design pass on the public reference is handed off in
  `reference-ui-handoff.md`: rows need visible separation and the column needs to be wider.
