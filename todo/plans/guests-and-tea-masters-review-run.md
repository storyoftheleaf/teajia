# Guests and tea masters: the review and revise run

Written by Fable on 2026-11-26 for Opus 5.5 to run. Adrian asked for it after Launches 1 to 5 were built: "After such a big build we need to make sure it's all working well together", and then: "Anytime I have to click three or four times instead of one or two, we should consider better how to lay out or interconnect. Especially when it comes to entering things."

The worker messages are in [review-prompts/](review-prompts/), one file each, ready to send as they are.

## What already works, and what nobody has checked

Each launch was built behind its own switch, walked in the browser on its own, and reviewed on its own (ten reviews, copied to `todo/review/earlier/` in step O1). Launch 1 is open on the live site. Launches 2 to 5 are live or going live closed (PR 560).

Four things have not been checked by anyone, and they are what this run is for.

1. **The seams.** No walk takes one person through all five launches. Most of the browser walks mock the worker (`tests/launch-4-journey.spec.ts` mocks every route), so they prove the screens and not the agreement between site and worker. Only `tests/launch-5.spec.ts` runs against a real local worker.
2. **The switch states in between.** There are fifteen switches and Adrian will open them one at a time. The one in-between state anyone looked at had a hole (row 4.20: HOME_BAR open with TEA_HOUSES closed sends "tea house" to a 404). The code holds more dependencies than the plan lists: ANYONE_HOSTS, CIRCLES, HOST_TOKENS and YOUR_TABLE_PLACE each need FEW_HOSTS; credit is recorded only while HOST_CREDIT is open; photograph credit rides on TEA_TABLE.
3. **Older rows.** Every fixture is fresh. The live shop has sessions, guests, guest book entries, tastings and orders written before migration 0128.
4. **Ease.** Nobody has counted taps or fields.

## The hard questions, settled first

**Mocked or real worker for the walks?** Real. The seams are the point. `tests/launch-5.spec.ts` already shows the pattern (one state folder, a worker and a site per switch state), and `worker/sandbox/offline-fixtures.mjs` already loads all four fixtures together and passes every worker switch. HOME_BAR is a site-only switch. *Smallest check, first hour of O1:* start one worker and site with all fifteen switches on, sign in as mei, ana and sandbox. If the fixtures do not live together with everything open, that is the first finding and O1 repairs the fixture before anything else starts.

**Which switch states?** Not all 32,768. The ones that will really happen: as live now; everything on; each switch on alone (this finds what each one silently needs); and each step of the opening order. About thirty states, run by one crawler (W4). The opening order is drafted below and Astra's A10 confirms or corrects it.

**Older data without the live database?** A cloud session cannot read the live shop, and the Mac blocks writes. So Astra builds an "old shop" in a test: migrations to 0127, rows written the way the code before commit `30e1ca7` wrote them, then 0128 to 0147 on top. *One extra check if the Mac is reachable:* a read-only census of the live database, counts only (how many sessions have no door, no host, no timezone; how many guest book entries have no name choice; how many shared tastings exist). No names, no rows. O2 runs it and hands the counts to A6.

**Site and worker open at different moments.** A switch is one constant, but Pages and the worker deploy separately. For some minutes one is open and the other closed. A10 walks every switch half-open. Fable's recommendation if it finds holes: every site door for a closed-by-default part treats a 404 from its own route as "not here yet" and renders nothing, in one shared helper, instead of fixing each page. Validate by rerunning A10's half-open spec.

**How much is a tap budget?** Two taps to reach anything from Home or from the page of the thing it belongs to. For entering: only what the site cannot know. The walks count automatically through one helper, so the numbers come from runs and not from reading code.

**Where fixes land.** Branch `build/review`, cut from `main` once PR 560 has merged (from `build/launch-5` until then). Each fix is a PR into `build/review`. Nothing reaches `main` without Adrian's "ship". Because every switch is closed, most fixes change nothing a visitor sees; anything that does change the live site with the switches closed is listed apart on the ship card.

## The slices

