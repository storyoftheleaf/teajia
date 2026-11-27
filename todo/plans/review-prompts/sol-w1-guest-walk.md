# W1 (Sol): The guest, start to finish

Your id is **W1**.

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

**Behaviour to prove.** One guest, Mei, goes through everything a guest can do across all five launches, in one run, on the rig with `--set all`, then the same run with `--set live` showing only what Launch 1 gives.

**The walk (each numbered line is one `task(...)` with its budget of taps in brackets).**
1. Opens an invite link to Ana's table signed out, sees who hosts and the area but not the address, asks for a seat (2).
2. Signs in, is confirmed by Ana (do Ana's part through the API), sees the address and the way to the house (1).
3. Opens the way with the network off: it still shows (0 more).
4. During the session: adds a photograph (1). Nothing on any page asks her for anything between start and end.
5. After: opens the thank-you, sees the teas poured with links and prices, keeps a tea (1), leaves words and a photograph and chooses whether to be named (2 plus typing).
6. Buys a tea from the thank-you through to the WhatsApp order (3).
7. Favourites: keeps a tea, an article and a Tea Table piece, finds all three in one place (1 each, 2 to reach the place).
8. Shares a saved tasting to the Tea Table, sees it there signed out, takes it off (2, 2).
9. Opens Home at phone size and reaches: a table to come to, the Tea Table, her favourites, her journal (2 each).
10. Asks to host a table herself from Home (2).

**Preserve.** No product code changes. No mocked routes.

**You own.** `tests/review/guest-walk.spec.ts` and your findings file.

**Acceptance.** The spec runs at all three sizes with `noSideScroll` and `quiet` on every page. Every step that fails, dead-ends, or goes over its budget is a finding with the step number. Mark such a step `test.fail` with the finding's id so the run stays readable. Use rig slot 1.
