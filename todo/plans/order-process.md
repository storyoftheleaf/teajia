# Order process — close the loop from cart to payment

Status: in build (3 parallel agents), started 2026-08-30.

## The problem, in one line

A customer's order is saved but nobody is told, the order must be retyped by hand
to become an invoice, and the payment page that already exists is linked from
nowhere.

## What already exists (verified, do not rebuild)

- `inquiries` table + `POST /api/inquiries`. Checkout **does** persist server-side
  before opening WhatsApp/email. Customer can track at `/order/:ref`.
- `invoices` with `payment_recipient_user_id` and `sold_by_user_id` columns —
  both present, **both unused**.
- `payment_methods` table hanging off `contributor_id`, with an optional
  `account_id` for per-store variants and an `is_published` flag.
- `GET /api/public/people/:slug/payment-methods` and the public page at
  `/people/:slug/pay`, which already accepts `?amount=&currency=&reference=`
  and `?account=` and validates all four.
- `buildPaymentPageUrl(slug, accountSlug, origin, context)` in
  `src/components/profile/profileDomain.ts` — the canonical URL builder. Use it.
- `sendEmail()` (Resend) in `worker/src/index.ts` — used for fulfilment,
  password reset, invites, verification codes.

## The attachment: how a payment page hangs off each tea master

A tea master is a `contributors` row (its `id` IS the slug) with an optional
`user_id` pointing at a `users` row, and an optional `face_of_account_id` /
`contributor_accounts` link to the stores they belong to. Their transfer details
are `payment_methods` rows keyed by `contributor_id`.

**Resolution chain — "who gets paid for this invoice":**

1. `invoices.payment_recipient_user_id`, if set.
2. else `invoices.sold_by_user_id`, if set.
3. else `accounts.owner_user_id` for the invoice's account.

Then `users.id -> contributors.user_id` gives the contributor slug. If no
contributor row matches, or that contributor has no published payment method,
the invoice carries **no** pay link and no button is rendered. Never render a
dead link.

**The link that gets built:**

```
/people/<contributor-slug>/pay
  ?account=<invoice account slug>
  &amount=<invoice total, 2dp>
  &currency=<invoices.display_currency>
  &reference=<invoices.invoice_number>
```

`account=` is what makes a tea master with several stores show the right transfer
details for the store the order came from — the public handler already picks the
account-specific method when one exists and falls back to their personal default.
`reference=` is what lets Adrian match an incoming bank transfer to an order.

Invoice total is `SUM(quantity * price_at_sale)` plus `shipping_cost_usd` — there
is no total column on `invoices`.

**Payment attaches to invoices, not inquiries.** An inquiry is a request; there is
nothing to pay until it has been priced into an invoice. The customer's order page
shows a pay button only once the inquiry has been converted.

## Frozen contract — all three agents build to this

### Worker API (owned by Agent 1)

Every invoice-shaped response (`GET /api/invoices/:id`, the invoices list,
`GET /api/me/orders`, `GET /api/inquiries/:ref`) gains:

```ts
payment: {
  recipient_slug: string | null;   // contributor slug
  recipient_name: string | null;   // display name, for "Pay Adrian"
  pay_url: string | null;          // fully built absolute URL, or null
  has_methods: boolean;
} | null
```

`pay_url` is null whenever `has_methods` is false. Build it worker-side so every
surface renders the same link.

New endpoint:

```
POST /api/inquiries/:id/convert   (admin, account-scoped)
  -> 200 { invoice_id, invoice_number }
  -> 409 { error, invoice_id } if already converted
```

Creates a Draft invoice + line items from the inquiry, allocates an invoice number
from `accounts.invoice_seq` (same path as collection picks), sets
`inquiries.converted_invoice_id` and moves the inquiry status to `replied`.
Items whose product no longer resolves become custom line items, never silent drops.

Migration `worker/migrations/0001_order_process.sql`:
`ALTER TABLE inquiries ADD COLUMN converted_invoice_id TEXT;`

### Client (owned by Agent 1)

`src/lib/api.ts`: `api.inquiries.convert(id)`, and the `payment` field added to
every invoice/order type.

### Message builder (owned by Agent 3)

`buildOrderMessage()` in `src/lib/whatsapp.ts` gains an optional `payUrl?: string`.
When present it appends a final line: `Pay here: <url>`. Agent 2 passes it from the
admin side; Agent 3 threads it through the customer side.

## Work split — strict file ownership, no agent touches another's files

**Agent 1 — backend and contract.** Owns `worker/**` and `src/lib/api.ts`.
1. Email Adrian on every new inquiry (name, contact, items, total, link to admin).
2. Acknowledgement email to the customer at order time, with their reference and
   tracking link. Only when they gave an email.
3. Payment resolution chain + `payment` object on every invoice-shaped response.
4. `POST /api/inquiries/:id/convert` + the migration.
5. Fix the fulfilment email: it points at `teajia.app/order/<invoice_id>`, which is
   both the wrong domain and the wrong identifier. Should be the live site and the
   inquiry ref where one exists. Add the pay link to that email.

**Agent 2 — admin surfaces.** Owns `src/admin/**`.
1. "Turn into order" on each inquiry in ActivityView, calling the convert endpoint,
   showing the resulting invoice number, and reflecting the already-converted state.
2. Pay link on OrdersView: copy button, and the link appended to the WhatsApp
   message the admin sends the customer.
3. Show who the payment recipient is on an order, and say plainly when an order has
   no payment link because that tea master has not added transfer details.

**Agent 3 — customer surfaces.** Owns `src/pages/**`, `src/components/**`,
`src/lib/whatsapp.ts`, `src/lib/contact.ts`.
1. Pay button on `/order/:ref` (OrderStatusPage) and on the account order history,
   rendered only when `payment.pay_url` is present.
2. Clear the cart after a successful checkout — today it survives, so a customer can
   send the same order twice.
3. `payUrl` param on `buildOrderMessage`.

## House rules every agent follows

- `npm run lint:colors` must pass. Safe tokens only; never white, never raw gold
  outside focus/hover/active, no borders on pills or badges.
- Use `TYPOGRAPHY_CLASSES` and the `text-ui-N` scale, never raw pixel text sizes.
- Mobile bottom-nav clearance utilities on any scrollable or fixed element.
- Cancel/back left, commit right. No opacity on cancel/back/close colours.
- No em dashes anywhere, including UI copy.
- Do not change nav links, tab labels, or routing.
- No payment gateway. Inquiry-led commerce is a locked decision.

## Verify

`npm run lint`, `npm run lint:colors`, and `npm run test:mobile` against the local
sandbox (`npm run sandbox`, sign in sandbox/sandbox). Never verify admin changes
against the live API.
