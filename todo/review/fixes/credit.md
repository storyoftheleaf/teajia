Fixed by Opus 5.5 (cloud), in place of Astra.

# Tea credit fixes: A8-1 to A8-5, A8-8 to A8-10, and A10-1

Branch `review/fix-credit`. Findings: `todo/review/findings/A8.md`, `todo/review/findings/A10.md` (A10-1 only).

How to rerun: `NODE_OPTIONS=--experimental-sqlite node_modules/.bin/vitest run worker/tests/review-credit-ledger.test.ts worker/tests/review-open-then-close.test.ts worker/tests/host-credit-*.test.ts src/admin/components/TeaCreditSection.test.tsx src/components/hostCreditScreens.test.tsx`. Pass `--no-file-parallelism` on a small machine; under full parallel load some 5 second test timeouts trip, and each of those files passes when run alone.

## The contract as built

- An order earns once, at its first Fill while HOST_CREDIT is open, from the server's own figure. One rule decides what happens to an order first Filled while closed: `CLOSED_FILL_EARNS_LATER` in `worker/src/hostCreditLedger.ts`. It is `false`, the recommended answer to A8-5's question for Adrian: such an order never earns, whatever is edited later. Setting it to `true` lets an order Filled while closed earn on its next settle while open. A full catch-up would also need a sweep of every such order when credit opens.
- A Void reverses every award on that order and releases its holds, whether the switch is open or closed. Closed, settle earns nothing new, reads no source and files nothing. It sends one batch that touches only that order's own Void and first Fill.
- Available credit is never more than earned less reversed, spent and held. A spend is rechecked in the statement that posts it: the tea still on the order, the amount still owed and the buyer must all still allow it. A hold on an order that is Void or removed is released, and the request row and its history are kept.
- Approved credit settles the order. It appears as `credit_usd` beside `paid_usd`, which stays cash only, and the amount due drops by it on every surface that reads `invoiceMoney`.
- A replayed use request with the same Idempotency-Key returns the original request.

Migration `worker/migrations/0149_host_credit_fills_and_request_keys.sql` (also added to `worker/schema.sql`) only creates and alters. It adds the table `host_credit_fills`, two triggers that write a row the first time an order becomes Filled by any path, a third that records an order leaving Filled with no row as first Filled while closed, and two columns on `host_credit_spend_requests`: `request_key`, with a unique partial index, and `release_reason`. It changes, adds and removes no existing rows.

## A8-1: approving tea credit leaves the customer owing the full price

- Changed: `worker/src/invoiceDomain.ts`. `loadInvoiceLedgerTotals` now reads approved 'spent' rows as `credit_usd` in the same single query. `invoiceMoney`, `recomputeInvoicePaymentStatus` and `reconcileLedgerWithColumn` count that credit as settlement. A column that says 'paid' lifts cash only to the part the credit did not cover, so the credit is never shown as cash. After posting the spend, the approval recomputes the order's `payment_status`.
- Proof: `approving tea credit reduces the amount due for the tea` (now passes: outstanding $0, paid_usd 0, credit_usd 10, status paid, no invoice_payments row) and `credit on part of an order leaves the rest owing, in cash` (new: $15 order with $10 credit owes $5, status partial).

## A8-2: saving the same tea line on a reopened order can award the whole order twice

- Changed: `earnInvoiceCredit` treats an order that has already earned as finished. No further pending or earned row is written for it, and the write itself refuses an award while any award exists on the same order for a line outside the current batch, which guards against races. Pending rows for lines that were since replaced no longer count in the waiting balance once the order has earned.
- Proof: `reopening, correcting and refilling one sale cannot earn it twice` (now passes), and the new `reopened with new lines, two Fills at once still award the sale once`.

## A8-3: a price reduction after a request lets the owner spend more credit than the tea costs

