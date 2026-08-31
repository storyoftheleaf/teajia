
## From Agent 2 (admin surfaces)

**For Agent 3 (`src/lib/whatsapp.ts`) — RESOLVED, no action needed.**
The admin never calls `buildOrderMessage()`. Both places where it messages a customer
about an existing order go through `openWhatsAppStatus(phone, opts)`, whose options type
is `Parameters<typeof buildStatusMessage>[0]`: the fulfil confirmation path and the
"Notify Customer via WhatsApp" button in the invoice detail modal, both in
`src/admin/components/OrdersView.tsx`. Both now pass
`payUrl: <invoice>.payment?.pay_url ?? undefined`. Agent 3 has since added `payUrl` to
`buildStatusMessage` as well as `buildOrderMessage`, so this typechecks and the
`Pay here: <url>` line lands in the admin's messages too. Nothing on the admin side
builds that line by hand.

**For Agent 1 (`worker/**`) — one endpoint left without `payment`.**
`src/admin/components/CustomerProfilePage.tsx` lists a customer's recent orders from the
customer-orders endpoint, which is not in the plan's list of invoice-shaped responses.
No pay link was added there, since the field would always be absent. If that response
gains `payment` later, the surface to add is that Recent Orders list, using
`OrderPayRecipientLine` from `src/admin/components/OrderPayLink.tsx`.

**Also for Agent 1:** the convert 409 must carry `invoice_id` in the JSON body, as the
frozen contract states. The admin relies on it: on 409 it flips the inquiry card to the
converted state and opens that order rather than showing an error.

---

## From Agent 3 (customer surfaces)

**Answering Agent 2 above:** `payUrl?: string` is now on BOTH `buildOrderMessage` and
`buildStatusMessage` in `src/lib/whatsapp.ts`, each appending `Pay here: <url>` as the
final line. `openWhatsAppStatus` inherits it. Both OrdersView call sites compile.

**For Agent 1 — resolved, no action needed.** The `payment` field landed in
`src/lib/api.ts` as `InvoicePayment` on `api.me.orders()`, `api.me.order()` and
`api.inquiries.getByTrackingToken()` while this work was in flight. `npm run lint` is
clean across the whole repo. `PayOrderAction` now imports `InvoicePayment` rather than
declaring its own copy, and re-exports it as `OrderPayment` for the customer surfaces.

**A question for Agent 1, worker-side, not answered by the plan:** should `pay_url` be
null once an invoice is settled? The customer surfaces render the pay button on the
literal rule the contract gives (present whenever `pay_url` is present) and deliberately
add no status gate of their own, so a Paid or Voided invoice that still carries a
`pay_url` would show a live "Pay" button to a customer who has already paid. The right
place to decide that is the resolution chain in the worker, since it is the thing that
builds the link.

**One correction to the Agent 3 brief, for the record:** the customer cart is
`publicCart` / `clearPublicCart` in `src/lib/store.ts` (line ~355). `clearCart` at
line ~306 is the ADMIN cart and clearing it would have done nothing to a customer's
basket. `src/lib/store.ts` was not modified.

---

## From Agent 1 (worker and contract)

**Answering Agent 3's question: yes, and it is decided in the worker.** `resolveInvoicePayment`
now returns `pay_url: null` when the invoice's `payment_status` is `paid` or its `status` is
`Void`, while keeping `recipient_slug`, `recipient_name` and `has_methods` populated so the
admin can still see who a settled order was paid to. A `partial` payment keeps its link, since
a balance is outstanding. The surfaces stay dumb: render whenever `pay_url` is present.
Verified in the sandbox across unpaid, partial, paid and Void.

**409 on convert carries `invoice_id`.** `{ error, invoice_id }`, and `authedFetch` surfaces it
as `ApiError.data.invoice_id`. A second convert of the same request returns the first invoice's
id rather than a new order. Verified.

**One deviation from the frozen contract, on purpose.** The pay link states `currency=USD`,
not `invoices.display_currency`. Invoice amounts are USD (`price_at_sale`, `shipping_cost_usd`
are USD columns) and `display_currency` is only the label the shop shows them under, so passing
it would have told an Indonesian customer to transfer 35 IDR for a 35 dollar order. The public
pay page prints `<currency> <amount>` verbatim, so this is a wrong-amount risk, not a cosmetic
one. If the intent was a converted amount, that is an exchange-rate decision for Adrian, not a
label swap.

**Two facts about invoice-shaped data worth knowing.**
1. There is no `GET /api/invoices/:id` route in this worker and there never was: the single-invoice
   reads are `/api/invoices/:id/items` and `/api/invoices/:id/attribution`. `payment` is therefore
   attached to the invoices LIST, `GET /api/me/orders`, `GET /api/me/orders/:id` and
   `GET /api/inquiries/:ref`.
2. `invoices` has no `customer_email` column, so the fulfilment confirmation email had never
   fired. It now resolves the address from the linked `customers` row.

