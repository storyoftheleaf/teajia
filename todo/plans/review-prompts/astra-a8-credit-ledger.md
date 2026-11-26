# A8 (Astra): Tea credit under overlap and retry

Your id is **A8**.

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

**Contract** (`todo/plans/guests-and-tea-masters-build.md`, "Credit is held securely"; code in `worker/src/hostCreditLedger.ts`, routes in `worker/src/index.ts`, migrations 0135 and 0143). Credit is earned only when the owner marks an order Filled, for an order that began from that host's thank-you (`order_session_sources`). It is spent only with the owner's approval. It never expires. The browser is never trusted. The ledger is append-only. Read `docs/claude/money.md` first: a missing exchange rate is never 1, and a stored zero is zero.

**The invariants to prove or break.** The balance equals the sum of the ledger. The balance is never negative. One order earns at most once, whatever is retried. One spend is applied at most once. Nothing is earned for a closed switch or a stopped host unless the rule says so (say what the code does).

**Cases.** Fill, back to Pending, Fill again. Fill, then Void. A Filled order whose lines or prices are edited afterwards. Two Fill requests at once. Two spend requests at once that together exceed the balance. Approve twice; approve and decline at once. A spend approved on an order that is then Voided: does the credit come back? A host who orders from their own thank-you. A guest who is also a host. An order in a currency other than USD, and one whose rate is missing. HOST_CREDIT_OPEN closed while a spend is waiting, then opened again. Orders Filled while the switch was closed: earned later or never? A host whose hosting is stopped while holding a balance. The same request replayed with the same idempotency key, and with none.

**Evidence to produce.** `worker/tests/review-credit-ledger.test.ts`: one test per case, plus one test that runs a few hundred random interleavings of fill, void, edit, ask, approve and decline over three orders and checks the invariants after every step, printing the seed on failure.

**You own.** That test file and your findings file.

**Return.** Findings with failing tests. Where the right behaviour is a product choice (self-order, credit back on Void, orders Filled while closed), say what the code does today and put the question under "Question for Adrian". No patch.
