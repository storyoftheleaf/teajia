# Order process, round three — the five from the review

Status: in build, started 2026-08-31. Rounds one and two are landed and verified
(`order-process.md`, `order-process-round-2.md`). This round builds the five findings
from the review at `The Order Loop`.

## Adrian's steer

He has an account. He is a tea master. **The "what needs you" surface belongs inside
Your Table**, which is `src/components/AccountPanel/` — the role-adaptive portal he
opens from the sidebar account row on desktop and the person icon on mobile. It is NOT
a new admin screen. Your Table already has a `NeedsAttention` primitive
(`AccountPanel/primitives.tsx:99`) taking `AttentionItem[]`; this extends it rather
than inventing a surface.

Read `~/.claude/projects/.../memory/project_launchpad.md` conventions before touching
that folder: five-zone IA, no Row-and-chevron grammar, no pulse dots, identity in the
corner, a portal SHOWS content rather than linking to it.

## The five

1. The customer's tracking page ignores the actual order.
2. Confirming a payment tells the customer nothing.
3. Nothing gathers what needs Adrian.
4. Voice and AI control cannot reach any of the new work.
5. A customer paying in their own currency sends a number that will never match.

## Frozen contract

### The order journey, derived (item 1)

Stop maintaining a customer-visible status by hand. `inquiries.status` stays for the
operator's own filing (new / seen / replied / closed), but what the customer SEES is
derived. Add to `GET /api/inquiries/:ref` and to each order in `GET /api/me/orders`:

```ts
journey: {
  stage: 'received' | 'confirmed' | 'awaiting_payment' | 'part_paid'
       | 'paid' | 'sent' | 'closed';
  label: string;          // what the customer reads
  detail: string | null;  // one supporting line, or null
  at: string | null;      // when this stage began, ISO
}
```

Derivation, in order: not converted yet gives `received`. Converted and Draft gives
`confirmed`. Pending with something outstanding gives `awaiting_payment`, or
`part_paid` when some is confirmed. Outstanding zero gives `paid`. `fulfilled_at` set
gives `sent`. `Void` gives `closed`. A manual inquiry status of `shipped` or
`completed` still wins over a lesser derived stage, so nothing Adrian set by hand is
lost.

### Payment confirmed email (item 2)

Fires on `POST /api/invoice-payments/:id/confirm`, only when the customer has an email.
Says what was received, what is left owing if anything, and what happens next. Same
fire-and-forget discipline and visual style as the existing templates. A mail failure
never fails the confirmation.

### What needs Adrian (item 3)

```
GET /api/attention        admin, account-scoped
-> { items: AttentionItem[], counts: { requests, unpriced, claims, unsent } }

AttentionItem = {
  kind: 'request' | 'unpriced' | 'claim' | 'unsent';
  id: string;
  label: string;         // plain, human, names the person or the order
  meta: string | null;   // how long it has waited
  waiting_since: string; // ISO, the sort key
  href: string;          // where it opens
}
```

Four kinds, oldest first across all of them:
- **request** — an order request nobody has answered.
- **unpriced** — a converted order still Draft, or carrying a zero-priced line.
- **claim** — a customer has reported a payment nobody has checked.
- **unsent** — fully paid and not yet fulfilled.

One query per kind, capped, never an N+1 across orders.

### Local currency on the pay page (item 5)

The pay link gains `&display=<CUR>` when the invoice's `display_currency` is not USD.
`GET /api/public/people/:slug/payment-methods` returns, inside its existing `context`:

```ts
local: { currency: string; amount: string; rate: number; as_of: string } | null
```

Converted from the live `exchange_rates` table (`rate_to_usd`, refreshed hourly by the
existing cron). Null when the currency is unknown, unsupported, or already USD. The
dollar figure stays primary and authoritative; the local figure is an approximation and
must be labelled as one.

### Voice and agent tools (item 4)

New tools on the authenticated `/mcp` server, scoped like their neighbours and using the
existing two-step preview/confirm pattern for every mutation:

- `whats_waiting` (read) — the attention list in words. The headline tool.
- `list_order_requests` (read), `convert_order_request` (write)
- `list_payment_claims` (read), `confirm_payment` (write), `record_payment` (write)

## Work split — strict file ownership

- **W** owns `worker/src/index.ts`, `worker/migrations/**`, `worker/schema.sql`,
  `worker/sandbox/**`, `src/lib/api.ts`. Items 1, 2, 3 and 5, server side.
- **M** owns `worker/src/mcp.ts`. Item 4.
- **T** owns `src/components/AccountPanel/**`. Item 3, inside Your Table.
- **C** owns `src/pages/**`, `src/components/profile/**`, `src/components/shared/**`.
  Items 1 and 5, customer side.

## House rules

Unchanged from rounds one and two. `npm run lint:colors` must pass, safe tokens only,
never white, gold only for focus/hover/active and brand, no borders on pills,
`TYPOGRAPHY_CLASSES` and the `text-ui-N` scale, bottom-nav clearance utilities,
`tap-target` under 44x44, cancel left and commit right, no em dashes, no payment
gateway, no changes to nav links or routing. Sandbox only, never the live API.
