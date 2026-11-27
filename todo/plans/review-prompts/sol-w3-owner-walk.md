# W3 (Sol): The owner, in Manage and by tool

Your id is **W3**.

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

**Behaviour to prove.** Adrian, as the owner (`sandbox`), can do every owner action the five launches added, in Manage and through the owner's agent tools, on the rig with `--set all`.

**The walk (each line one `task(...)`, budget in brackets).**
1. Sees someone asking to host, approves them, sets how widely their tables are shown, later stops their hosting (each 2 from Manage's front page).
2. Reads a report about a session and acts on it (2).
3. Tea Table: hides a piece, holds a piece at the top for some days, sees the number of keeps, which no other person can see (2).
4. Sales: marks a guest's order Filled; sees the host's credit; approves a host's request to use credit, declines another (2 from Sales > Waiting).
5. Tea houses: writes the portfolio words for a house; sets a person's top teas; reads an article a host offered (2 each).
6. Prints the card for a table (2).
7. Does items 1, 3 and 4 again through `/mcp` with the owner's token: each write previews first and needs the confirm (`npm run mcp:call` shows the calling pattern; point it at `REVIEW_API`).
8. Manage at phone 390: every owner page above scrolls, has Back top-left, and browser back and forward work (`tests/admin-history.spec.ts` shows how to check).

**Preserve.** No product code changes. No mocked routes. Do not break the inventory height chain checks.

**You own.** `tests/review/owner-walk.spec.ts` and your findings file.

**Acceptance.** As W1. Any owner action that exists as a route but has no place in Manage, or no tool, is a finding. Use rig slot 3.
