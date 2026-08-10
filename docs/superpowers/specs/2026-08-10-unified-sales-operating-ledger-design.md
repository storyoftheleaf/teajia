# Unified Sales Operating Ledger Design

**Date:** 2026-08-10

**Status:** Ready for user review

## Goal

Make Teajia's inquiry-led commerce operate as one trustworthy, multi-store sales ledger without replacing personal conversation with conventional automated checkout.

Every customer inquiry, accepted order, invoice, payment record, fulfillment, stock movement, store, seller, and Tea Master must be traceable through durable identifiers and explicit state transitions. One order always belongs to one merchant and fulfilling account.

## Scope and delivery boundaries

This program is divided into independently releasable sub-projects so it can coexist with other active Teajia work:

1. **Retail safety and store binding** — secure public order tracking, bind carts and inquiries to one store, repair inquiry authentication, validate invoice writes, and correct currency presentation.
2. **Retail sales spine** — convert inquiries into linked customers and orders, unify reservation behavior, add explicit order/invoice/payment/fulfillment commands, and repair notifications.
3. **Payment ledger and reconciliation** — record manual and provider-originated payment events, allocations, refunds, and balances without making Teajia merchant-of-record.
4. **Network reporting and customer continuity** — provide canonical store and movement metrics while preserving account-private CRM data.
5. **Wholesale rebuild** — replace the unsafe receive side effects with reserved, idempotent stock transfers, private receipts, cost basis, and proper supplier/buyer documents.
6. **Tea Master attribution integration** — consume the separately active Tea Master sales-grant and settlement work after it lands; do not duplicate or race its migration, domain module, or UI.

The first implementation plan covers sub-project 1 only. Later sub-projects receive their own plans and test gates. This prevents a large cross-cutting rewrite from colliding with current Tea Master work or leaving a half-migrated production system.

## Product principles

- WhatsApp and personal conversation remain the closing channel.
- Teajia records commercial truth; it does not claim that opening WhatsApp, copying instructions, or viewing a payment method means an order was placed or paid.
- A cart and order cannot mix merchants or fulfillment accounts.
- Payment and fulfillment are independent state machines.
- External bank transfer, cash, QR, and payment links are payment adapters. They all write the same internal payment records.
- Teajia does not custody or split funds in the initial program.
- Platform-wide views are read-only aggregations. Mutating work happens inside one active account.
- Public contributor association never grants operational or financial authority.
- New wholesale stock is private and unpublished until the receiving store curates it.
- Existing public navigation and the Read, Learn, Consult, and Shop sections remain unchanged.

## Canonical commercial model

### Identities and authority

| Concept | Meaning |
|---|---|
| Account | Merchant, inventory, customer-relationship, and fulfillment boundary |
| Contributor | Global public Tea Master identity |
| Membership | Authority to act inside an account |
| Association | Public relationship only; never authority to sell or collect money |
| Stock owner | Person or account whose inventory is consumed by a sale |
| Seller | Person who negotiated or recorded the sale |
| Payment recipient | Owner-approved account or hosted Tea Master destination for the invoice |

### Commercial records

| Record | Responsibility |
|---|---|
| Inquiry | Unconfirmed intent and contact-channel handoff |
| Order | Accepted commercial commitment owned by one account |
| Invoice | Amount issued or owed; not a fulfillment or payment status container |
| Payment transaction | Immutable evidence of money received, failed, reversed, or refunded |
| Payment allocation | Amount of a transaction applied to an invoice |
| Fulfillment | Reservation and physical stock departure |
| Stock movement | Canonical inventory mutation with idempotency and provenance |
| Settlement | Internal amount owed to a seller or stock owner |
| Wholesale transfer | Linked supplier order, shipment, buyer receipt, and paired stock movements |

The existing `invoices` table remains the compatibility anchor during migration. The UI may continue to call accepted retail records “Orders,” but domain code must stop using invoice `status` to imply payment or stock truth.

## State machines

### Inquiry

`new -> seen -> contacted -> accepted | closed`

- Opening an external channel may create a durable inquiry, but it records `channel_opened`, not `message_sent`.
- `accepted` requires an idempotent conversion to one customer relationship and one order.
- The accepted inquiry stores `order_id`; the order stores `source_inquiry_id`.

### Order

`draft -> confirmed -> cancelled`

