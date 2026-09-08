# Prime-time audit — the whole of Teajia, in one night

**What it is for:** find every place Teajia is not ready for real customers and real operators, across code, security, data, UX and ops, and hand Adrian one ranked list he can read in ten minutes.

**What done looks like:** one page (`docs/AUDIT-2026-09.md` plus a published artifact) with a readiness score per area, every finding verified by a second agent, ranked P0 to P3, and the top ten already filed as todo lines with plan files where they earn one.

**How it runs:** the old overnight `nohup` script is retired. This runs as a Workflow in a live Claude Code session: a script that fans out agents by lane, pipelines each lane's findings straight into a verifier, then hands the verified set to the conductor for synthesis. It needs the laptop awake and the window open for roughly three hours. It does not need Adrian.

## What already exists, so the audit reads it instead of rebuilding it

- `docs/STATE_OF_THE_SITE.md` scorecard, verified 2026-08-10 and a month stale.
- `docs/LAUNCH_VALIDATION.md`, the only checklist for human and deployed-environment checks. The audit does NOT duplicate it; it reports which items an agent can now close and which cannot.
- `docs/tracks/08-platform-hardening.md`: the shipped hardening list. Every claim there is re-measured, not trusted.
- Guards already in the repo: 95 worker test files, 49 Playwright specs, `lint:colors`, `audit:china`, `test:platform-hardening`, `check-mcp-token-hygiene`, the schema-defaults registry, the one-number-one-home tests.
- The sandbox (`npm run sandbox`): local API on 8787, local database, no customers. Every browser lane runs against it, never against the live API.

## Model tiers, and why

| Tier | Model | Used for |
|---|---|---|
| Inventory | Haiku | listing, grepping, classifying: routes, tools, tables, tests, greps for known smells. Cheap and exhaustive. |
| Review | Sonnet | reading one lane's code with judgement and writing findings with file and line. |
| Deep | Opus | the security pass and the money-rules pass, where a missed finding costs real money or a customer's data. |
| Verify | Opus | one verifier per finding batch: reproduce it or reject it. A finding nobody reproduced does not reach the page. |
| Conductor | Fable (this session) | writes the briefs, reads every verified finding, ranks, scores, files the todos, publishes. |

Auto-repair never escalates a tier on its own. If a Haiku inventory looks wrong, the conductor re-runs it, it does not hand the job to Opus.

## The lanes

Each lane gets the same brief shape: what to read, what a finding must contain (file:line, what happens, how to reproduce, who it hurts), and step one is always "confirm the defect exists on this checkout, else report and stop."

### Lane 0 — Inventory (Haiku, runs first, everything else reads its output)
1. Every public route in `src/App.tsx`, every admin route in `src/admin/AdminApp.tsx`.
2. Every worker endpoint in `worker/src/index.ts` (27k lines) with its auth check and account scoping, as a table.
3. Every MCP tool with its scope, its annotations, and whether it is audited.
4. Every table in `worker/schema.sql` with its `account_id` column and defaults.
5. Every test file mapped to what it covers, so lane 5 can subtract.

Output: five JSON lists in the scratchpad. No opinions.

### Lane 1 — Security (Opus, plus the `security-review` skill as a second read)
- Tenancy: every endpoint from lane 0 that reads a table with `account_id` and does not filter by it. Cross-tenant probes written and run against the sandbox with two accounts.
- Auth: JWT lifetime and refresh, OAuth callback and state, MCP token hashing, scope checks running before handlers, the public MCP leaking cost/vendor/stock fields.
- Input: dynamic SQL identifier allowlists, file uploads (xlsx bounds, images, recordings), query parsing, CORS origins, CSP, headers in `_headers`.
- Secrets: anything that looks like a value in the repo, the bundle, or a log line. Names only in the report, never values.
- Abuse: rate limits on OTP, sign-in, inquiry, public MCP.

### Lane 2 — Money and data integrity (Opus)
- Every write door to `cost_amount`, `cost_currency`, `shipping_rate_per_kg`, `markup_multiplier`, `fixed_retail_price_usd`: does each obey the rules in `CLAUDE.md` (NULL means nobody said, defaults read not copied, a tea arrives with its cost).
- Every intake path writes a stock ledger row and a batch. Every sale path decrements exactly once.
- Migrations: any that move rows, whether they were shown first, whether they are idempotent, whether the deploy order still protects the schema.
- The exchange-rate chain: one table, daily refresh, stale banner, no invented fallback.
- Invoice invariants: per-unit price, void and repair paths.

