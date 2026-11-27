Fixed by Opus 5.5 (cloud), on review/fix-tables.

# The waiting list with ANYONE_HOSTS_OPEN off: main's, case by case

The cases are guests-build/flags-off-queue-cases.md (13 of them). The rule: with the switch off, the live site does what main did before PR 560. The one exception is where the new behaviour fixes a real bug that a review-run fix kept. Here that is A9-6 from the seats fix: nothing is offered once tea has begun, and an offer never runs past the start. A9-3 is kept too: a cancelled or unpublished session offers nothing.

PR 575 (build/flags-off-parity, into main) already restores three things while the switch is off: `releaseSeats` keeps pending invitations, a full by-request table keeps the guest `requested`, and a claim writes `spot_claimed`. This branch does not repeat them. Its edits sit beside 575's in `releaseSeats`, `handleUpdateRSVP` and `handleClaimSpot`, and both use "the last statement of the batch", so the merge is mechanical.

**How it is held.** `offerNextAsMain` in `worker/src/waitingList.ts` is main's `cascadeWaitlist`, kept as it was with two changes (A9-6 and A9-3). `offerOn(open, …)` picks Launch 3's `offerFreedSeats` or main's cascade. `ReleaseSeatsInput.asMain` writes no seat notice and runs main's cascade. Every caller reads `anyoneHostsOpen(env)`.

**Test:** `worker/tests/queue-cases-flags-off.test.ts`. There is one describe per case, each with the closed answer and, where it differs, the open one. 28 tests, all pass.

| # | Case | Off means | Why |
|---|---|---|---|
| 1 | Expired claim | Old. The answer is 410 `{error:'Claim window has expired'}` with no code. The offer is cleared (guarded on the same deadline) and main's cascade runs. It may offer the same guest again. | Not one of the kept fixes. The site never reads `code`. |
| 2 | Claim with no deadline, `offer_lapsed_at` set | Old: 400 "No claim offer pending". | Only Launch 3 writes the lapse mark. Closed, the mark means nothing. |
| 3 | Cascade with no seat free (for example a no at a full table) | Old. The first waiting guest gets a claim window and a `waitlist_promotion` row. | Main's behaviour. Main's own claim still refuses a seat that is not there (`capacity_conflict`), so the count cannot pass the seats. **For Adrian:** a phantom offer counts as a seat taken until it runs out. Say if you would rather keep the new rule while the switch is off. |
| 4 | First waiting guest already holds a live offer | Old: their deadline is renewed, and nobody else is offered. | Main's behaviour. Same note as case 3. |
| 5 | Saying no to a waiting guest who holds a live offer | Old: 200 `denied`, and the offer ends with the no (`claim_expires_at` cleared, which nobody sees), then main's cascade runs. A no to someone already said no to is also 200, as on main. | Main's behaviour. Kept from the new code: a **confirmed** guest is still refused (409) and is released instead. Main left their seat rows held, which is the leaked-seat bug the seat fixes close. Main also took a no on a cancelled guest; that is refused too. |
| 6 | Saying no to a requested guest | Old: main's cascade runs after the no. | Main's behaviour. |
| 7 | Moving a guest to the waiting list | Old. A requested, denied, cancelled or already-waiting guest moves to the end of the queue, and no offer is made. A live offer is left as it was. | Main's behaviour. Kept from the new code: a **confirmed** guest is refused (409). Moving them would leave a held seat under a waiting guest, which breaks one seat each. |
| 8 | One release frees several seats | Old: one guest is offered per release. | Main's behaviour. |
| 9 | A seat frees at a by-request table | Old: the first waiting guest gets a claim window. They are not sent back to asking. | `returnWaitingToAsking` is Launch 3's (J13). |
| 10 | Scheduled run | Old: it does not run (`advanceWaitingLists` only while the switch is open). | Main had no such run. It was dormant anyway. |
| 11 | Removing a plus-one | Old: main's cascade (`cascadeWaitlist` → `offerOn`). | Main's behaviour. |
| 12 | Cancel, release and claim write seat notices | Old: no `event_seat_notices` rows at all (`releaseSeats` with `asMain`, and no `claimed` notice). | Nobody can see them while the switch is off. Writing none also means a closed offer is never one that "this code made", so the Launch 3 lapse rule never touches it later. |
| 13 | Admin or link cancel when the status changed in between | Old: 200. On an admin cancel, if the guest turned out to be cancelled already, the answer is 200 and main's cascade runs. A repeated link cancel also runs the cascade again, as main did. | Main always answered yes. In a real race the guarded write still writes nothing twice. |

**Two more, found on the way, closed the same way:**

- A host's no on their own table (the `/no` route and the `answer_guest` tool) offered nothing on main. Closed, it offers nothing.
- Changing a table's door or seats (`PUT /api/me/tables/:id`) offered nothing on main. Closed, it offers nothing.

**Kept new while off (A9-6):** a cancel during tea offers no seat. Tested in "kept from the review run".

**Tests changed.** In `worker/tests/a3-flags-off-audit.test.ts` (item 4, second test), the switch is off and the test now expects the offer made by main's cascade *not* to be lapsed (cases 10 and 12). In `worker/tests/waitlist-released-seat.test.ts`, the scheduled-run test now opens the switch, because the run is Launch 3's.
