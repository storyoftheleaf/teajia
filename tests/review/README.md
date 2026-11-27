# The review rig

The walks for the review run (`todo/plans/guests-and-tea-masters-review-run.md`). Needs `sqlite3` on the PATH and `npm install` in the root and in `worker/`.

1. Start one worker and site for a switch state, in its own slot (worker on 8900 + 10n, site on 7900 + 10n, never 7777):
   `node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --slot 1`
2. Sets are `live`, `all`, `only:<SWITCH>`, `upto:<SWITCH>` (`tests/review/switch-sets.ts`, which holds the opening order). Half-open: `--site-set live --worker-set all`. Each start is a fresh fixture shop; `--keep` reuses it.
3. It prints `REVIEW_SITE` and `REVIEW_API` and writes them to `test-results/review/slot-<n>.env`. Then:
   `set -a; . test-results/review/slot-1.env; set +a; npx playwright test -c tests/review/review.config.ts --trace off`
4. People: `sandbox` (the owner), `ana` (a host, with tables finished, on now and ahead), `mei` (a guest). Passwords are the usernames.
5. Wrap each thing a person does in `task(page, name, budget, fn)` from `helpers.ts`; the counts go to `test-results/review/steps.json`. Findings go in `todo/review/findings/<id>.md`.
6. In a cloud container whose Playwright differs from the project pin, set `REVIEW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. Proof the rig works: `tests/review/rig.spec.ts` (9 of 9) and `tests/launch-5.spec.ts` with its L5_ variables at slots 1 (`all`) and 2 (`upto:HOME_BAR`), 11 of 11.