### Lane 3 — Code health (Haiku scan, Sonnet review)
- Haiku greps: `as any`, `@ts-ignore`, empty `catch {}`, `console.log` in production paths, `TODO`/`FIXME`/`HACK`, duplicate helpers, orphan files (the two dead `LoginScreen.tsx`), exports nothing imports.
- Sonnet reads the hotspots: the 27k-line worker entry and the 7.9k-line `mcp.ts`, the InventoryView height chain, the store, `api.ts`. Reports what is duplicated, what is dead, what will break the next person, with the cost of leaving it.

### Lane 4 — UX and UI (Sonnet with the browser, sandbox on)
- Walk every route from lane 0 at 390 wide and at desktop, light and dark. One screenshot per route per state, saved to the scratchpad.
- Per route: horizontal overflow, error boundary text, 404, console errors, bottom-nav clearance, tap targets under 44, cancel/back/close placement against the table in `CLAUDE.md`, banned tokens, empty state, loading state, dead links, stub pages reachable from live links.
- Then the `impeccable` audit skill on the five surfaces that matter most for launch: home, shop, product page, sign-in, admin inventory. Scored findings, P0 to P3.
- Copy: unclear labels and error messages, collected for one `clarify` pass later. Not fixed in the audit.

### Lane 5 — Tests and CI (Sonnet)
- Subtract lane 0's test map from lane 0's route and tool lists: what has zero coverage.
- What CI actually runs: the mobile job runs two spec files of 49; the worker tests run only when `worker/**` changes; `npm run lint` runs on the frontend deploy only. Report the gap between "tests exist" and "tests gate main."
- Mutation check on ten guard tests: break the thing each protects and confirm it goes red. A green that cannot go red is reported as no test.

### Lane 6 — Performance and resilience (Sonnet)
- `npm run build`: chunk sizes, the worker bundle against the Workers limit, the largest images shipped.
- Cold load of home and shop through the sandbox with network throttled; time to first product visible.
- Service worker: update behaviour, what it caches, what happens offline.
- `audit:china` re-run; any new dependency it flags.
- Worker: N+1 query shapes in list endpoints, unbounded `SELECT *`, missing indexes for the `account_id` filters.

### Lane 7 — Ops, docs and product boundary (Haiku)
- Docs drift: `STATE_OF_THE_SITE.md`, `CAPABILITIES.md`, `INDEX.md`, `CLAUDE.md` claims versus the code as it is today. Each stale line listed.
- `TODO.md`: 31 open items, most under Untriaged. Which are done, which are duplicates of tracks, which lack a band.
- Dependency audit, action pins, secrets hygiene workflow, the rollback path for a bad worker deploy.
- DO-NOT-BUILD grep: streaks, gamification, notifications, recommendations, auto-replenish. Report anything that crept in.

### Verification (Opus, pipelined per lane)
Every lane's findings go to a verifier in batches of five, as soon as the lane finishes. The verifier reproduces each finding on this checkout: runs the probe, opens the file, loads the route. Verdict per finding: confirmed, wrong, or duplicate. Only confirmed findings continue. The verifier also grades severity independently; where it disagrees with the lane, the conductor reads both.

### Synthesis (conductor)
1. Merge confirmed findings, dedupe by root cause (fix the class, not the instance: one cause wearing four symptoms is one finding with four sites).
2. Score each area 0 to 10 for launch readiness with the evidence beside it.
3. Rank P0 (blocks real customers or leaks data) to P3 (polish).
4. File the top ten into `TODO.md` under a new `## Prime-time audit` section, band and effort inferred, plan files for the deep ones.
5. Write `docs/AUDIT-2026-09.md`, publish the artifact page, hand Adrian the link.
6. Which `LAUNCH_VALIDATION.md` items an agent can now close, and which still need him. Nothing in that file is ticked by the audit.

## Sequence and time

| Step | Wall clock |
|---|---|
| Lane 0 inventory | 15 min |
| Lanes 1 to 7 in parallel | 60 to 90 min (lane 4 is the long one) |
| Verification, overlapping with lanes | finishes 20 min after the last lane |
| Synthesis and publishing | 30 to 45 min |
| **Total** | **about 3 hours** |

Agents: 1 inventory, 7 lanes, roughly 6 to 10 verifier batches, so 14 to 18 agents. That is over the 15-agent guideline by a little, deliberately: the verifiers are what make the page trustworthy.

## What the audit will not do

- It will not fix anything. Findings only. Fixes are separate sessions, one per todo, so each lands on its own.
- It will not touch the live API or the production database. Sandbox only.
- It will not tick a line in `LAUNCH_VALIDATION.md`.
- It will not change navigation, tab labels or routes, even where it finds them wrong.

## Adrian's check afterwards

Open the artifact page. The top of it is a scorecard with eight rows. If a row's score surprises him, the finding that drove it is one click below, with the screenshot or the reproduction beside it.
