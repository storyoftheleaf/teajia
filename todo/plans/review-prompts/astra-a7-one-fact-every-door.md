# A7 (Astra): One private fact, every door

Your id is **A7**.

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

**Contract.** A private fact is private through every way of reaching it. Each launch was reviewed alone (A2, A3, K0, K14, A5 in `todo/review/earlier/`). Later launches then added new readers of the same rows. The risk is a fix that held on its own branch and a newer reader that never learned the rule.

**The facts.** A table's address, map link and way in (confirmed guests only, and gone after the end). A guest's email, phone and full name. A guest who chose not to be named, on notes and on photographs. A personal score on a tea (never public, no average, no stars). The number of keeps on a Tea Table piece (Adrian only). A host's standing, approval and reach (never displayed). A host's credit balance and ledger (the host and the owner only). A private account and a private table (area only). A tasting not shared. A circle's members. Who reported a session.

**The doors.** Signed-out routes under `/api/public/`. The same routes signed in as a stranger, as another guest of the same table, as another host. The party link and the after-sit credential (`worker/src/afterSitAccess.ts`). Share cards and page metadata. The Tea Table (`worker/src/teaTable.ts`), recaps, person pages, tea pages, Know this tea (`worker/src/knowThisTea.ts`). `/mcp` with the owner's token, `/mcp` with a host's own token (`worker/src/hostTokens.ts`, HOST_SELF_TOOLS in `worker/src/mcp.ts`), and `/mcp/public`. Favourites (`worker/src/favourites.ts`). Circles (`worker/src/circles.ts`).

**Evidence to produce.** A table of fact by door in your findings file: "refused", "allowed by rule", or "leaks". For every cell that is not obviously refused, a worker test that asks through that door and checks the answer body for the fact (search the whole JSON, not one field). Confirm each fix listed in the earlier reviews still holds on this branch, by name.

**You own.** `worker/tests/review-one-fact-every-door.test.ts`, your findings file.

**Return.** Findings with a failing test for each leak. No patch.
