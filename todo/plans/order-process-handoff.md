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

## Where this stands

Four of the five are done, plus the deploy steps that were already done before
this handoff was written. **One remains, and it is the one that needs Adrian:**
item 3, what the pay page is allowed to say about the order, because the page is
public and reached by URL. Everything below is kept in place with its outcome
written into it, so the reasoning behind each decision stays readable.

## The five, in the order they were worth doing

### 1. Events, wholesale and samples do not use the payment layer — DONE 2026-08-31

**Wholesale was worse than described, and is fixed.** The two invoices written on
receive carried `status = 'Paid'`, which is not one of the four statuses the app
knows (Draft, Pending, Filled, Void), so the row rendered under a status that
cannot exist. `payment_status` was left at its default `'unpaid'`, so the two
money columns on the same row contradicted each other. And there were **no line
items at all**, so the order was worth nothing and the ledger, the pay link and
the attention list could not see the money.

They are ordinary invoices now: real lines from `wholesale_order_items`,
converted to dollars, `'Filled'` with `fulfilled_at` set because receiving IS the
goods changing hands, and `'unpaid'` because receiving tea is not paying for it.
Wholesale settles through the same ledger, pay link and confirm flow as
everything else. Receiving is now REFUSED when a line's currency has no exchange
rate, because a received invoice is created already fulfilled and would never
resurface as unpriced: the zero would sit there silently, which is exactly the
7x-mispricing class of failure. The refusal names the currency and nothing
half-lands.

**The events half of this item was wrong.** It was read off the schema.
`event_attendees.payment_status` exists with a five-value CHECK constraint and
**nothing in the worker reads or writes it** — the only reference anywhere is a
test asserting the constraint rejects a bad value. Event money already runs
through ordinary `EVT-` invoices, which are created `'Draft'` / `'unpaid'` with
line items and therefore already use the ledger. There is no second record to
reconcile. What IS true about events: they carry no seat price anywhere in the
schema, so every line closes out at zero and the operator prices each attendee's
order by hand. That is a product gap, not a payment-layer one.

The dead column is left in place (dropping a column on D1 is not worth the risk)
but it is a trap: a future session will find it and wire something to it. Filed
in `TODO.md`.

**Samples: done, see item 4.**

### 2. The payment rules are written twice — DONE 2026-08-31

The eleven mirrored pieces moved into `worker/src/invoiceDomain.ts`, which
imports neither `index.ts` nor `mcp.ts`, and both now import from it:
PAYMENT_EPSILON, the text limits and caps, roundUsd, paymentTextField,
formatInvoiceNumber, loadInvoiceLedgerTotals, invoiceMoney, loadLedgerInvoice,
reconcileLedgerWithColumn, recomputeInvoicePaymentStatus. The two hand-written
invoice-number formats in mcp.ts went with them. No "keep in sync" note is left
in the worker.

The divergence is closed: `whats_waiting` required `status = 'Draft'` across
BOTH halves of its unpriced question, so a Pending order carrying a line priced
at nothing was on the screen and not in the spoken answer.
`worker/tests/attention-parity.test.ts` asks both surfaces the same question
across five states and asserts they answer identically; reverting the mcp.ts
predicate makes exactly the zero-priced-Pending case fail.

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

### 4. A sample request is only recorded when the sample maps to a tea in the shop — DONE 2026-08-31

A line may now be a named custom line with no product, the shape
`handleConvertInquiry` already produces for a retired tea. The sample screen files
a request either way, so the reference on the confirmation always stands for a
real record.

The validation loosening was fenced, and the fencing turned out to matter more
than expected: the product-id requirement had been doing duty as the anti-junk
gate on an unauthenticated write, and **there was no item cap and no length limit
on the free-text note at all**. So a custom line must now SAY it is custom (a
mistyped product id is refused, never a silent custom line), an order carries at
most 50 lines, a line name at most 120 characters, and the note at most 2000.
Three of those four are tighter than what shipped before.

### 5. An order can still be sent carrying a zero-priced line — DONE 2026-08-31

Draft to Pending is the only path that makes an order a real ask, and it now
refuses while any line sits at no price. The refusal names the lines, so the
orders screen asks about them by name and "Send anyway" is one click for the case
where a line really is meant to be free. It is a question, not a block: the
operator is the one who knows.

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

## Deploy state — DONE, and the warning below was already out of date

This section said the migrations and the worker deploy were still to do by hand.
They were not. `.github/workflows/deploy-worker.yml` applies D1 migrations and
deploys the worker on every push to main that touches `worker/**`, and has done
since 2026-06-01 (see `todo/plans/deploy-db-migrations.md`).

Measured 2026-08-31: the run for `feat(orders): close the loop from request to
payment` finished with "Apply D1 migrations" and "Deploy to Cloudflare Workers"
both green, and `https://teajia-api.lightcodes.workers.dev/api/attention` answers
401 rather than the 404 an unknown route gets, so the new worker is serving.

The ordering warning still holds for anything applied by hand: migrations before
the worker, never the other way round.
