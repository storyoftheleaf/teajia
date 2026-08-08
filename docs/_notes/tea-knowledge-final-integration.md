# Final tea-knowledge integration brief

## 2026-08-08 audit deltas

- PR #284 is merged and live. Migration 122 is applied. The storefront's cultivar path
  works end to end, but no live product currently has a cultivar value.
- The Tea belief shard is not empty anymore. It already records Adrian's brand stance
  and several captured Tea claims.
- The current i64os trust boundary forbids agents from calling `knowledge_assimilate`
  directly. Every proposal must enter through `capture` and wait in the
  AssimilationBanner for Adrian's click.
- The old Phase 1.3 Teajia integration endpoint is superseded by the live MCP routing.
  Do not revive it.
- The public reference design follow-up already landed. Do not reopen it.
- Cloudflare credentials and Infisical are outside this task. Do not inspect, print,
  move, duplicate or document any token.

## Outcome

Finish the two remaining verification gaps from the wisdom integration:

1. Build a repeatable, manual proposal sync from Teajia's substantive tea knowledge to
   i64os's human-reviewed Tea capture queue.
2. Rehearse the live Curate importer against one real public vendor record, verify that
   description and processing notes survive extraction, then abandon the draft without
   creating inventory.

This is integration plumbing for Adrian, not a user-facing AI feature.

## Part A: deterministic Tea proposal sync

### Sources included

Build a deterministic manifest from these source classes:

- Cultivars whose `src/wisdom/stories/cultivars.json` entry contains at least one
  non-empty narrative field. The current source set contains 79 cultivar stories.
- Producers, styles, marks and named teas only when their generated record has a
  non-empty `description`.
- Product markdown under `products/`, excluding `products/teaware/`. This currently
  yields 187 Adrian-authored tea write-ups, including `products/misc/yaobao.md`.

Exclude standalone regions, vocabulary and the 316 thin variety rows. Region facts may
travel as context or provenance on an included claim, but must not become their own thin
claims.

### Manifest contract

Each proposal must carry:

- a stable proposal id derived from source class and stable record/file id;
- domain `Tea`;
- a concise claim suitable for the knowledge Library, not a dump of the source record;
- source class: `reference-research` or `adrian-authored-product`;
- source reference: the public `/wisdom/...` URL for reference entities, or repository
  path plus commit SHA for product markdown;
- authorship/review status. Reference research remains `drafted` and unreviewed. Product
  prose is Adrian-authored, but must still wait for capture approval;
- SHA-256 of the canonical source payload;
- source excerpt sufficient for Adrian to judge the proposal without reopening the file.

Sort output stably. Re-running against unchanged sources must produce byte-identical
manifest content and must not enqueue duplicates.

### Sync behavior

- The sync is manual and repeatable after `scripts/build-wisdom.mjs` changes the base.
- Default to preview. Preview reports included/excluded counts, new proposals, changed
  proposals and unchanged proposals without writing anything.
- Apply enqueues only new or source-hash-changed proposals through i64os `capture`.
- Hard-cap each apply run at 25 proposals so the AssimilationBanner remains reviewable.
- Persist only non-secret sync state needed for idempotency. Do not write canonical
  knowledge and do not auto-approve captures.
- Prefer a small project script over a permanent service or scheduled job. This corpus
  changes rarely and does not justify runtime infrastructure.

### First run

Generate the complete preview manifest and prove determinism. Then apply at most the first
25 proposals. Stop with those captures waiting for Adrian. Do not approve them on his
behalf and do not enqueue the remaining corpus in this task.

## Part B: real vendor import rehearsal

Use this public source:

`https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake`

It is suitable because it names the village, producer/brand, spring 2025 harvest,
primitive small-leaf population, 250 g cake, hand wok fixing, stone pressing,
low-temperature drying and current price variants.

### Rehearsal rails

- Use the live Curate import UI with Adrian's existing authenticated browser session.
- Paste a clean factual extraction from the vendor page and include the source URL in
  the pasted evidence.
- Let the deployed analyzer create the draft. Do not edit the extracted description or
  processing notes before inspecting them.
- Verify at minimum: name, category, type, year, origin region, cultivar/plant wording,
  producer/vendor resolution, pack weight, price, description, processing notes, source
  excerpt and field provenance.
- Capture a screenshot or durable text record of the result and note any mismatch in the
  brief before changing code.
- Do not finalize. Abandon the import draft after verification so no product, inventory
  receipt, vendor or sourcing run is created.
- If description or processing notes are absent or materially wrong, diagnose and fix
  only that extraction path, add a focused regression fixture from this record, deploy
  the Worker manually if worker code changed, repeat the rehearsal, and abandon the new
  draft afterward.

## Verification

For Teajia changes:

- `npm run lint`
- `npm run lint:colors`
- `npx vitest run src worker/tests`
- `npm run build`
- browser-check the Curate rehearsal at mobile and desktop widths with no console errors
  or horizontal overflow

For i64os changes, run the focused capture/importer tests and the relevant project
typecheck. Prove preview determinism by generating twice and comparing bytes. Prove
idempotency by applying the same manifest twice and showing that the second run enqueues
zero proposals.

## Git and stopping point

Work in isolated branches in each repository if both repositories change. Use focused,
intentional commits. Do not combine unrelated local changes from either main checkout.

Success means:

- the complete deterministic proposal manifest exists;
- the first capped batch is waiting in the human review queue, not assimilated;
- a real vendor draft proves description and processing extraction, then is abandoned;
- all relevant checks pass;
- any changed deployable surface is live and browser-verified.

Then stop. Do not review the first 25 captures, populate cultivars on live products, run
later batches, fix deployment credentials, or continue into unrelated inventory work.
