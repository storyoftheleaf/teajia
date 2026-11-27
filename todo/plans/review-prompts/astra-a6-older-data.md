# A6 (Astra): Older data

Your id is **A6**.

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

**Contract.** Every row that existed before these launches keeps working after them. The live database has events, guests, guest book entries, tastings, orders, people pages and places written by the code that ran before migration 0128. The fixtures are all fresh rows, so nothing has yet proved this.

**Evidence to build.** Use `worker/tests/helpers/migratedSqlite.ts`. Build an "old shop": apply migrations up to 0127 only, write rows the way the old code wrote them (read the writers at the commit before `30e1ca7`, which added 0128; do not guess the shapes), then apply 0128 to 0147. Run the new and changed readers and writers against those rows, with every switch on and again with every switch off.

**Cases that could break it.**
- New columns that are NULL on old rows where the new code expects a value: a session's door, host, lifecycle, seats, timezone; a guest's `is_tasting`; a guest book entry's `show_name`; a person's host standing and reach.
- Old private sits beside hosted tables in Journey (`/api/me/sessions`), and the old sit door.
- Orders made before `order_session_sources` existed: no credit, no error, and Sales still opens them.
- Tastings shared before the Tea Table: are they treated as on it, off it, or broken (`worker/src/teaTable.ts`, `worker/src/tastingWithdrawal.ts`, migration 0145)?
- Guest book photos and notes from before 0130 and 0132: who is named.
- People pages from before top teas and photograph credit (0132, 0140); places from before 0144; favourites of something later hidden or deleted.
- Any migration in 0128 to 0147 whose DEFAULT silently gives old rows a meaning nobody chose (for example an old session becoming "open door").
- A row count check: no migration adds, changes or deletes a row.

**You own.** `worker/tests/review-older-data.test.ts`, `worker/tests/helpers/oldShop.ts`, your findings file.

**Return.** Findings, with a failing test for each. No patch to product code.