- Changed: the spend statement in `approveHostCreditSpend` adds `ORDER_STILL_TAKES_SQL`. The buyer must still be the host, the order must not be Void, removed or cancelled, the request plus every other approved use must fit within the tea on the order now, and the request must be no more than is still owed. When the order no longer takes the request, the same batch releases it (`declined`, `decided_by_user_id = 'system'`, `release_reason = 'order_changed'`) and the route answers 409 `host_credit_order_changed`, so the host can ask again for what the order holds now. The hold and the host's offer are also capped at what is still owed.
- Proof: `approval checks the tea still on an edited redemption order` (now passes, and goes on to ask again for $1 and approve it), plus the new `approval checks the buyer is still the host` and `approval checks what is still owed, not only the tea`.

## A8-4 and A10-1: credit from an order voided while HOST_CREDIT is closed stays spendable

- Changed: `settleHostCredit` records a Void's reversal whether the switch is open or closed (A10's option one). For rows written before the fix, `reconcileHostCredit` reverses every unreversed award on a Void order before a balance is shown or spent: on the host's read, the shop's read, a use request and an approval.
- Proof: `a Void while closed cannot leave the cancelled award spendable on reopening` (now passes, and the reversal row is present). In `review-open-then-close.test.ts`, the `it.fails` case is now a plain passing `A10-1: an order voided while the switch is closed takes its credit back`. The "as it stands" case, which asserted the bug, is replaced by `A10-1, an award left unreversed before the fix is reversed when credit reopens`, which writes the old row shape first. The ledger suite adds the same check as `an award left unreversed on a Void order before the fix cannot be spent`.
- Existing test changed: `host-credit-identity-health-audit.test.ts`, `closed, reads nothing and files nothing`, is now `closed, reads no source and files nothing`. The old contract ("closed does nothing at all") is the one A10-1 and A8-5 required me to change. The test still drops the credit tables and asserts that nothing fails, nothing is filed and no source is read. It now allows only the closed batch's own statements.

## A8-5: two identical sales Filled while credit is closed earn different amounts

- Changed: `host_credit_fills` records each order's first Fill, written by a trigger on any path. Settle stamps `credit_open` once with the switch state at that moment. Only an order stamped open earns; one stamped closed writes no pending or earned row again. In the host's and the owner's line lists, its pending lines read as `void` (shown as Cancelled), and they are left out of the waiting balance and the second look.
- Rows written before the fix: an order Filled before 0149 has no row. It earns only if it was already held as pending before, which is the one sign it was seen while credit was open. If it is reopened (leaves Filled), the third trigger records its unrecorded first Fill as closed, so a later Fill never earns (`a sale Filled before the record began, reopened and Filled again while open, does not earn`). The live shop has always had credit closed, so none of its earlier sales earns when credit opens.
- Proof: `identical sales Filled while closed have equal credit after reopening` (now passes), plus the new `a sale Filled while closed never earns, even reopened and Filled again while open`, and two old-shape cases: `a sale Filled before the record began does not earn on a later edit` and `a sale Filled before the record began, already held as pending, still earns once paid`.

## A8-8: a delayed retry can put a declined request back in the owner's queue

