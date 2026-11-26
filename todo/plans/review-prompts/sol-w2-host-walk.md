# W2 (Sol): The host, start to finish

Your id is **W2**.

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

**Behaviour to prove.** One host goes from "I would like to host" to a finished table with credit earned, across all five launches, on the rig with `--set all`. Run it twice: as Ana (already approved) and as Jun (never hosted, so the first-timer path while anyone may host).

**The walk (each line one `task(...)`, budget of taps in brackets, typing counted apart).**
1. From Home, starts a table (2). Count every field the form asks for. Flag each field the site already knows or could default (date, time zone, place, seats, door).
2. Sets the door by request, then makes a second table by link and a third open (1 each).
3. Adds her place once in Your Table and uses it on the next table without typing it again (1).
4. Adds the teas to pour: one of the shop's, one of her own, one by name only (2 each).
5. Adds the way to the house with three photographs through the shared photo editor (per photograph: 2).
6. Sees a request, confirms it, sees the waiting list, offers a freed seat (1 each from the table's page).
7. Shares the table: copies the link (1).
8. After the session: sends the thank-you, reviews the guest book, makes the recap, puts it on the Tea Table (each reachable in 1 from the table's page).
9. Makes a circle and a series and asks an earlier guest back (2).
10. Sees credit after the owner fills a guest's order (do the owner's part through the API), and asks to use it at checkout (2).
11. Makes an assistant key, sees it once, disconnects it (2).
12. From anywhere in Your Table, reaches any of her tables (2).

**Preserve.** No product code changes. No mocked routes. Every photograph goes through the editor; a bare file input that uploads straight is a finding.

**You own.** `tests/review/host-walk.spec.ts` and your findings file.

**Acceptance.** As W1: three sizes, `noSideScroll`, `quiet`, findings by step number, failing steps marked `test.fail` with the finding's id. Browser back and forward are pressed once on every screen of the walk and must return to the same place. Use rig slot 2.
