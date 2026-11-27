# U1 (Sol): The tap ledger: how many steps each thing takes

Your id is **U1**.

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

**Why.** Adrian, 2026-11-26: "Anytime I have to click three or four times instead of one or two, we should consider better how to lay out or interconnect. Especially when it comes to entering things, since we want this to be as easy as possible for people who are not familiar with the system."

**Behaviour to prove.** For everything a guest, a host and the owner does, we know the number of taps to reach it, the number of screens, and the number of things they must type or choose, and we know which of those the site could have filled in.

**Work.**
1. Read `tests/review/steps.json`, written by `task(...)` in the three walks (W1, W2, W3) and the crawl (W4). If a walk has not produced it yet, run that walk's spec yourself on your slot.
2. For every form the launches added (start a table, a place, the way to the house, teas to pour, the thank-you, guest book words, a circle, a series, a favourite, sharing a tasting, asking to use credit, an article offer, top teas, portfolio words, a report), open it on the rig and list each field: required or not, typed or chosen, whether it has a default, and whether the site already knows the answer (from the person's account, their last table, their saved place, the session itself).
3. For each pair of places a person moves between in the walks (a table and its guests, a table and its thank-you, a tea at a table and that tea in the shop, a guest and the tables they came to, a recap and the Tea Table, credit and the order that earned it), check there is a direct link each way.

**Preserve.** No product code changes.

**You own.** `todo/review/tap-ledger.md` and your findings file.

**Acceptance.** `tap-ledger.md` has three tables: reaching things (task, persona, taps, screens, budget, over or under), entering things (form, fields asked, fields that could be filled in or dropped, taps to finish), and missing links (from, to, taps today, taps with a direct link). Every row over budget is an S3 finding with one proposed change in one sentence. Sort each table worst first. Use rig slot 5.
