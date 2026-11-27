# W4 (Sol): Every switch state, every door

Your id is **W4**.

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

**Behaviour to prove.** In every state the switches will really be in, every link leads somewhere and every closed thing is truly closed.

**The states.** `live`, `all`, `only:<SWITCH>` for each of the fourteen closed switches, and `upto:<SWITCH>` for each step of the opening order in `tests/review/switch-sets.ts`. That is about thirty rig starts; run them one after another on your slot.

**For each state, as a signed-out visitor, as Mei, as Ana and as the owner, at 320, 390 and 1280:**
1. Start at Home. Collect every link and button that leads to a page from the bar, the rail, the phone menu, Home, Your Table, the account panel and Manage's front page. Follow each one level deep.
2. Fail on: the not-found page, a blank main area, a spinner still turning after five seconds, side scroll, a console error, a request that answers 500.
3. Call every route gated by a switch (read the list from `worker/src/launch4Closed.ts` and from `todo/review/switch-map.md` if it exists yet) and check it answers only when its switch and what that switch needs are open.
4. Record, for every page reached, how many taps it took from Home.

**Preserve.** No product code changes.

**You own.** `tests/review/switch-crawl.spec.ts`, `todo/review/switch-crawl.md` (one table: state by persona by size, pass or the finding ids) and your findings file.

**Acceptance.** The table is complete. A page that takes more than two taps to reach from Home is an S3 finding, listed once with the shortest path found. Known already: with HOME_BAR_OPEN on and TEA_HOUSES_OPEN off, "tea house" goes to a 404; confirm it and find any others like it. Use rig slot 4.