- Confirmation snapshots store, customer, seller, line prices, currency, FX rate, stock owner, payment recipient, and source.
- Cancellation does not imply a refund. Any payment reversal is explicit.

### Invoice

`draft -> issued -> void`

- Issued documents are immutable except through corrective commands.
- Invoice balance is derived from allocations and refunds, not assigned as an arbitrary status string.

### Payment

Derived invoice state: `unpaid | partial | paid | overpaid | refunded | disputed`.

Transactions are append-only. Corrections use reversal or refund rows. Manual cash and bank-transfer entries require amount, currency, method, received time, reference or operator note, recorder identity, and idempotency key.

### Fulfillment

`unallocated -> reserved -> partially_fulfilled | fulfilled -> partially_returned | returned`

- Every stock-changing action uses the canonical idempotent stock-movement service.
- Reservation and fulfillment never infer payment.
- Voiding an invoice does not automatically restore stock; the explicit cancellation/return command determines the inventory effect.

## Retail customer flow

1. The active storefront resolves one `account_id` and `store_slug`.
2. Every cart line snapshots that identity. A store change either restores that store's separate cart or asks the customer to replace the current cart.
3. Checkout creates or refreshes one durable inquiry before opening the external channel. Persistence failure is visible and retryable.
4. Public status uses a human-readable reference for conversation plus a unique high-entropy capability token for lookup. The public response is redacted.
5. The sales inbox is authenticated, account-scoped, and fails visibly on errors.
6. “Accept and create order” links or creates the account-local customer, copies the quoted lines, and records the inquiry source without retyping.
7. Staff may request payment, record a payment, reserve stock, and fulfill in either operational order. The activity timeline shows each event separately.
8. Signed-in customers may see their own orders across stores, but each store sees only its local customer relationship, notes, and sales.

## Store and Tea Master payment policy

- A location sale uses an owner-approved account payment destination.
- A hosted Tea Master sale uses the Tea Master's `master` account and an approved destination bound to that account.
- A standalone personal-shelf sale remains direct-to-person and outside Teajia orders, payments, and settlements.
- A guest contributor association does not permit publishing a payment destination for that store.
- Invoice-generated payment links bind the merchant, recipient, amount, currency, and reference. The payer cannot switch the recipient context.
- Viewing a payment destination never records a payment.

The active Tea Master sales-spine work owns sales grants, line attribution, and manual seller settlement. This program will integrate with its public contracts once committed. It must not create a second grants or settlement model.

## Payment ledger

The payment sub-project introduces focused tables rather than adding more mutable invoice flags:

```text
payment_transactions
  id, account_id, provider, provider_event_id, type,
  amount_minor, currency, status, method, external_reference,
  received_at, recorded_by_user_id, idempotency_key, metadata_json

payment_allocations
  id, account_id, transaction_id, invoice_id, amount_minor, created_at

payment_refunds
  id, account_id, transaction_id, amount_minor, currency,
  external_reference, reason, status, recorded_by_user_id, created_at
```

Money uses integer minor units for newly introduced transaction records. Existing USD `REAL` fields remain compatibility projections until a separate migration proves parity.

Provider webhooks must enforce a unique `(provider, provider_event_id)` key. Manual entries use account-scoped idempotency keys. Derived invoice balances are computed through one payment-domain module used by the admin UI, REST, MCP, and reporting.

## Multi-store reporting

The reporting module defines these terms once:

- **Inquiry value** — nonbinding estimated value.
- **Booked sales** — confirmed order value.
- **Issued receivables** — active issued invoice value.
- **Fulfilled sales** — value physically fulfilled.
- **Cash collected** — successful allocated payments.
- **Outstanding receivables** — issued amount less successful allocations and refunds.
- **Net collected sales** — collected cash less refunds.
- **COGS and margin** — derived from snapshotted line cost, not current product cost.
- **Seller payable** — amount owed through the Tea Master settlement model.

Every metric is available in transaction currency and a declared reporting currency using the sale-time FX snapshot. Network owners receive an aggregate read model; selecting a store switches to its operational view.

## Wholesale rebuild

Wholesale is modeled as linked commercial and physical records:

1. Buyer purchase order.
2. Supplier sales order and receivable.
3. Supplier reservation.
4. Shipment with shipped quantities.
5. Buyer goods receipt with accepted quantities.
6. Paired canonical stock movements.
7. Buyer cost-basis snapshot and private holding.
8. Supplier invoice and buyer payable/bill.

