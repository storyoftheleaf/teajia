# Ship fast

Adrian, 2026-11-27: "My goal is to be able to ship way faster." A change
should go from finished to live in about ten minutes with nobody waiting on
it. Four habits do that, in this order.

## 1. Check here first: `npm run preflight`

About a minute on a laptop or a cloud session. It runs, side by side:

- the type check and the color rules;
- every test that scans the repo (the drift ceilings, the style-size
  ceilings, the migration ledgers, the "one home" rules), always, because
  `vitest related` never reaches them and they are what failed most;
- the unit tests related to the files this branch changed;
- for a worker change: the worker type ratchet, the worker tests that read
  the repo, and the worker tests that import a changed module by name;
- the platform-hardening checks when workflows or scripts changed.

Every red PR run on 2026-11-27 was one of these, and each one cost two CI
waits instead of none. CI still runs everything; preflight only catches
what is cheap to catch first. A machine without the `sqlite3` command leaves
nine migration test files to CI and says so.

When a ceiling fails because you removed things, lower the ceiling in the
same commit (`node scripts/style-guard.mjs --write` for style sizes).

## 2. Open early, review while CI runs

Push once preflight is green and open the PR as a draft. The `review-pr`
reviewer reads while CI runs. If it changes nothing, the run already going
is the verdict; if it commits fixes, one more run. Either way nobody waits
for the review before CI starts.

## 3. Auto-merge, then keep working

Mark it ready, turn on auto-merge (squash) and subscribe to the PR. Then
move on: the merge happens when the required checks pass, a failure comes
back as an event, and the thread never sits on a check. A one-way door is
held at `merge-danger` until Adrian's `owner-approved` label.

Auto-merge is on, and main requires `checks`, `mobile`, `e2e-changed` and
`merge-danger` (set 2026-11-27). Those settings belong to the
`storyoftheleaf` GitHub account; Adrian's everyday account cannot change
them. If GitHub says a PR is already clean when you turn auto-merge on,
merge it directly.

After the merge, check the change live (the deploy is about a minute for a
proven worker tree, a couple for the site) and report it.

## 4. Keep CI short

What a PR runs, all side by side (2026-11-27):

| Lane | What | Runs (measured) |
|---|---|---|
| `checks-static` | tsc, worker type ratchet, src unit tests, colors | 2.7 min |
| `build` | the production bundle | 1.3 min |
| `worker-tests` ×6 | the worker suite, sharded | 2 to 3 min |
| `mobile-lane` ×3 | mobile browser suite in two halves, and the admin journeys | 1.3 to 3.5 min |
| `e2e-changed-select` | lists the browser specs the PR changed | 0.5 min |
| `e2e-changed-shard` ×6 | only when that list is not empty | as needed |

The account runs about twenty jobs at once. Past that, jobs wait for a
runner, and on 2026-11-27 that wait (1 to 2.5 minutes) was as long as the
work. So a lane earns a job of its own only when it shortens the long pole;
work that takes seconds rides in a job that already exists.

`checks`, `mobile` and `e2e-changed` join their lanes into the three stable
check names. A prose-only PR (`*.md`, `docs/`, `todo/`) still starts the
workflow, and the gate skips every lane in seconds, so the required checks
report instead of hanging. When a lane nears the long pole, split it rather
than raise its timeout. A flaky test is fixed or deleted the day it is seen, never retried
by hand and never skipped: a rerun costs the same five minutes as a fix.

Deploys: a worker deploy skips the suite when Playwright already proved the
exact tree (a squash merge of a PR that was up to date with main), else runs
the same six shards.