Sixteen in the find phase. Twelve go to Codex (six Sol, six Astra, plus Sol's U1 makes thirteen), three to Opus and its Sonnet helper.

| Id | Who | What | Starts | Message |
|---|---|---|---|---|
| O1 | Opus | The rig, the findings folder, the earlier reviews copied in | now | below |
| O2 | Opus | Live check with switches closed; bundle and query headroom; the census | when PR 560 is live | below |
| O3 | Sonnet | The contact sheet and the documents | after O1 | below |
| A6 | Astra | Older data | now | [astra-a6-older-data.md](review-prompts/astra-a6-older-data.md) |
| A7 | Astra | One private fact, every door | now | [astra-a7-one-fact-every-door.md](review-prompts/astra-a7-one-fact-every-door.md) |
| A8 | Astra | Tea credit under overlap and retry | now | [astra-a8-credit-ledger.md](review-prompts/astra-a8-credit-ledger.md) |
| A9 | Astra | Seats, doors and time | now | [astra-a9-seats-and-time.md](review-prompts/astra-a9-seats-and-time.md) |
| A11 | Astra | One action, three ways in | now | [astra-a11-three-ways-in.md](review-prompts/astra-a11-three-ways-in.md) |
| W5 | Sol | Empty, failing and signed out | now | [sol-w5-empty-and-failing.md](review-prompts/sol-w5-empty-and-failing.md) |
| W6 | Sol | The standing rules, across everything new | now | [sol-w6-standing-rules.md](review-prompts/sol-w6-standing-rules.md) |
| A10 | Astra | Opening, closing and half-open | after O1 | [astra-a10-open-then-close.md](review-prompts/astra-a10-open-then-close.md) |
| W1 | Sol | The guest, start to finish | after O1 | [sol-w1-guest-walk.md](review-prompts/sol-w1-guest-walk.md) |
| W2 | Sol | The host, start to finish | after O1 | [sol-w2-host-walk.md](review-prompts/sol-w2-host-walk.md) |
| W3 | Sol | The owner, in Manage and by tool | after O1 | [sol-w3-owner-walk.md](review-prompts/sol-w3-owner-walk.md) |
| W4 | Sol | Every switch state, every door | after O1 | [sol-w4-switch-crawl.md](review-prompts/sol-w4-switch-crawl.md) |
| U1 | Sol | The tap ledger | after W1 to W4 report | [sol-u1-tap-ledger.md](review-prompts/sol-u1-tap-ledger.md) |

**Wave one, today, all at once:** O1, A6, A7, A8, A9, A11, W5, W6. None needs the rig and none touches a file another owns.
**Wave two, the moment O1 is merged into `build/review`:** A10, W1, W2, W3, W4, O3. Each has its own rig slot.
**Then:** U1, and the triage.

### Running the workers

Sol is `gpt-6.2-sol`, Astra is `gpt-6.2-astra`, through Codex on Adrian's Mac (project memory "codex-on-adrians-mac": the ChatGPT app's own CLI, a sibling worktree per worker, `-s workspace-write` for these since they write tests, and the Remote Control session commits and pushes for them). Run up to six at once on the Mac.

Do not wait on the Mac. If Remote Control is silent for twenty minutes, move whatever was running there to cloud builders with the same message unchanged: Astra's slices to an Opus 5.5 builder, Sol's to Sonnet 5.5. Say in the findings file's first line which model did it.

### O1 (Opus): the rig

Small, and everything in wave two waits on it, so do it yourself and do it first.

