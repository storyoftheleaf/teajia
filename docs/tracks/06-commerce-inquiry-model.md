# Track 6: Commerce in the Inquiry Model

> Not a checkout. A conversation with a paper trail — deepen the invoice lifecycle around the WhatsApp confirmation so the numbers are right, the status is visible, and the customer's side of the story is complete.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Blockers (do first)

- [ ] **Fix confirm-picks invoice inflation (K1).** Owned by Track 1 (Launch Integrity, item 1) — tracked here only because it is the commerce trust floor; do not duplicate the fix from this doc, coordinate with Track 1. `handleConfirmCollectionPicks` (`worker/src/index.ts:16204`) stores the already-quantity-scaled `lineTotal` into `price_at_sale`. Every reader treats `price_at_sale` as a per-unit rate and multiplies by `quantity` again: `worker/src/index.ts:2832` (admin invoice list `computed_total`), `worker/src/index.ts:4194` (customer `total_spent_usd`), `worker/src/index.ts:12997` (`/api/me/orders` `line_total`), `src/admin/components/OrdersView.tsx:847` and `:912` (invoice detail totals). Any invoice created via a collection confirm-picks link with quantity > 1 is inflated. Fix: store a per-unit rate at line 16204 (`quantity > 0 ? lineTotal / quantity : 0`), then repair existing corrupted `invoice_line_items` rows (identify via `invoices.source_publication_id IS NOT NULL`). Done when: a confirm-picks order with quantity 3 shows the correct total, not 3x, in admin Orders, `/api/me/orders`, and customer total spent. (hours, plus a one-off data-repair pass)

### Core build

- [ ] **Per-order detail page.** Also Track 1 item 5. `OrderHistoryPage.tsx` renders each order as a static, unlinked `<article>` (`src/pages/OrderHistoryPage.tsx:101-124`, TODO comment still in place); there is no `GET /api/me/orders/:id` and no `/account/orders/:id` route. This also resolves the ORDER_SYSTEM_PLAN salvage decision on "customer-visible status lifecycle": yes, this page is it — the existing `invoices.status` (Draft/Pending/Filled/Void) and `payment_status` (unpaid/partial/paid) fields are the lifecycle, no new state machine needed.
  - Worker: add `GET /api/me/orders/:id`, same ownership match as `handleGetMyOrders` (`worker/src/index.ts:12973-13020`), joined to `invoice_line_items` + `products` for item names, returning `status`, `payment_status`, `notes`, `shipping_cost_usd`, and the line items.
  - Frontend: new `OrderDetailPage.tsx`. Layout can reference `src/pages/OrderStatusPage.tsx` but this is a distinct, authenticated flow reading `/api/me/orders/:id` (the `invoices` table) — not the public no-auth `/order/:ref` lookup, which reads the separate, unlinked `inquiries` table (`api.inquiries.getByRef`) and stays as-is.
  - Route: register `/account/orders/:id` in `src/App.tsx` near the existing `/order/:ref` route (line 1032).
  - Wire `src/pages/OrderHistoryPage.tsx:106-124` to `<Link to={`/account/orders/${order.id}`}>`, drop the TODO comment.
  - Done when: tapping an order row in `/account/orders` opens a detail page showing line items, status, payment status, shipping, and notes; back returns to the list. (day)

## Already shipped

- Inquiry checkout (CART → INQUIRY → CONFIRM), `src/components/shared/PublicCart.tsx`, order reference shown prominently plus "we'll reply on WhatsApp" reassurance copy on the CONFIRM success state (`PublicCart.tsx:534-570`). Verified shipped in commit `e039d30d` — the consolidated doc's "copy pass, still thin" item is stale, no further work needed here.
- Invoice payment status (`worker/migrations/073_invoice_payment_status.sql`): unpaid/partial/paid + `payment_date` + `payment_method`.
- Order + sample history pages wired to the API: `src/pages/OrderHistoryPage.tsx` (`api.me.orders()`), `src/pages/SampleHistoryPage.tsx` (`api.me.samples()`).
- Confirm-picks price scaling by amount: `handleConfirmCollectionPicks` (`worker/src/index.ts:16145-16204`) derives a per-unit rate from the curator's recommended price/quantity and scales to the amount picked. The scaling math is correct; only the storage format is bugged (see K1 blocker above).
- MCP invoice read/write tools: `list_invoices`, `get_invoice`, `update_invoice`, `void_invoice`, `fulfill_invoice`, `mark_invoice_paid` (`worker/src/mcp.ts`).
- Stock ledger + fulfillment path shared with the admin UI: `fulfill_invoice`/`record_sale` fire stock_ledger writes, listing mirror, low-stock alerts, and sold-out auto-archive through the same path as the admin UI.
- Shipping-cost field on order confirmation: `src/admin/components/QuickInvoiceModal.tsx:659-667` already has an editable Shipping (USD) input wired to `shipping_cost_usd`, surfaced throughout `OrdersView.tsx`. Resolves the ORDER_SYSTEM_PLAN "maybe" salvage decision: yes, and it is already built. No task needed.
- Invoice download/share from the admin UI covers today's delivery need; full invoice PDF/email auto-delivery (MCP Phase 2) stays deferred by design, no build task queued.

## Not building (killed)

- Model B customer-initiated checkout with quantity re-confirmation flow — contradicts the vision's WhatsApp-conversation commerce model, superseded by the shipped inquiry system.
- Per-account payment-method configuration (cash/bank/PayNow/Stripe per store) — resolves the ORDER_SYSTEM_PLAN salvage decision: no, not at one store. Revisit only if multi-store ships (Track 2).
- Silent per-customer discount field (`customers.discount_percentage`) — same reasoning; confirmed unbuilt by grep, no partial implementation to clean up.

## Sources

- `docs/_archive/consolidated-2026-07/ORDER_SYSTEM_PLAN.md` (archived)
- `docs/_archive/consolidated-2026-07/FRICTION_REVIEW.md` (archived, C-P0 remainders)
- `docs/STRUCTURAL_AUDIT_2026-06-10.md` §5 item 2 (live)

## Cross-track dependencies

- K1 and the per-order detail page are both owned or shared with Track 1 (Launch Integrity), items 1 and 5 there. Track 1 gates this track: "nothing ships before this" on K1.
- Per-account payment-method config, killed here at one store, belongs to Track 2 (multi-store) if it is ever revisited — do not resurrect it in Track 6.