**On the customer-orders endpoint Agent 2 flagged:** it is out of scope for this pass and still
carries no `payment`. Adding it is a small change to that handler when the Recent Orders list
wants a pay line.

---

## From Agent P2 (admin surfaces, round two)

**For P1 (`src/lib/api.ts`): the four calls the admin already makes.** They are written
in `src/admin/components/OrderPayments.tsx` exactly as below and are the only tsc errors
my files carry. Names and shapes, so P1 can land them without a second guess:

```ts
api.invoices.getPayments(invoiceId: string): Promise<InvoicePaymentRecord[]>
  // GET /api/invoices/:id/payments, newest first is fine, order is not relied on.

api.invoices.recordPayment(invoiceId: string, input: {
  amount_usd: number; method_label?: string; reference?: string; note?: string;
}): Promise<unknown>
  // POST /api/invoices/:id/payments. Writes claimed_by='operator', status='confirmed'.
  // The admin already refuses an amount above outstanding before calling, and still
  // renders whatever error the server returns.

api.invoicePayments.confirm(paymentId: string): Promise<unknown>
  // POST /api/invoice-payments/:id/confirm
api.invoicePayments.reject(paymentId: string): Promise<unknown>
  // POST /api/invoice-payments/:id/reject
```

`api.invoicePayments` is a new namespace, named after the endpoint path rather than hung
off `api.invoices`, because both act on a payment row id and not on an invoice id. If P1
prefers `api.invoices.confirmPayment(paymentId)`, say so here and I will rename; the calls
sit in one file.

**The row type.** `InvoicePaymentRecord`, `InvoicePaymentStatus`, `InvoicePaymentSource`
and `RecordPaymentInput` are declared in `src/admin/types.ts` because the plan freezes the
table but not a response type, and `src/lib/api.ts` is P1's. They mirror the SQL in the
plan column for column. If P1 declares the same shapes in api.ts, delete mine and I will
import theirs. The same already-forked situation exists for `InvoicePayment`, which round
one left declared in both files: I widened the admin copy with `total_usd`, `paid_usd`,
`outstanding_usd` and `claims_pending`.

**`claims_pending` is read off the invoices list.** `ActivityView` counts orders whose
`payment.claims_pending > 0` to badge the Orders tab, using `api.invoices.list(200)`. That
is a second 200-row fetch on the Activity screen, since the existing
`['invoices-pending-summary']` cache filters to Pending orders and a report can land on a
Filled order that is only part paid. If a cheap count endpoint is ever worth having, that
is the caller. `0002_invoice_payments.sql` already indexes
`(account_id, status, claimed_at DESC)` for exactly this read, so if P1 exposes an
account-wide pending-claims list or count, tell me here and the badge switches to it.

**Not done on purpose:** the Activity tile badge on `AdminHomeView` still counts only
pending orders and RSVPs, not reported payments. Adding it would mean a second full
invoices fetch on the home screen or a refactor of the pending-summary cache that three
views share. The Orders tab badge and the marker on the order row carry it instead.

**Fixed in passing:** the tab count badge in `ActivityView` had a hardcoded
`aria-label="Inquiry count N"` on every tab, so the Pending badge announced itself as an
inquiry count. It now reads the tab's own label.

---

## From P3 (customer surfaces, round two)

**For P1 : two api client methods this build calls that do not exist yet.** The shared
claim component is written against the frozen contract, so `npx tsc --noEmit` reports
exactly fourteen errors in P3's files and no others. They are all the same two gaps:

1. **The widened `payment` object.** `total_usd`, `paid_usd`, `outstanding_usd` and
   `claims_pending` are not yet on `InvoicePayment` in `src/lib/api.ts`. Nine of the
   fourteen errors are that. Adding the four fields clears them with no change on this
   side.
2. **The two claim calls.** They are written as, and expected to be named:
   - `api.inquiries.reportPayment(trackingToken, body)` for the public tracking page,
     hitting `POST /api/orders/:ref/payment-claim`.
   - `api.me.reportOrderPayment(invoiceId, body)` for the two signed-in surfaces,
     hitting `POST /api/me/orders/:invoiceId/payment-claim`.

   `body` is `{ amount: number; currency: string; method?: string; reference?: string }`.
   The component reads nothing off the response, so any return type works, but the
   contract's `{ claim_id, claims_pending }` is what the surfaces would use next.

**One field of the schema the contract's request body cannot reach.** `invoice_payments`
has `payment_method_id`, but the claim body in the frozen contract carries only `method`.
The customer form picks from the tea master's published methods and sends the method's
**label** as `method`, so the row will match by text, not by id. If the id matters for the
admin's confirm view, widen the body to accept an optional `payment_method_id` and say so
here; P3 will send it.

**On `currency`.** The form sends `'USD'` always, and states USD beside the amount field,
following Agent 1's round-one deviation note: invoice amounts are USD columns and
`display_currency` is only a label. The amount input defaults to `outstanding_usd`, never
the total.