Transitions use an atomic status predicate and an idempotency key. Confirmation reserves supplier stock. Shipment cannot exceed the reservation. Receipt cannot exceed shipped quantity and supports partial receipt, rejection, and backorder. Receiving never auto-publishes stock.

The current wholesale receive side effects must be disabled or feature-gated before a real second-store rehearsal. No production readiness claim is allowed until concurrency, insufficient-stock, partial-receipt, FX, cost-basis, and bilateral-document tests pass.

## Authorization

The existing bundles remain the initial public permission vocabulary, but financial commands receive explicit server-side capability checks:

- create or edit quote/order;
- confirm and issue;
- reserve and fulfill;
- record payment;
- void or refund;
- confirm, ship, or receive wholesale;
- view financial reporting;
- mark a seller settlement paid.

Owner-tier access may perform all account operations, subject to platform policy for hosted master accounts. Staff access is narrowed by their effective capability. Public association is never consulted for authorization.

## Error handling and integrity

- All command payloads reject non-finite or negative quantity and money values.
- Product, listing, customer, payment destination, and line attribution must belong to the active account or an explicitly authorized network relationship.
- Commands use compare-and-swap state predicates and idempotency keys.
- Multi-write operations either commit atomically or leave a durable compensating event; stock is never silently clamped.
- Unknown lifecycle values fail closed at the domain and database layers.
- Public persistence and protected API failures are shown to the user, not mapped to empty success states.
- External notification delivery has `pending | sent | failed` truth; “nudge” cannot claim delivery without a delivery adapter.
- Sensitive payment identifiers are redacted in logs and public responses.

## Compatibility and rollout

1. Add security and validation fixes without changing public navigation.
2. Deploy additive schema and dual-read compatibility where necessary.
3. Backfill store identity, currency, and source data only where provenance is known; ambiguous historical rows remain explicitly unknown.
4. Move admin and MCP commands to the canonical modules.
5. Compare old and new reporting projections before switching dashboards.
6. Rehearse Bali retail, Australia retail, hosted Tea Master sale, manual payment, refund, and two-account wholesale with synthetic value.
7. Enable real-value use only after those rehearsals and rollback checks pass.

## Test strategy

Each behavior follows red-green-refactor and receives focused domain or route coverage before implementation.

Required release gates include:

- store-selected checkout and cart isolation;
- opaque public tracking and redacted lookup;
- inquiry authentication, visible errors, and idempotent conversion;
- currency amount correctness;
- invoice validation and explicit transitions;
- reservation parity across every order-creation path;
- payment allocation, partial payment, refund, duplicate webhook, and reconciliation;
- concurrent fulfillment, void, and wholesale transition safety;
- seller and stock-owner attribution integration;
- account-switch refresh for dashboards and wholesale views;
- customer cross-store self-history with account-private CRM isolation;
- invoice/PDF merchant and payment details;
- mobile clearance, accessibility, no horizontal overflow, color lint, typecheck, build, and Worker suite.

## Explicit non-goals

- Automated checkout replacing WhatsApp.
- Teajia custodying funds or becoming merchant-of-record.
- Automated split payouts in the first release.
- Mixed-store carts or cross-location fulfillment.
- A social marketplace, ratings, feeds, or algorithmic recommendations.
- Replacing the active Tea Master grants and settlement implementation.
- Rewriting all historical invoice money fields before the additive ledger is proven.

## Success criteria

- A customer cannot accidentally contact or create an inquiry in the wrong store.
- Public order tracking cannot be enumerated to expose personal data.
- One operator action converts an inquiry into a traceable order without re-entry.
- Every displayed amount is numerically correct for its labeled currency.
- Invalid or repeated commands cannot manufacture stock, double-restore stock, or create payment truth.
- Store operators can record and reconcile real manual payments from the ordinary admin interface.
- Every sale identifies merchant, fulfiller, seller, stock owner, payment recipient, and source where applicable.
- Network reporting distinguishes booked, fulfilled, collected, outstanding, refunded, and payable amounts.
- Wholesale conserves stock and money under retries, concurrency, partial receipt, and insufficient inventory.
- Concurrent Teajia feature work can integrate through documented contracts without overlapping migrations or duplicate domain models.
