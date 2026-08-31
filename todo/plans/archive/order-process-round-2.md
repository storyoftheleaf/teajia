# Order process, round two — close the loop at the payment end

Status: in build, started 2026-08-30. Round one (notification, convert, pay link)
is in `order-process.md` and is landing now. This round fixes what round one left open.

## The five things

1. Nobody tells Adrian when a customer pays. The pay page exists and orders now link
   to it, but the loop ends in his bank app.
2. Two customer buy buttons still open WhatsApp with no record saved.
3. An order can be marked partly paid but nothing stores how much.
4. Orders prepared through the public AI tool are never recorded.
5. A customer's page in the admin shows recent orders with no pay link.

## The design that solves 1 and 3 together

Do NOT add a "customer says they paid" flag AND a separate part-payment amount. Both are
the same missing thing: **the system has no record of payments, only a status word on the
invoice.** One table fixes both and gives a payment history for free.

```sql
CREATE TABLE invoice_payments (
  id                  TEXT PRIMARY KEY,
  invoice_id          TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  amount_usd          REAL NOT NULL CHECK (amount_usd > 0),
  amount_original     REAL,
  currency            TEXT,
  payment_method_id   TEXT REFERENCES payment_methods(id),
  method_label        TEXT,
  reference           TEXT,
  note                TEXT,
  status              TEXT NOT NULL DEFAULT 'claimed'
                        CHECK (status IN ('claimed','confirmed','rejected')),
  claimed_by          TEXT NOT NULL CHECK (claimed_by IN ('customer','operator')),
  claimed_at          TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_by_user_id TEXT REFERENCES users(id),
  confirmed_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`invoices.payment_status` stays, and stays authoritative for every existing reader, but is
now **derived and rewritten** whenever a payment is confirmed or rejected:

- `paid` when confirmed total >= invoice total minus 0.01
- `partial` when confirmed total > 0
- `unpaid` otherwise

An operator recording a payment writes a row with `claimed_by='operator'`,
`status='confirmed'` in one step. A customer reporting one writes `claimed_by='customer'`,
`status='claimed'`, which changes no money until Adrian confirms it. **A customer can never
move an invoice to paid.** That boundary is the whole point.

## Frozen contract

### The `payment` object grows

Every invoice-shaped response keeps its round-one fields and adds four:

```ts
payment: {
  recipient_slug: string | null;
  recipient_name: string | null;
  pay_url: string | null;
  has_methods: boolean;
  total_usd: number;         // invoice total, line items plus shipping
  paid_usd: number;          // sum of CONFIRMED payments only
  outstanding_usd: number;   // total minus paid, never below zero
  claims_pending: number;    // count of rows still status='claimed'
} | null
```

**`pay_url` now carries the OUTSTANDING amount, not the total.** After a confirmed part
payment the link asks for the balance. `pay_url` is null when `outstanding_usd` is zero or
less, when the invoice status is `Void`, or when `has_methods` is false. This replaces the
round-one rule about nulling on `payment_status = 'paid'`, and reaches the same place by a
better road.

### Endpoints

```
POST /api/orders/:ref/payment-claim          public, scoped by tracking token
POST /api/me/orders/:invoiceId/payment-claim signed in
  body { amount?, currency?, method?, reference?, note? }
  -> 201 { claim_id, claims_pending }
  Rate limited. Amount defaults to the full outstanding balance when omitted.
  Rejects an amount above outstanding plus a small tolerance.

GET  /api/invoices/:id/payments               admin, account scoped
POST /api/invoices/:id/payments               admin, records a confirmed payment directly
POST /api/invoice-payments/:id/confirm        admin, recomputes payment_status
POST /api/invoice-payments/:id/reject         admin, recomputes payment_status
```

Every write is audited the way neighbouring invoice mutations are, and recomputes
`payment_status`, `payment_date` and `payment_method` on the invoice so existing readers
stay correct.

### Email

A customer payment claim emails Adrian: which order, who, how much they say they sent, by
what method, the reference they quoted, and a link to confirm it. Same fire-and-forget
discipline as round one — a mail failure never fails the claim.

## Work split — strict file ownership

Round one's Agent 1 still holds `worker/**` and `src/lib/api.ts`. P1 and M2 below start
only once it lands. P2 and P3 start immediately and build against the contract above.

**P1 — worker, money and schema.** Owns `worker/src/index.ts`, `worker/migrations/**`,
`src/lib/api.ts`. The table, the derived status, the four admin endpoints, the two claim
endpoints, the widened `payment` object, outstanding-balance pay links, the claim email,
and `payment` on the customer-orders endpoint that feeds item 5.

**P2 — admin.** Owns `src/admin/**`. Reported payments surfaced on the orders list and in
the order detail, confirm and reject, record a payment with an amount by hand, the payment
history on an order, and pay links on the customer profile's recent orders.

**P3 — customer.** Owns `src/pages/**`, `src/components/**`, `src/lib/whatsapp.ts`.
The "I've sent payment" action and its small form, and routing the bypass buy buttons
through the recorded checkout.

**M2 — the public AI tool.** Owns `worker/src/mcp.ts` only. Persist a prepared order as an
inquiry so it stops being invisible.

## House rules

Round one's rules carry over unchanged: `npm run lint:colors` must pass, safe tokens only,
never white, gold only for focus/hover/active and brand, no borders on pills, typography
through `TYPOGRAPHY_CLASSES` and the `text-ui-N` scale, bottom-nav clearance utilities,
`tap-target` under 44x44, cancel left and commit right, no em dashes, no gateway, no
changes to nav links or routing. Verify against the local sandbox, never the live API.