- `build/review` from `main` (after 560) or `build/launch-5`. Merge `claude/project-thread-hwmraj` into it for this sheet and the messages.
- `scripts/review-rig.mjs --set <set> --slot <n> [--site-set <set> --worker-set <set>]`: wraps `worker/sandbox/offline-fixtures.mjs` and a Vite site, one state folder per slot, worker on `8900 + 10n`, site on `7900 + 10n`, prints `REVIEW_SITE` and `REVIEW_API`. Never port 7777.
- `tests/review/switch-sets.ts`: `live`, `all`, `only:<SWITCH>`, `upto:<SWITCH>`, with the opening order below as data.
- `tests/review/review.config.ts`: projects phone-320, phone-390, desktop-1280, reading `REVIEW_SITE`.
- `tests/review/helpers.ts`: `signIn`, `noSideScroll`, `quiet`, and `task(page, name, budget, fn)` which counts clicks, fields filled and address changes and appends to `test-results/review/steps.json`.
- `tests/review/README.md`: how to start it, in ten lines.
- `todo/review/findings/` (empty) and `todo/review/earlier/` (the ten files from the project's shared folder `guests-build/`).
- A sessions fixture gap to close while there: the walks need one table in each time (ahead, on now, finished) with times relative to now. `few-hosts-fixture.mjs` has ahead and finished; add "on now".
- Check: the "smallest check" above, then `tests/launch-5.spec.ts` still passes through the rig's ports.

### O2 (Opus): the live site with every switch closed

Once PR 560 is live. Read-only.

- Every route in `worker/src/launch4Closed.ts` and the Launch 3 and 5 gated routes answers 404 on the live API. `/mcp` `tools/list` is the same as before 560. `/mcp/public` is unchanged.
- Migrations 0130 to 0147 are applied; the append-only triggers of 0143 exist.
- The worker bundle is 936 KiB gzip against 877 before. Find the account's limit and say how much room is left; if under 15 percent, list the three largest new modules.
- For the ten most-called new reads (Tea Table list, favourites list, Journey sessions, a hosted table's page, credit balance, Know this tea), run `EXPLAIN QUERY PLAN` on the local fixture database and flag any full scan of a table that will grow.
- The census for A6, if the Mac is reachable.
- `worker/tests/curate-holdings-read-budget.test.ts` fails on main too (30207 against 30000). Decide: raise the budget with a reason, or fix the read. It is not part of this build but it is a red test on every run.

### O3 (Sonnet): the contact sheet and the documents

- One page for Adrian to flip through: every new screen at 390 and 1280 with everything open, grouped by guest, host, owner, in walk order, from the walks' screenshots plus W5's four states. Published as one artifact. This is the one thing Adrian is asked to look at.
- `docs/PILLAR.md`, `docs/SECTIONS.md`, `docs/STATE_OF_THE_SITE.md`, `docs/CHANGELOG.md` and the living page say what was built and which switch holds each part. List every sentence that is no longer true; fix them in the revise phase.

## The opening order (draft, for A10 and W4 to confirm)

FEW_HOSTS, ANYONE_HOSTS, FAVOURITES, YOUR_TABLE_PAGE, YOUR_TABLE_PLACE, TEA_TABLE, TOP_TEAS, HOST_ARTICLES, TEA_HOUSES, HOME_BAR, HOST_CREDIT, CIRCLES, HOST_TOKENS, TABLE_CARD, KNOW_THIS_TEA.

Reasons: hosting before anything a host uses; a person's own things before the public page; TEA_HOUSES before HOME_BAR because of row 4.20; credit after hosts exist and before circles, since credit touches money and should open alone. The run ends with this list made true: one line per switch saying what must be open first and which walk proves it.

## Triage (Opus, with Fable for the uncertain ones)

When wave two reports, put every finding in `todo/review/ledger.md`: id, severity, one sentence, owner, state. Merge duplicates (the walks and the audits will find the same hole from two sides; keep the one with the better evidence). Then sort each into one of four:

- **Fix now:** every S1 and S2, and every S3 that is over the tap budget on a task a first-time guest or host does.
- **Fix with its switch:** matters only when one switch opens. Goes on that switch's line in the opening order.
- **Adrian's:** needs his word. Goes in one batch (below). The work around it carries on with the recommended option.
- **Leave:** with the reason, in one line.

Send to Fable anything where the approach is the question: a finding whose fix changes a shared interface, the half-open rule, credit rules the code never decided, and every layout change proposed by U1 that moves a door or changes a page's shape. Navigation words and bar links are never changed without Adrian's yes.

## Revise

Group fixes by the files they touch so no two workers hold the same file, then send them in parallel.

- **Sol** gets a fix when the finding names the file, the expected behaviour and the failing test. One message per group of findings in one area. Template: [fix-sol.md](review-prompts/fix-sol.md).
- **Astra** gets a fix when the finding came from A6 to A11 and the fix must hold under the same overlap, older data or second way in. The slice that found it fixes it. Template: [fix-astra.md](review-prompts/fix-astra.md).
- **Opus** keeps: anything in a shared interface (`src/lib/api.ts`, `src/types.ts`, the switch files, `worker/src/mcp.ts`, `navSections.ts`), fixes under twenty lines where a message would cost more than the change, and the U1 layout changes once Fable and Adrian have settled them.

A fix is done when the test that found it passes, the walk it belongs to passes at three sizes, and the reviewer that found it (not the one that fixed it) has reread the diff.

## The gate

- No S1 or S2 open.
- W1, W2 and W3 pass with everything on and as live, at 320, 390 and 1280.
- W4's table is complete with no dead door in any state.
- A6 to A11's tests pass and are kept in the suite.
- Every row of the tap ledger is within budget, or is on Adrian's list with a mock-up.
- The walks and the crawl run in `.github/workflows/playwright.yml` as one job, so the next change to any launch is checked against all five.
- Lint, `lint:colors`, `lint:worker-types`, `test:mobile` and the worker suite as the launch gates had them.

Then one ship card to Adrian for `build/review`.

## What Adrian is asked

Once, in one batch, after triage: the contact sheet to flip through, the tap ledger's worst ten with a proposed change beside each, and the product questions the reviewers raised (expected from A8: a host ordering from their own thank-you, credit coming back on a Void, orders Filled while credit was closed; from A9: what guests of a stopped host see). Each with a recommendation already being built. Added to the feedback page he already has.
