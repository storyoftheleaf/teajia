# Prime-time fixes — executing the audit's ten, conducted

**Source:** [docs/AUDIT-2026-09.md](../../docs/AUDIT-2026-09.md) (the report), the ten lines under "Prime-time audit" in [TODO.md](../../TODO.md), and [freight-default-lives-in-the-table.md](freight-default-lives-in-the-table.md) for item 1. Raw findings with reproduction steps and evidence live in the audit session's workflow journal; the report carries enough to reproduce each one.

**What done looks like.** Eight of the ten todo lines moved to `todo/archive.md`, each landed on `main` as its own commit with a test that goes red without the fix. Items 1 and 4 each paused for Adrian's page before their migration pushed. Item 6 still open, waiting on his answer.

## 2026-09-09 audit deltas

- The sandbox database in any new worktree starts empty; copy `worker/.wrangler/state/v3` from the main checkout or run `npm run sandbox:refresh`. The audit's probes left rows in the main checkout's copy (67 inquiries, 15 newsletter rows, AUDIT-prefixed teas), so refresh before verifying anything by eye.
- `worker/schema.sql` does not describe the live tables for `shipping_rate_per_kg` and `markup_multiplier` (item 1). Seed rehearsal databases from `worker/migrations/0000_initial_schema.sql` plus the later migrations, never from `schema.sql`, or the rehearsal proves nothing.
- `git checkout -- <file>` is blocked by a repo hook in this environment. Restore a mutated file from a saved copy.
- Ten concurrent lanes killed `wrangler dev` twice. One worker at a time against the sandbox, or give a second worker its own port.
- The Playwright suite needs the Bash sandbox off and `npx playwright install chromium` once per machine.

## Who does what

The conductor (Fable, this chat) writes each brief, dispatches, reads every result, and lands each item on `main` itself. Workers never push to main.

| Tier | Model | Job |
|---|---|---|
| Chain | Opus, effort high | the four money items, in sequence, because they share `worker/src/index.ts`, `worker/src/mcp.ts` and `worker/src/costCurrency.ts` |
| Fan-out | Sonnet | the five items with their own files, in parallel, each in an isolated worktree |
| Review | Opus | one reviewer per item: break the fix, watch its test go red, check the class was fixed and not the instance |

## Chain A, in this order (one at a time, each landed before the next starts)

1. **Item 5, provenance stamping.** `stampCostCurrencySource` on all eight write paths and both listing mirrors (MONEY-6, JOBO2-2). Smallest, and it unblocks the yuan decision. Test: every INSERT door with a stated currency lands `cost_currency_source='stated'` on products AND product_listings.
2. **Item 3, blank cost at four client doors.** CsvImportModal, intakeMapping, SampleSetCreator, TeaCompass types: a blank cost is sent as absent, never 0 (MONEY-4, JOBO2-1). Then fix the guard test so deleting the `throw` in `create_tea` goes red (MONEY-12).
3. **Item 4, currency labels.** One alias map for the admin (import the worker's `CURRENCY_ALIASES` or move it to a shared module), replace the eight exact lookups, stop `update_tea_pricing` uppercasing, widen the `Currency` type honestly (JOBO-2, MONEY-5, MONEY-10). The row correction for the 21 teas is a data migration: **publish the page and send Adrian the link before pushing it.**
4. **Item 1, the table rebuild.** Follow the plan file. **Page to Adrian before the migration pushes.** Rehearse against the migration-seeded database twice.

Also in the chain, because it is `mcp.ts`: the `create_tea` default type half of item 10 (MONEY-8).

## Fan-out B, parallel, one worktree each

- **Item 2, CI gates** (TEST-1, TEST-2): `.github/workflows/*.yml`, `package.json`. On every push and PR to main: `npm run lint`, `npm run lint:colors`, `npm run build`, `npm run test:worker`, the full Playwright suite (or a deliberately chosen subset that includes inventory-scroll). Prove it: the reviewer reintroduces the JSX comment and the lane goes red.
- **Item 7, public write brakes** (SEC-1, SEC-2, SEC-5): `handleCreateInquiry`, `handleNewsletterSubscribe`, `enforceDurableLimit`. Durable limiter on both, length caps on every field, and an absent binding refuses instead of allowing. Touches `index.ts` in regions the chain does not; rebase before landing.
- **Item 8, wholesale per-gram** (MONEY-3): `handleNetworkCatalog` selects `quantity_purchased` and divides. Test with a 2,000 g cake.
- **Item 9, draft articles** (JOBC-2): the fourteen article pages under `src/pages/read/` gate on publish status the way `ReadIndex.tsx` does; a direct URL to a draft shows not-found for a visitor and the page for an owner.
- **Item 10, streak counter** (OPS-3): remove `calculateStreak` and its render from `LearnCurriculum.tsx`.

## Waiting on Adrian

- **Item 6, the grid price** (JOBC-1). Ask once, with the recommendation (grid uses `quoteGrams()` for its default weight). Do not build until he answers.

## Rails for every worker

- Step one: reproduce the finding on this checkout. If it does not reproduce, report and stop.
- A fix ships with a test that goes red without it. The reviewer proves this by reverting the fix and running the test.
- Fix the class: grep for every site sharing the cause, list what was found at each.
- `npm run test:worker`, `npm run lint`, `npm run lint:colors` green before handing back. Rebase onto current `origin/main` and rerun before the conductor lands it.
- No file outside the item's named files without saying why.
- No migration with UPDATE, DELETE or INSERT pushes before Adrian has seen its page.
- Never touch `api.teajia.com`. Verify in the sandbox.

## When an item lands

Move its TODO line to `todo/archive.md` in the same commit. Item 1's plan file moves to `todo/plans/archive/`.
