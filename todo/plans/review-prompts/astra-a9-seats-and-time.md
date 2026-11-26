# A9 (Astra): Seats, doors and time

Your id is **A9**.

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

**Contract.** A table has a fixed number of seats, a door (by request, by link, open), a waiting list with offers (`worker/src/waitingList.ts`, `worker/src/seatRequest.ts`, migration 0134), and a life: draft, published, full, cancelled, completed, archived. What a guest may see and do depends on their seat and on the time. Earlier review: `todo/review/earlier/j9-waiting-list-audit.md`.

**Cases that could break it.**
- Two guests take the last seat at once. A waiting list offer accepted at the moment it runs out. Two offers out for one seat.
- The host lowers the seats below the number confirmed. The host changes the door while requests are pending. The host cancels while a request is being confirmed.
- A guest gives up a seat: the way in they kept on their phone must go (see `tests/host-walkthrough.spec.ts`); the next person is offered the seat once.
- Time: a session in Asia/Makassar seen from another time zone. When "before" becomes "during" becomes "after". The rule that the app never asks during a session: find any notice, prompt or request the worker could send or the site could show between start and end. A session with no end time. A session that crosses midnight.
- A host who is stopped, or whose approval is withdrawn, with tables ahead: what do their confirmed guests see, and can the tables still be reached by link?
- A guest or host who deletes their account: seats, guest book entries, Tea Table pieces, circles, credit.
- The same guest invited by link, by request and by a circle to the same table: one seat, not three.

**Evidence to produce.** `worker/tests/review-seats-and-time.test.ts`, one test per case, with the clock injected where the code allows it. Where it does not allow it, say so as a finding.

**You own.** That test file and your findings file.

**Return.** Findings with failing tests. No patch.