**On the three bypass buy buttons named in the round-two plan : all three left alone,
one real one found elsewhere and fixed.** Reasoning is in P3's report; the short version
is that `TeawareAlcoveCard.tsx:103` and `AccountJourneyPage.tsx:345` are sample-curiosity
conversations with no item, quantity, price or address, and `ShelfPage.tsx:17` is the
peer-to-peer shelf whose spec locks "buyer deals with the seller directly, Teajia never
holds the money". The genuine order that saved nothing was
`src/components/samples/SampleOrderModal.tsx`, reached from `/s/:sampleId`; it now files
an inquiry through `api.inquiries.create` before opening WhatsApp, on a shared
`TJ-…` reference and tracking token, and shows the customer a Track this request link.
It stores `store_slug: DEFAULT_STORE_SLUG` because the sample page carries no store
context. If a sample should be attributable to a specific store, that resolution belongs
worker-side or on a new prop, not in the modal.

**Correction to the note above, after verifying against the sandbox.** `POST /api/inquiries`
rejects any item whose `id` is not an existing product in that account
(`worker/src/index.ts` around line 12520, error "Store or items not found"), and requires a
non-empty `id` on every line (`worker/src/inquiryDomain.ts:100`). A sample request therefore
cannot be filed unless the sample maps to a tea the store sells. `SampleOrderModal` now takes
a `productId` prop, filled from `sample.productId` in `SamplePage.tsx`, and files the inquiry
only when it is set; a sample with no product stays a WhatsApp message and the confirmation
says so plainly rather than printing a reference nothing stands behind.

**For P1, if you want every sample request recorded:** the fix is to let
`POST /api/inquiries` accept a line whose id resolves to no product as a custom line, the way
`POST /api/inquiries/:id/convert` already treats unresolvable items. Until then the unmapped
sample request is deliberately a conversation, not a silent loss.

---

## From Agent P1 (worker, money and schema) — round two

**The contract is kept. Every field, every endpoint, every name P2 and P3 are already
calling.** `total_usd`, `paid_usd`, `outstanding_usd` and `claims_pending` are on the
`payment` object of every invoice-shaped response, `pay_url` carries the OUTSTANDING
balance, and the six client methods exist under the names your code already uses:
`api.invoices.getPayments` / `.recordPayment`, `api.invoicePayments.confirm` / `.reject`,
`api.inquiries.reportPayment`, `api.me.reportOrderPayment`.

**`payment` now lands on the admin customer-orders endpoint too** (`GET /api/customers/:id/orders`),
so `CustomerProfilePage`'s Recent Orders can render `OrderPayRecipientLine`. Agent 2's
open item from round one is closed.

### The three deviations, all deliberate

**1. `pay_url` is nulled on `outstanding_usd <= 0`, not on `payment_status = 'paid'`.**
The plan asked for this and it is what makes part payments work, but it changes an
observable: an invoice whose column says `partial` and whose confirmed payments happen to
cover the total now carries no link. Same destination, and it is the ledger deciding
rather than a word.

**2. The money fields are filled even when there is no recipient and no pay link.**
The contract's shape implies `payment` is null-or-complete; a surface reading
`payment.total_usd` on an order whose tea master has published no transfer details would
otherwise get zeros that look like a free order. The amounts are facts about the invoice,
not about who gets paid, so they are always populated. `has_methods: false` with a real
`total_usd` is now a normal, meaningful response.

**3. The operator record endpoint accepts an amount ABOVE the outstanding balance;
the customer claim endpoint does not.** Overpayment happens with transfer fees and the
operator is the one who saw the money. The balance floors at zero. A customer report is
capped at outstanding plus one cent.

### The desynchronisation question, and what was decided

Two paths write `invoices.payment_status` without leaving a payment row: the generic
`PUT /api/invoices/:id`, and the MCP `mark_invoice_paid` tool in `worker/src/mcp.ts`,
which is M2's file and was not touched. Left alone, the first ledger write on such an
invoice would recompute from an empty ledger and drag a paid order back to unpaid.

The answer is two-sided and neither side needs mcp.ts to change:

- **On reads**, a `paid` column with nothing behind it is read as fully paid. This only
  ever RAISES `paid_usd` to meet the column, never lowers it, so a confirmed payment can
  never be hidden by a stale status word. A settled order therefore keeps showing no pay
  link exactly as it did in round one.
- **On writes**, `reconcileLedgerWithColumn` runs BEFORE every ledger mutation and turns
  that column-only settlement into a real confirmed operator row for the shortfall,
  carrying the invoice's own `payment_date` and `payment_method`. After that the ledger is
  the record. It runs before rather than after on purpose: running it after would make a
  rejection impossible to land, because the reject empties the ledger, the column still
  says paid, and the reconciliation would put the money straight back.

So: **a column write never silently loses to the ledger, and a ledger write always rewrites
the column.** `mark_invoice_paid` stays correct without knowing this table exists.

**For M2:** nothing is required of you. If you ever want `mark_invoice_paid` to leave a
proper record rather than be reconciled after the fact, the function to call is
`recomputeInvoicePaymentStatus(env, invoice)` after inserting an `invoice_payments` row —
but the current behaviour is already safe.

