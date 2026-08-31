# Order process — what is left, and how to pick it up

Shipped 2026-08-31 on `main` as `feat(orders): close the loop from request to payment`.
Three rounds of work are live. This is the handoff for the remainder.

Read first, in order: `order-process.md`, `order-process-round-2.md`,
`order-process-round-3.md` (what was built and why), then
`order-process-notes.md` (the cross-agent record, including deviations and open
questions that were deliberately not resolved).

## State of play

Live on the site. **The worker and the production database still need their own
step** — see "Deploy state" at the bottom before assuming any of this is running.

The order process now runs: a request arrives and is recorded, Adrian is emailed,
one click makes it a priced invoice, the invoice carries a pay link resolved to
the right tea master, the customer can report a transfer, Adrian confirms it
against his bank, and the order keeps a real payment history. What the customer
sees is derived from the order rather than maintained by hand. What needs Adrian
gathers into one list in Your Table. Six MCP tools reach all of it by voice.

## The five remaining, in the order worth doing them

### 1. Events, wholesale and samples do not use the payment layer

**Why it matters.** There are four ways to be owed money in this system and only
one of them was modernised. An event attendee who owes for a seat is tracked in
`event_attendees.payment_status`, a bare column with no ledger, no history, no
pay link and no way for them to report a transfer. Wholesale generates invoices
already marked `'Paid'` on receive, which is a lie the ledger cannot see.

**The shape.** `invoice_payments` is invoice-scoped and already correct. Events
close out into real invoices (`EVT-` numbers) at `worker/src/index.ts` around the
event close-out region, so the cheapest honest fix is to route event money
through those invoices rather than the attendee column, and let the existing
ledger do the work. Wholesale needs its `'Paid'` insert to write a matching
ledger row, exactly as `reconcileLedgerWithColumn` does for the legacy path.

**Do not** add a second payments table. The whole point of the ledger is that one
record answers "what is owed" everywhere.

Effort: about two days. Band: agent-runnable.

### 2. The payment rules are written twice

Already filed in `TODO.md` with the full list of the eleven mirrored functions.
`worker/src/invoiceDomain.ts` exists and has no dependency on `index.ts`, so the
ledger functions can move there and both files import them. The mcp.ts call sites
were written expecting this.

The same pass should close the one place the two implementations differ today:
`whats_waiting`'s unpriced query still requires `status = 'Draft'` on its
zero-price half, where `/api/attention` catches a zero-priced Pending order too.
The screen currently shows a superset of what the voice reports.

Effort: half a day. Band: agent-runnable.

### 3. The pay page does not say what it is being paid for

A customer arriving from an order sees an amount, a reference code, and transfer
details. It never names the order or what is in it. Someone with two open orders
cannot tell which one they are paying, and someone with one still has to trust a
code.

The pay page is public and unauthenticated, reached by URL, so it must not leak
order contents to anyone who guesses a reference. The safe version shows only
what the link already proves the holder knows, or requires the tracking token the
customer already has. Decide that boundary before building.

Effort: half a day. Band: agent-runnable, but the privacy boundary is a judgement
call worth confirming with Adrian.

### 4. A sample request is only recorded when the sample maps to a tea in the shop

`POST /api/inquiries` requires every line to carry an `id` resolving to a real
product in the account (`worker/src/inquiryDomain.ts`, and the handler in
`index.ts`). `SampleOrderModal` therefore records only when `sample.productId`
exists; other sample requests stay a plain WhatsApp message with no record, which
is the exact gap that was closed everywhere else.

The fix is to let an inquiry line be a named custom line with no product, the way
`handleConvertInquiry` already handles a retired tea. **This loosens validation on
a public write path**, so it needs its own thought: cap the name, keep the item
cap, and keep the rate limit.

Effort: an hour of code, longer to be sure the validation change is safe.
Band: agent-runnable.

### 5. An order can still be sent carrying a zero-priced line

When a converted request contains a tea that has been retired, the line arrives
at zero. That is deliberate, so nothing is silently dropped. Nothing stops the
invoice going out at that price.

Such an order now appears in the attention list as unpriced, so it is visible.
What is missing is a refusal at the point of sending: a Draft carrying a
zero-priced line should not become Pending without an explicit acknowledgement.

Effort: an hour. Band: agent-runnable.

### The sixth, low value

Three status vocabularies still describe one order internally: the inquiry's
`new/seen/replied/closed`, the invoice's `Draft/Pending/Filled/Void`, and
`unpaid/partial/paid`. The customer-facing half was fixed by the derived journey.
What remains only costs a reader of the code. Not worth a session on its own.

## Traps found the hard way, worth not rediscovering

- **The pay link asks in USD on purpose.** Prices are USD columns;
  `display_currency` is a label. Sending the display currency would have told an
  Indonesian customer to transfer 35 rupiah for a 35 dollar order. The local
  figure on the pay page is an approximation shown beside it, never instead.
- **A customer report is not money.** Nothing a customer does may move an invoice
  toward paid. Every surface and both voice tools hold this line; keep it.
- **`worker/src/index.ts` imports `mcp.ts`**, never the reverse. Anything shared
  goes in a leaf module.
- **The baseline schema had a Cloudflare internal table in it** (`_cf_KV`) which
  made a genuinely fresh database fail to build with `SQLITE_AUTH`. Removed. If a
  future schema dump is taken from the live database, strip `_cf_*` again.
- **`0001_order_process.sql` errors with a duplicate column against a fresh
  build** because its column is folded into `0000`. Expected, not a bug.
- **The shared `.wrangler` state has been corrupt more than once**
  (`_cf_ALARM has 3 columns but 2 values`). Run an isolated `--persist-to` when
  that appears rather than debugging it.
- **Two test failures on main are not yours**: `helmetTitle` fails only because
  the checkout path contains a space it does not decode, and `shopPrice` has a
  stale expectation. Both predate this work.

## Deploy state

The site is live. **Still to do, in this order and no other:**

1. Apply `worker/migrations/0001_order_process.sql` and
   `worker/migrations/0002_invoice_payments.sql` to the production database.
2. Deploy the worker by hand (pushing to main does not deploy it).

Deploying the worker before the migrations would put code live that queries a
column and a table production does not have, and every order surface would fail.
Until both are done the site runs on the old API: the new features are simply
absent, which is the degraded state the surfaces were built to tolerate.
