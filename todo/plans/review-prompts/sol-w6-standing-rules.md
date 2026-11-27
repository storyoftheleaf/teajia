# W6 (Sol): The standing rules, across everything new

Your id is **W6**.

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

**Behaviour to prove.** The 309 files the launches changed (`git diff --name-only 5740132f...build/launch-5`, plus the Launch 1 and 2 merges before it: PRs 480 to 543) keep the rules in `CLAUDE.md` that no automatic guard checks.

**Check each, file by file, and list every breach with its line.**
1. A step (tab, screen, open record, panel) held only in `useState` instead of the address (`useStepParam` or a route). A `navigate(-1)` that is not `useAdminBack`. A `replace: true` on a step.
2. A photograph added without `usePhotoEditor()`: any `<input type="file"` outside the listed exceptions.
3. Layout: `z-50` on a full-screen overlay, an inline `calc()` for the bottom bar, a control under 44 by 44 without `tap-target`, text below `text-tea-text-sec`, Back not top-left, the primary action not on the right.
4. Words a person can read: "master" used of someone at a session (it is "hosted by" and "pouring"); "feed"; "curated" on a table; any count, score, average, star, level, streak or rank shown to anyone but the owner; any promise of a time ("within 24 hours"); an em dash.
5. Anything that asks, prompts or notifies during a session.
6. Money: `Number(x) || 0`, `?? 0` or `x ? Number(x) : null` on a money value; a bare `2.5`; a missing rate treated as 1; a `cost_amount` written without its currency.
7. Each new MCP tool sits in `worker/src/mcpTools/` as a module, and each write uses a ticket from `tickets.ts`.
8. `worker/src/index.ts` exports functions and classes only.

Then run `npm run lint`, `npm run lint:colors`, `npm run lint:worker-types` and `npm run test:src -- src/admin/guards` and record the result.

**Preserve.** No product code changes in this phase, even for a one-word fix. List them; they are fixed together afterwards.

**You own.** Your findings file only.

**Acceptance.** Every breach has a path and line. Group the word breaches (item 4) in one table of path, line, the words now, the words proposed, so they can be fixed in one pass.