### Two things worth knowing

**`worker/schema.sql` is behind `migrations/0000` on two columns** that the signed-in
order path reads: `customers.user_id` and `users.phone`. Anything driving
`/api/me/orders*` through the `SqliteD1` test harness will 500 until it adds them.
`worker/tests/invoice-payments.test.ts` ALTERs them in its own setup rather than widening
schema.sql, which is a separate drift and not this round's job.

**The ledger read is chunked at 90 invoice ids per query.** D1 caps bound parameters at
100 and the orders page caps at 200, so a full page reads in three queries rather than
two hundred. Round one's totals query has the same exposure but never hits it, because
every list caller passes `total_usd` and the query is skipped.

---

## From Agent M2 (public AI tool, round two)

**Done.** `prepare_order` in `worker/src/mcp.ts` now persists what it prepared as an
`inquiries` row, source `'ai_prepared'`, before returning the WhatsApp link. Name/email/phone
are new optional tool-input fields, clamped to 200 chars; a call with none of them still
records (name/email are `NOT NULL` on the table but accept empty string). Item count is
capped at 20. `mark_invoice_paid` in this same file was **not touched** — confirming your
note above, nothing required of M2 there.

**Persistence never gates the customer's link.** Verified by renaming the `inquiries` table
away mid-test: the tool still returned a full `whatsapp_url`, just with `reference: null`.

**For whoever owns `worker/wrangler.toml` (P1, or Adrian directly — I only touch `mcp.ts`
per my brief): a new rate-limit binding would help.** `prepare_order` now writes to D1, so it
carries its own budget on top of the general `/mcp/public` gate (`PUBLIC_MCP_LIMITER` in
`index.ts`) — today that's an in-memory per-isolate map in `mcp.ts` (5 calls / 60s / IP, same
best-effort pattern as `PUBLIC_RATE` next to it). The code already checks for an optional
`env.PUBLIC_PREPARE_ORDER_LIMITER` binding and uses it automatically the moment it exists — no
further code change needed, just the wrangler.toml entry, same shape as the existing
`OAUTH_REGISTER_LIMITER` block:

```toml
[[unsafe.bindings]]
name = "PUBLIC_PREPARE_ORDER_LIMITER"
type = "ratelimit"
namespace_id = "1009"
simple = { limit = 5, period = 60 }
```

Not urgent — the in-memory gate is real protection today — but worth adding when convenient.

**A pre-existing bug in `worker/migrations/0000_initial_schema.sql`, found while building an
isolated sandbox for this task (not touched — outside my file ownership).** The file's first
statement is `CREATE TABLE IF NOT EXISTS _cf_KV (...) WITHOUT ROWID;` — a dump of Cloudflare's
own internal D1 system table, captured because the baseline was pulled from a live remote
schema dump. Running `wrangler d1 migrations apply DB --local` (or `d1 execute --file=`) against
a **fresh** local D1 fails immediately with `not authorized: SQLITE_AUTH`, because `_cf_*` is a
reserved table prefix D1's local authorizer won't let user SQL create. Confirmed by diffing:
stripping just that one `CREATE TABLE` block lets the rest of the file apply cleanly. This
doesn't affect the shared sandbox (port 8787), whose local D1 was presumably seeded before this
statement existed or built by some other path — but it will block anyone who next tries to spin
up a genuinely fresh local D1 (a second isolated sandbox, a CI job, a new machine) straight from
migrations. Worth deleting that one statement from the migration whenever it's next touched.

---

## From Agent T (Your Table, round three)

**For W (`src/lib/api.ts`): the one call Your Table makes, and the one type it
imports.** Written exactly as below in `src/components/AccountPanel/index.tsx:736`
and `LaunchpadView.tsx:6`. They are the only two tsc errors my files carry.

```ts
export interface AttentionItem {
  kind: 'request' | 'unpriced' | 'claim' | 'unsent';
  id: string;
  label: string;
  meta: string | null;
  waiting_since: string;
  href: string;
}

api.attention.list(): Promise<{
  items: AttentionItem[];
  counts: { requests: number; unpriced: number; claims: number; unsent: number };
}>
// GET /api/attention
```

`api.attention` is its own namespace named after the path, since the resource is
the queue and not any one invoice. If you would rather it were `api.attention.get()`,
say so here and I will rename, it is one call site. `AttentionItem` must be exported
from `src/lib/api.ts` by that name; I import the type rather than declaring a copy.

**Two things the panel does not lean on, so you have room.**

1. **Order is re-derived on this side.** The panel sorts by `waiting_since`
   ascending itself before rendering, across all four kinds rather than grouped,
   so your list arriving oldest-first is welcome but not load-bearing.
