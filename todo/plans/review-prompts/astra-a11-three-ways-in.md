# A11 (Astra): One action, three ways in

Your id is **A11**.

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

**Contract.** Adrian asked that every admin and session action is also an agent tool, so a host can connect their own assistant. So most actions now have up to three ways in: the site's route, the owner's tool on `/mcp`, and the host's own tool on `/mcp` with a `host:self` key. All three must apply the same rules, and every tool write previews and waits for a confirm (`worker/src/mcpTools/tickets.ts`). `docs/claude/mcp.md` has the rules.

**The risk.** Rules written twice drift. A tool that accepts what the page refuses, or refuses what the page accepts, or skips a check the route makes (ownership, approval, the switch, a stopped host, the cost and currency rules, "a number without its unit is not a number").

**Work.**
1. List every write a host or the owner can make in Launches 1 to 5 (routes in `worker/src/index.ts`, `circles.ts`, `hostTokens.ts`, `teaTable.ts`, `favourites.ts`, `yourTablePlace.ts`, `hostArticleOffers.ts`, `hostCreditLedger.ts`, `sessionReports.ts`, `waitingList.ts`; tools in `worker/src/mcpTools/firstTable.ts`, `fewHosts.ts`, `launch3.ts`, `launch4.ts`, `circles.ts`, `events.ts`).
2. Put them in a table: action, route, owner tool, host tool. An empty cell is a finding (S3) unless the build plan says the action is deliberately not a tool (credit is one).
3. For each action with more than one way in, send the same good input and the same six bad inputs (someone else's table, a stopped host, the switch closed, a missing required field, an out-of-range value, a replay of a used confirm ticket) through each way and compare the outcome and what was written.

**Evidence to produce.** `worker/tests/review-three-ways-in.test.ts` and the table in your findings file.

**You own.** That test file and your findings file.

**Return.** Findings with failing tests. No patch.