- Changed: `POST /api/me/tea-credit/orders/:id/use` reads `Idempotency-Key` (printable characters only, at most 200). It stores the key on the request, with a unique index per shop, host and order. A replay returns the original request with 200 and `replayed: true`, whatever became of it, and a race between two replays returns the winner's request. A deliberate new request with its own key is a new request.
- Proof: `a delayed keyed retry cannot reopen a declined spend` (now passes; it also checks that a new key makes a new request). The new `two keyed replays at once make one request`.
- Test changed: the `it.each` case `replaying a use request with key %s while held cannot reserve twice` expected 409 for a keyed replay as well. That 409 was the finding's evidence that keys were ignored, so it is now two cases. Without a key, a replay still answers 409. With a key, it answers 200 with the original request. In both cases there is only one request row.
- The site sends the key (the coordinator's commit eb8ce3d). `TeaCreditPage.tsx` keeps one key per order in a ref, reused on a retry and cleared on success or on a definite 4xx refusal.

## A8-9: voiding an order leaves unapproved credit held against it

- Changed: the Void batch releases every held request on that order, open or closed (`release_reason = 'order_void'`, decided by `system`), and `reconcileHostCredit` releases holds left on Void or removed orders by earlier code. Approving a released request answers 409 and names the reason. The host's own request list now carries a `released` field.
- Proof: `voiding an order releases its unapproved hold` (now passes, and checks the release row). The new `a Void while closed releases a hold on that order`, and `a hold left on a voided order before the fix is released when credit is next read` (old row shape written first).

## A8-10: approving an over-limit request from the host's detail takes three clicks

- Changed: `src/admin/components/TeaCreditSection.tsx`. The Decline, Approve and Approve anyway controls are now one component, `SpendDecisionControls`, which appears in the Waiting list and beside each waiting request in the host's detail. The worker's over_ceiling answer still turns Approve into Approve anyway, so the confirmation is kept.
- Proof: `src/admin/components/TeaCreditSection.test.tsx`. In `approves an over-ceiling request in two clicks, keeping the confirmation`, the host's detail is pressed Approve, then Approve anyway. The repo has no DOM test environment, so the test expands the detail's hook-free parts and presses the buttons' own handlers.

## Left as they are (questions for Adrian)

- A8-6 (a seller's Fill counts): `an approved shop seller cannot award credit without the owner marking Filled` still fails, as intended.
- A8-7 (a reversed award already spent leaves debt that later earnings repay): `Void of an already spent earning leaves a nonnegative signed ledger` and `checks every step of 320 seeded schedules across three orders` still fail, both on the signed ledger going to minus $10. I checked that the schedule test fails only on A8-7: with its net-not-below-zero line removed, every other invariant held at seeds 812345, 1, 77 and 4242.
- Unchanged by choice: a self-order earns nothing, and voiding a redemption order keeps the spend (`Void of the redemption order currently leaves approved credit spent` passes).

## Gaps worth knowing

- **First Fill while closed.** The first-Fill stamp relies on every Fill path calling `settleHostCredit` afterwards, which they all do today. If a future Fill path skips it, the next settle while open stamps that order as Filled while open.
- **Migration number.** 0148 was taken on main (`0148_freight_service.sql`), so this is 0149.
- **Pre-existing failures.** `review-older-data.test.ts` and `review-one-fact-every-door.test.ts` fail 9 cases both with and without this change. Those cases belong to other findings.

## After the independent reread

- **F1, an order settled by credit could not ship.** `settledUsd` and `settledUsdSql` in `worker/src/invoiceDomain.ts` count cash plus approved credit. They are now used by `deductStockForPaidInvoice` (`worker/src/orderLifecycle.ts`), the balance check and the guarded update in `ship-invoice` (`worker/src/index.ts`), and the one guarded ship update in `worker/src/mcp.ts` (that line plus its import, nothing else). An approval that settles the order runs `applyConfirmedPaymentStock`, and the decision answer carries `stock`. Proof: `an order settled by tea credit alone takes its stock and ships` and `an order settled by tea credit plus cash takes its stock and ships`. The refund checks that ask whether any cash came in are left on cash.
- **F2, an old Fill counted again.** The third trigger, described above.
- **F3, a replaced line counted twice.** The waiting balance counts pending rows only for lines still on the order. Proof: `the waiting balance counts only lines still on the order`.
- **F4, a retry made a new request.** Fixed in `src/pages/TeaCreditPage.tsx`, as described under A8-8.
- **F5.** The migration is renamed to 0149.
- Because a credit-settled order now has its stock taken, voiding one goes through its cancel action, as for any paid order. `Void of the redemption order currently leaves approved credit spent` now cancels through `rpc/cancel-invoice` and still shows the spend kept.
