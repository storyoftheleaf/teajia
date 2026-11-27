# A10 (Astra): Opening, closing and half-open

Your id is **A10**.

You are working on Teajia (repository storyoftheleaf/teajia), in your own git worktree cut from the branch `build/review`. Read `CLAUDE.md` first and follow it.

**What was built.** "Guests and tea masters", Launches 1 to 5. Launch 1 is open on the live site. Everything else is live but closed behind switches: FEW_HOSTS_OPEN (Launch 2), ANYONE_HOSTS_OPEN (3), TEA_TABLE_OPEN, FAVOURITES_OPEN, YOUR_TABLE_PAGE_OPEN, HOST_ARTICLES_OPEN, TOP_TEAS_OPEN, TEA_HOUSES_OPEN, YOUR_TABLE_PLACE_OPEN, HOME_BAR_OPEN (4), HOST_CREDIT_OPEN, CIRCLES_OPEN, HOST_TOKENS_OPEN, TABLE_CARD_OPEN, KNOW_THIS_TEA_OPEN (5). Each switch is a constant in `src/lib/` read by the site (`VITE_<NAME>`) and the worker (variable `<NAME>`). The plan is `todo/plans/guests-and-tea-masters-build.md`. Earlier reviews are in `todo/review/earlier/`.

**This is the review phase. Its question: do the five launches work together, and where are the holes?** The run sheet is `todo/plans/guests-and-tea-masters-review-run.md`.

**Rules for every reviewer.**
- You change no product code in this phase. You own only the files named under "You own". Tests and findings only.
- Never touch the live shop. Never run `npm run dev`. Use the review rig or the worker tests.
- You cannot commit (the sandbox blocks git metadata). Leave your files in the worktree; the session that started you commits them.
- If something needs a product decision, or a change to a shared interface or to a file you do not own, do not decide it. Write it under "Conflicts for Opus" in your findings file with the two concrete options.
- Write plain words. No em dashes anywhere.

**Findings file.** Write `todo/review/findings/<YOUR ID>.md`. Start with three lines: what you checked, what holds, how many findings by severity. Then one block per finding:

```
### <ID>-<n>: one plain sentence saying what is wrong
- Severity: S1 (a leak, wrong money, lost data) | S2 (a journey breaks or dead-ends) | S3 (works, but harder than it should be, including any task that takes more than two taps to reach or asks for something the site already knows) | S4 (wording or looks)
- Where: path:line
- Switches: the switch state it happens in
- See it: the command or the steps
- Evidence: the test name, or the output
- Smallest fix: one or two sentences
- Question for Adrian: no | the question in one sentence
```

A finding without evidence someone else can rerun is not a finding. A check that passed is one line under "What holds".

**The review rig** (built by Opus before you start; `tests/review/README.md` has the detail).
- `node scripts/review-rig.mjs --set <set> --slot <n>` starts a worker and a site on their own ports and state folder from the offline fixture shop, and prints `REVIEW_SITE` and `REVIEW_API`. Sets: `live` (as the live site is now), `all` (every switch on), `only:<SWITCH>`, `upto:<SWITCH>` (the opening order up to and including that switch). Use the slot number given to you so reviewers never share a port.
- `npx playwright test --config tests/review/review.config.ts <your spec>` runs at three sizes: phone 320, phone 390, desktop 1280.
- `tests/review/helpers.ts` has `signIn(page, who)` (real sign-in: `mei` the guest, `ana` the approved host, `jun`, `lin`, `sandbox` the owner), `noSideScroll(page)`, `quiet(page)` (fails on console errors and failed requests) and `task(page, name, budget, fn)`, which counts taps, fields typed and page changes for one task and records them in the tap ledger. Wrap every task a person does in `task(...)`.
- No mocked API routes. The point of this phase is the real site against the real worker.

## Your slice

**Contract.** Adrian opens the switches one at a time, over weeks, and may close one again. Opening a switch is one commit, but the site (Cloudflare Pages) and the worker deploy separately, so for some minutes one is open and the other closed. Through all of it nothing may leak, nothing may be lost and nobody may be left at a dead end.

**The risk, precisely.** (1) Data made while a switch was open, after it closes: a piece on the Tea Table, a favourite, a circle, a host's key, credit earned, a place, an article offer, a seat on a hosted table. Does every route go quiet, does every page that linked to it stop linking, and is the data whole when the switch opens again? (2) Site open with worker closed, and worker open with site closed, for each switch: what does the person see? (3) A switch that needs another: found so far in the code are ANYONE_HOSTS, CIRCLES, HOST_TOKENS and YOUR_TABLE_PLACE needing FEW_HOSTS; HOME_BAR sending "tea house" to a 404 unless TEA_HOUSES is open (`housesDoor()` in `src/components/navSections.ts`); HOST_CREDIT recording only when open (`worker/src/index.ts`, near `recordOrderSessionSource`); `acknowledgementOpen` riding on TEA_TABLE (`worker/src/photographCredit.ts`). Find the rest.

**Evidence to produce.**
- `todo/review/switch-map.md`: for each switch, what it needs open first, which routes it gates (`worker/src/launch4Closed.ts` and the per-route checks), which MCP tools, which site doors. One table.
- `worker/tests/review-open-then-close.test.ts`: for each switch, make data while open, close it, call every route it gates and every public reader that could still show the data, open it again and check the data.
- `tests/review/half-open.spec.ts` on the rig: start the rig with the site and worker disagreeing (`--site-set` and `--worker-set`) for each switch, walk the doors that switch adds, and record what the person sees. A quiet "not here yet" is fine. An error, a blank page, a spinner that never ends or a button that does nothing is a finding.

**You own.** Those three files and your findings file.

**Return.** Findings, the switch map, and a recommended opening order with the reason for each step. No patch.
