# W5 (Sol): Empty, failing and signed out

Your id is **W5**.

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

## Your slice

**Behaviour to prove.** Every page the five launches added says something useful when there is nothing to show, when the request fails, when it is slow, and when the person is signed out or is the wrong person.

**The pages.** `src/pages/FavouritesPage.tsx`, `TeaTablePage.tsx`, `TeaCreditPage.tsx`, `SessionCardPage.tsx`, `TeaHousesVisitPage.tsx`, `src/pages/teaHouses/*`, `src/pages/home/HomeLaunchFour.tsx`, `HostedTablePage.tsx` and each of its parts in `src/components/host/` (guests, teas, the way, after, circles, assistant, your place), the Host a table page, Journey with hosted tables, the thank-you (`AfterSitPage.tsx`), Know this tea.

**For each page, four states with mocked routes** (this slice alone may mock, following `tests/launch-4-journey.spec.ts` and its config for the switches): no data at all; the main request answers 500; the main request takes eight seconds; signed out, or signed in as someone who may not see it.

**Expected.** Empty: one plain sentence and the one next thing to do, as a button. Failing: the page says it could not load and offers to try again, with no banner about site problems (those go to the ledger, see `docs/claude/site-problems.md`). Slow: something shows within one second. Signed out: the sign-in door, returning to this page afterwards.

**Preserve.** No product code changes.

**You own.** `tests/review/empty-and-failing.spec.ts`, `tests/review/empty-and-failing.config.ts` and your findings file.

**Acceptance.** Four states for every page at 390 and 1280, a screenshot of each saved under `test-results/review/states/`, and a finding for each state that shows a blank area, raw error text, an endless spinner or a dead end.
