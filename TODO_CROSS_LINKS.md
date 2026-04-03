# Cross-Link & Interconnection TODO

Remaining interconnection work that requires backend/API changes or deeper architectural work.

## Customer ↔ Events

- [ ] **Customer profile: show events attended**
  Requires joining `event_attendees` table with `customers` via `customer_id`. Add an API endpoint like `GET /api/customers/:id/events` and display in the CustomersView detail panel.

- [ ] **Customer list: "attended events" filter/segment**
  Add a filter option in CustomersView to show only customers who have attended at least one event. Needs backend query support.

## Product ↔ Events

- [ ] **Product detail: "Featured in X events" section**
  Query `tea_menu` items matching `product_id` to find events that served this tea. Display in AlcoveCard or the inventory side panel. Needs API: `GET /api/products/:id/events`.

## Event Tastings → Personal Journal

- [ ] **Flow event TastingNotes into customer tasting journal**
  Currently, event tastings (`TastingNote` in `types/events.ts`) and personal tastings (`CustomerTasting` in `types.ts`) are separate systems. To unify:
  - Add optional `eventId?: string` field to `CustomerTasting`
  - When a guest submits a tasting at an event, also write to their personal journal
  - Show event context badge in TastingJournal when `eventId` is present

## Product ↔ Tasting History

- [ ] **Product cards: "You tasted this X times" badge**
  Query the local `tastingJournal` from `useAppStore()` and show a leaf badge on product cards in Shop/AlcoveCard when the user has previously tasted that tea. Purely client-side — no backend needed.

## Sales Attribution

- [ ] **Invoices: add optional `source_event_id`**
  Allow attributing a sale to a specific event (e.g., customer bought tea after tasting it at an event). Add column to `invoices` table and a dropdown in InvoiceBuilder.

## Compass ↔ Inventory (Deeper)

- [x] **Product `source_compass_entry_id` field in database**
  Currently the link is client-side only (compass store `draftProductId` → product). To make it persistent and queryable from the server, add `source_compass_entry_id TEXT` to the `products` table in `worker/schema.sql`. Populate when draft is created via `compassEntryToProductDraft()`.