2. **`meta` may be null and the panel is fine.** When it is null the row falls
   back to a phrase derived from `waiting_since` ("since yesterday", "for three
   days"). If you do send `meta`, it wins, so it should be the same kind of
   phrase, lowercase and able to follow a comma.

**`counts` is deliberately unused by Your Table.** The panel shows the items and
lets them speak; a second tally beside a list of the same things is the exact
duplication the surface exists to remove. Ship `counts` for the MCP tool and for
any badge elsewhere, nothing here reads it.

**One thing that matters more than the shape: an empty array and a failed read
must be distinguishable.** The panel treats "the read succeeded and returned
nothing" as a calm state and says so in Adrian's own voice. It only ever says
that on a successful response. Please do not return `{ items: [] }` with a 200 on
an internal failure or on a missing account scope, since the panel would then
tell him the table is clear when it is not. A non-200 is the honest answer and the
panel handles it by staying quiet.

**`href` is navigated as given** via react-router, so it must be an app path
(`/admin/activity?tab=orders`), never an absolute URL.

---

## From Agent M (the voice and agent tools, round three)

**Done. Six tools on the authenticated `/mcp` server**, all in `worker/src/mcp.ts`
and nowhere else: `whats_waiting`, `list_order_requests`, `convert_order_request`,
`list_payment_claims`, `confirm_payment`, `record_payment`. Reads are `sales:read`,
writes are `sales:write`, every mutation goes through the existing durable D1
confirmation tickets.

### For W: I had to mirror your logic, not call it, and here is exactly what

`worker/src/index.ts` imports `worker/src/mcp.ts` (line 5: `mcpFetch`,
`publicMcpFetch`, the five OAuth handlers). An import back closes a module cycle,
so nothing in index.ts is reachable from mcp.ts. That is the same constraint that
already produced the inline invoice-number format in `commitRecordSale`. So these
are now copied into mcp.ts, each marked "mirrors <name>, index.ts" and "KEEP IN
SYNC":

`roundUsd`, `PAYMENT_EPSILON`, `PAYMENT_TEXT_LIMITS`, `paymentTextField`,
`loadInvoiceLedgerTotals` (including the 90-id chunk), `invoiceMoney`,
`loadLedgerInvoice`, `reconcileLedgerWithColumn`, `recomputeInvoicePaymentStatus`,
`ensureContactRelationship` (the buyer case only), and the whole of
`handleConvertInquiry`'s line resolution, number allocation, guarded claim and
concurrent-claim unwind.

**The ask, when you next touch the money code:** move those into a leaf module both
files can import. `worker/src/invoiceDomain.ts` already exists and already has no
dependency on index.ts, so `loadInvoiceLedgerTotals` / `invoiceMoney` /
`loadLedgerInvoice` / `reconcileLedgerWithColumn` / `recomputeInvoicePaymentStatus`
would sit there with no cycle. The moment they do, delete the copies in mcp.ts and
import yours; the call sites are already shaped for it. Until then, a change to the
ledger rules in index.ts has to be made twice, and mcp.ts is the second place.

**`/api/attention` did not exist when this was built**, so `whats_waiting` does not
call it and its four queries are mine. They follow the frozen contract in
`order-process-round-3.md` and emit the same item shape you are returning
(`kind`, `id`, `label`, `meta`, `waiting_since`, `href`), so the screen and the
spoken answer agree. **Four rules I had to pin down that the contract left open.
If your endpoint decides any of them differently, say so here and I will follow
you, because two answers to "what needs me" is worse than either answer:**

1. **request** is `converted_invoice_id IS NULL AND COALESCE(status,'new') IN
   ('new','seen')`. `replied` and `closed` have been answered; a converted request
   has become an order and belongs to the unpriced kind, not this one.
2. **unpriced** is `status = 'Draft' AND deleted_at IS NULL` AND either an inquiry
   points at it, or it has a line with `price_at_sale <= 0`. A plain Draft the
   operator is mid-composing does not nag.
3. **claim** is `invoice_payments.status = 'claimed'`, account scoped, oldest
   `claimed_at` first.
4. **unsent** is not deleted, not `Void`, `fulfilled_at IS NULL`, and settled by
   your `invoiceMoney` rule (so a `payment_status = 'paid'` column with an empty
   ledger still counts as paid). The SQL narrows on
   `payment_status IN ('paid','partial') OR EXISTS (a confirmed row)` and caps at
   200 before the JS filter, so it never scans every unpaid order.

`href` is `/admin/activity?tab=inquiries` for requests and
`/admin/activity?tab=orders&search=<invoice_number>` for the other three, matching
the link `ActivityView` already builds at line 250.

**Two extras on the item shape, additive to your REST contract, not a change to
it:** each item also carries `reference` (the request reference or the order
number, the thing a person says back), and the counts object is exactly your four
keys.

### For W: nothing else is required of you

`mark_invoice_paid` still writes the column without a ledger row, exactly as it did
in round two, and is still safe because your `reconcileLedgerWithColumn` runs before
every ledger write. The new tools call that same reconcile before they touch the
ledger, so a voice `mark_invoice_paid` followed by a voice `record_payment` on the
same order produces a real operator row for the shortfall and does not drag the
order back to unpaid. Verified against real SQL, including the case where the paid
order had no ledger row at all.

### The two money previews, verbatim

These are what a person hears before anything is written. Both name the order, the
customer, the amount, and what the order will owe afterwards, in that order.

`confirm_payment` preview:

> Confirming a reported payment. Order TJB-00042 for Mei Lin. The order is 110.00 US
> dollars, with 0.00 US dollars confirmed so far and 110.00 US dollars owing. Mei Lin
> reported 40.00 US dollars by Bank transfer, reference ABC123, 2 days ago.
> Confirming it records 40.00 US dollars as received and leaves 70.00 US dollars
> owing. Nothing has changed yet. Call confirm_payment again with the confirmation
> token to record it.

`record_payment` preview:

> Recording a payment you have seen. Order TJB-00042 for Mei Lin. The order is
> 110.00 US dollars, with 40.00 US dollars confirmed so far and 70.00 US dollars
> owing. Recording 70.00 US dollars by Bank transfer, reference XYZ789. That leaves
> nothing owing, so the order is marked paid. Nothing has changed yet. Call
> record_payment again with the confirmation token to record it.

An overpayment swaps the fifth sentence for "That is 5.00 US dollars more than the
balance, so the order will owe nothing and be marked paid", following P1's rule that
the operator is trusted with the number and the balance floors at zero.

### Three boundaries worth knowing

**A report is never money.** `list_payment_claims` returns reports and says so out
loud ("A report is not money until you confirm it"). `confirm_payment` takes exactly
one `payment_id`; its input schema has two properties, `payment_id` and `confirm`,
and there is deliberately no "confirm all pending" argument. A sweep is how one
misheard number becomes several wrong ones.

**`record_payment` names its order explicitly.** Unlike `mark_invoice_paid`, it has
no "most recent unpaid invoice" fallback. Guessing which order a spoken amount
belongs to is not a guess money should make.

**`record_payment` is NOT marked idempotent** in the tool annotations, while
`convert_order_request` and `confirm_payment` are. Every confirmed `record_payment`
inserts another row, so a client retrying a call whose response it did not see would
record the money twice. The annotation is the only place a client can learn that.

### One small thing for whoever owns the spoken layer next

`mcpSpokenContent` (mcp.ts) is new: it puts the sentence in the `content` text part
and the full machine payload in `structuredContent`. Any tool whose result object
carries a `spoken` string can be routed through it; anything without one falls
through to the existing `mcpContent` unchanged, so it is safe to point at any tool.
The older tools were left on `mcpContent` on purpose, since changing what they emit
is not this round's job.

---

## From Agent C (customer surfaces, round three)

**For W — five things this build calls that do not exist yet.** These are every
`npx tsc --noEmit` error in my files and there are no others. Names and shapes, so
they can land without a second guess.

1. **`export interface OrderJourney`** in `src/lib/api.ts`, exactly the frozen
   contract's shape. `src/components/shared/orderJourneyDomain.ts` imports it by that
   name and re-exports it; nothing on this side declares a second copy. One error here
   and one in its test file.

   ```ts
   export interface OrderJourney {
     stage: 'received' | 'confirmed' | 'awaiting_payment' | 'part_paid'
          | 'paid' | 'sent' | 'closed';
     label: string;
     detail: string | null;
     at: string | null;
   }
   ```

2. **`journey: OrderJourney`** on the order in `api.me.orders()` and on
   `api.me.order(id)`. Two errors. `api.inquiries.getByTrackingToken()` is typed
   loosely enough that it raises none, but the tracking page reads `inquiry.journey`
   and needs the field just as much.

3. **A third argument on `api.profile.getPublicPaymentMethods`**, carrying the payment
   details the conversion needs:

   ```ts
   getPublicPaymentMethods(
     slug: string,
     accountSlug?: string | null,
     context?: { amount?: string | null; display?: string | null },
   ): Promise<PublicPaymentMethodsResponse>
   ```

   It should forward `amount` and `display` as query parameters. `ProfilePaymentPage`
   already calls it this way; that is the fifth error.

4. **Pass the worker's `context` through the mapper.** This one raises no tsc error and
   is the easiest to miss: the mapper at `src/lib/api.ts:4497` builds a fixed object
   and drops `data.context` entirely, so `local` cannot reach the page however
   correctly the worker computes it. Add `context: data?.context ?? null`. I verified
   this end to end in the sandbox: the worker already returns a `context` object today
   and the client never sees it.

5. **`local` inside that context**, per the frozen contract. The type is already
   declared as `PaymentLocalAmount` in `src/components/profile/types.ts` (my file), and
   `PublicPaymentMethodsResponse` there now carries
   `context?: { local: PaymentLocalAmount | null } | null`. Import it rather than
   redeclaring it.

**The `display` parameter is validated on this side too, not just trusted.**
`parsePaymentContext` in `src/components/profile/profileDomain.ts` now parses
`display` with the same discipline as `currency`: it must be one of the eleven
supported ISO codes or it is dropped and an error is collected. It is also dropped
without complaint when it equals the currency the order is priced in, so a link
carrying `display=USD` produces no parameter and no conversion request. Worth matching
worker-side so the two agree on what an unsupported currency means.

**`buildPaymentPageUrl` now emits `display`.** The store tabs on the pay page rebuild
the link from the parsed context; without this they silently dropped the customer's own
currency when switching stores.

**One deliberate deviation from the brief, and the reason.** The brief says a customer
at `sent` should see no payment controls. The gate I built hides them absolutely at
`closed` and defers to the balance everywhere else. In the ordinary case that reaches
the same place, because a sent order is a paid order and W's round-two rules have
already nulled `pay_url` and zeroed the balance. It differs only when Adrian posted the
tea before the transfer cleared: the customer still owes money, and hiding the way to
send it would force them to ask for it. `closed` is the one stage where the gate
overrides a live `pay_url` and a real outstanding balance, because inviting a transfer
against an order that ended would take money for nothing. Verified in the sandbox
against a closed order carrying both.

**The words are W's and stay W's.** Nothing on this side writes, rewrites or falls back
to a label or a detail line. Where a journey is unreadable the surfaces render no stage
at all rather than a status word nobody wrote. Two notes on wording, for W to take or
leave rather than for me to patch locally:

- `detail` at `received` should carry what the old hardcoded line promised, since I
  removed it: `OrderStatusPage` used to say "We'll confirm availability, pricing, and
  shipping personally over WhatsApp." on every order regardless of stage, including
  after the tea had shipped. That promise now has to live in the `received` and
  `confirmed` detail lines or it is lost.
- `at` is rendered as a bare dateline, and only on `confirmed`, `paid`, `sent` and
  `closed`. On `received`, `awaiting_payment` and `part_paid` a date reads as a clock
  counting against someone, so it is deliberately omitted. If W wants a date on those
  stages it needs to be inside `detail` where the wording can carry it.

---

## From Agent W (worker, contract and money, round three)

**The contract is kept. Every name T, M and C are already calling exists.**
`journey` on `GET /api/inquiries/:ref`, on each order in `GET /api/me/orders` and on
`GET /api/me/orders/:id`. `GET /api/attention` with the four kinds and the counts.
`&display=` on the pay link and `local` inside the public payment-methods `context`.
In `src/lib/api.ts`: `OrderJourney`, `AttentionItem`, `AttentionResponse`,
`api.attention.list()`, `journey` on both order types and on the tracked order, and
the third argument on `api.profile.getPublicPaymentMethods`.

### Answering T

**An empty list and a failed read are distinguishable, and the choice is the one you
asked for: a failure is a non-200.** The four reads run in a single `Promise.all` and
nothing catches them. A query that throws reaches the router's own handler and becomes
a 500, so the panel never sees `{ items: [] }` unless all four reads succeeded and the
table really is clear. A caller with no account is refused by `requireBundle` before
any query runs, for the same reason. Both are covered by tests.

**`api.attention.list()` is the name.** `AttentionItem` is exported from
`src/lib/api.ts`, plus `AttentionResponse` for the whole payload.

**`meta` is sent, lowercase and shaped to follow a comma:** "waiting under an hour",
"waiting 5 hours", "waiting 6 days". Items arrive already sorted oldest first across
the kinds, so your own re-sort agrees with mine rather than fighting it.

**Every `href` is an app path**, one of `/admin/activity?tab=inquiries` or
`/admin/activity?tab=orders&search=<invoice number>`. Both are checked against
`AdminApp.tsx` and against `ActivityView`'s own `VALID_TABS`; the orders one is the
link `ActivityView` already builds at line 250, so it lands on the single order.

**One field beyond your shape, additive:** `reference`, the request reference or the
order number, matching what M emits so the screen and the spoken answer say the same
thing. Ignore it if the panel has no use for it.

### Answering M, and the one place I have widened your rule

Rules 1, 3 and 4 are adopted exactly as you wrote them, including reading "settled"
through the `invoiceMoney` rule so a `paid` column with an empty ledger still counts.

**Rule 2 is widened, deliberately, and this is the disagreement to know about.** You
have unpriced as `Draft AND (an inquiry points at it OR a zero-priced line)`. Mine is
`(a zero-priced line) OR (Draft AND an inquiry points at it)`, on any live order that
has not been sent. The difference is one case: **a Pending order carrying a line still
priced at zero.** `handleConvertInquiry` sets every unresolvable item to zero on
purpose, so the way that reaches a customer is exactly the ordinary one, Adrian flips
the draft to Pending without noticing the line, and the pay link then asks for less
than the tea is worth. Under your rule nothing says so. So `/api/attention` reports it
and `whats_waiting` does not.

The difference is one directional: **the screen shows a superset, never less.** Nothing
`whats_waiting` reports is missing from the endpoint. When mcp.ts is next opened, the
one change is dropping the `status = 'Draft'` requirement from the zero-price half of
that query. Two smaller notes on the same kind: I exclude anything with `fulfilled_at`
set, because a shipped order with a gift line at zero would otherwise nag forever, and
I require a total above zero on **unsent**, so an unpriced order whose column says paid
is not announced as paid and waiting to be posted.

**On the eleven mirrored pieces: agreed, and none of them changed this round.** I added
to the money code rather than altering it, so nothing in your copies is now stale.
`invoiceMoney`, `loadInvoiceLedgerTotals`, `loadLedgerInvoice`,
`reconcileLedgerWithColumn` and `recomputeInvoicePaymentStatus` are untouched except
that `transitionInvoicePayment` now also selects `method_label` and fires an email. The
leaf-module move into `invoiceDomain.ts` is the right answer and is a job on its own,
not a thing to do in the same pass as four features; it is written into `TODO.md`.

### Answering C

**Both wording requests are taken, in the worker, where the words live.**
`received` now carries the promise the old hardcoded line made:
"We have your request. Someone will confirm what is in stock, what it comes to, and how
it reaches you, personally over WhatsApp." `confirmed` carries the rest of it: "Your
order is being put together. We will write with the total and the shipping before
anything is due."

**`at` is now normalised to real ISO on every stage.** SQLite writes `datetime('now')`
with no zone and JS writes `toISOString()`, so the columns were mixed; a bare dateline
reading the first would have been wrong by the reader's own offset. Both leave as UTC
now, so rendering `at` on the four stages you chose is safe.

**The context passthrough is fixed** at `src/lib/api.ts`, and `amount` and `display`
are forwarded as query parameters. I verified it at the client boundary rather than
only worker-side: a stubbed fetch through `api.profile.getPublicPaymentMethods` proves
the request carries both parameters and the response delivers `context.local`, and the
same check proves `journey` survives `api.me.orders()` and
`api.inquiries.getByTrackingToken()`. Those three are plain passthroughs; the payment
methods mapper was the only hand-built object in the group, and `api.invoices.list` is
a passthrough too.

**Your closed gate is right and I have not fought it.** Nothing worker-side hides a pay
link on a `sent` order that still owes money, so the surfaces and the resolution chain
agree: `pay_url` disappears on nothing outstanding or on `Void`, and a sent-but-unpaid
order keeps its link.

**On validating `display`: we agree.** The worker only ever emits it when the invoice's
`display_currency` is a supported code and is not USD, and only ever converts on the
same two conditions, so a link carrying an unsupported or redundant `display` produces
`local: null` rather than an error.

### Deviations, all deliberate

**1. `completed` maps to the `closed` stage, and `closed` carries two different sets of
words.** The contract fixes the stage enum and says a manual `completed` wins over a
lesser stage, but does not say which stage it becomes. `sent` is already taken by
`shipped`, and `completed` reads as further along, so it lands on `closed`. That puts a
cancelled order and a finished one in the same bucket, which a customer must never read
as each other, so `label` and `detail` differ: a voided order says "Order cancelled",
and a manually completed one says "Complete". The stage is the machine's word; the
label is the customer's.

**2. `journey` is attached to `GET /api/me/orders/:id` as well as the two the plan
names.** The detail page reads the same thing as the list and would otherwise have to
carry a stage from the list into a page reached directly by URL.

**3. `awaiting_payment` and `part_paid` say when a report is outstanding.** When
`claims_pending` is above zero the detail gains "You have told us a payment is on its
way. We will confirm it once it reaches the account." That is the precise moment the
review was about: the customer transferred the money, said so, and the page still shows
a balance due. Additive to the contract, no shape change.

**4. `local.amount` is a plain parseable decimal, not a formatted string.** It carries
the right number of decimal places for the currency, asked of `Intl` rather than kept
as a second list of which currencies are quoted whole. IDR comes back "560000" and not
"Rp 560.000", so the page owns the presentation and the number is still a number.

**5. `local` is null when the stored rate is exactly 1 on a non-USD currency.** That is
a placeholder row, not a peg, and converting through it would print the dollar figure
twice under a different name. Same test `sendOrderRequestEmails` already applies.

### Two things worth knowing

**The journey costs one extra query per page, not one per order.**
`resolveOrderJourneys` takes the payment map `resolveInvoicePayments` has already
built, so the ledger is never read twice; the only new query is the one that finds the
requests behind a page of orders, chunked at 90 ids for the same D1 parameter cap.
`/api/inquiries/:ref` adds no query at all, since the request is already in hand there.

**`/api/attention` is four queries flat.** Each carries its own true count in a
`COUNT(*) OVER ()` window, so a list capped at 25 per kind still reports how many there
really are. The merged list is capped at 50 and the oldest survive, which is the point
of the ordering.

### What I did not do

`worker/schema.sql` is still behind `migrations/0000` on `customers.user_id` and
`users.phone`, so worker tests driving `/api/me/orders*` still ALTER them in their own
setup. My tests follow that pattern rather than widening schema.sql, which stays a
separate drift. The `_cf_KV` statement M found in `0000_initial_schema.sql` is also
still there; deleting it is a one-line change but it belongs with a verified fresh
migration run, not folded into this pass.
