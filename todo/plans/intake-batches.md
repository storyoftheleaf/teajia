# Intake Batches — group stock by shipment / intake session

Lets Adrian answer two distinct questions that a single timestamp flattens:
- **"What came in my latest shipment?"** → filter the inventory grid by batch (intake events).
- **"How long have I had this tea?"** → its origin, derived from its earliest receipt.

The trigger: about to import a whole new set of orders, mixed with teas held for years. A raw `created_at` would make every old tea look new. A named batch with a date *Adrian asserts* tells the truth.

## Model (two layers)

1. **`batches` table** — the shipment/session itself. The same tea can appear in many batches (first acquisition + each restock).
2. **`batch_id` on `stock_ledger` PURCHASE_RECEIPT rows** — the intake *events*. Already one ledger row per arrival; we just label it with its shipment.
3. **Origin is derived, never stored** — a tea's origin = its earliest PURCHASE_RECEIPT. Cannot drift.
4. **Skip default = "Unsorted"** — one seeded batch per account; undated `intake_date` is allowed (for old stock you can't date).

## Pre-existing gap this fixes

`handleIncrementStock` (worker/src/index.ts:2882) and `handleBulkCreateProducts` (:2025) currently write **no** stock_ledger row. Admin stock additions and bulk imports leave no audit trace. Batches attach to ledger rows, so both must start writing `PURCHASE_RECEIPT` rows. This is a correctness fix regardless of batches.

## Build

### Migration `078_intake_batches.sql`
- `batches`: id, account_id, label, intake_date (nullable), vendor (nullable), note, created_at.
- `ALTER TABLE stock_ledger ADD COLUMN batch_id TEXT` (nullable — all existing history stays valid as "no batch").
- Indexes: `batches(account_id)`, `stock_ledger(batch_id)`.
- Seed one `Unsorted` batch per existing account.

### Worker (worker/src/index.ts)
- `handleIncrementStock` (2882): read current balance, write PURCHASE_RECEIPT ledger row, accept optional `batch_id`.
- `handleBulkCreateProducts` (2025): after inserts, write a PURCHASE_RECEIPT row per product with stock>0, stamped with the import's `batch_id`.
- New routes: `GET /api/batches`, `POST /api/batches` (account-scoped, `requireBundle('stock')`).
- `handleGetStockLedger` (3207): join batches, return `batch_id` + batch `label` per row.

### Frontend
- `api.ts`: `incrementStock(productId, amount, batchId?)`; `batches.list()` / `batches.create()`; ledger rows carry batch label.
- Add-stock UI (PurchaseOrdersPage, InventoryView inline): batch picker, defaults to most-recent batch, skip → Unsorted.
- Bulk import: one batch field at top; whole import attaches.
- Inventory grid: client-side "Batch" filter beside vendor/type.
- StockLedgerPanel: show batch label per row → per-tea "first got it / restocked" view.

## Status
Built 2026-06-01. Typecheck + color lint + production build all pass. End-to-end
query path verified against the real schema on local D1 (add-stock ledger write,
ledger join with batch label, batch-products filter, batch list ordering).

### Remaining to go live
- **Apply migration 078 to production D1** (does NOT auto-apply — see
  [deploy-db-migrations.md](deploy-db-migrations.md)):
  `cd worker && npx wrangler d1 execute teajia-db --remote --file=migrations/078_intake_batches.sql`
- Note: the local dev D1 was missing migration 017's `stock_ledger.account_id`
  column (it had been seeded from base schema.sql only). Production has it. Harmless
  to dev, but if a fresh local D1 is ever rebuilt, run the migration chain in order.

### Surfaces
- BatchPicker (`src/admin/components/BatchPicker.tsx`) — reusable pick-or-create.
- CSV import: batch field in the staging footer → whole import attaches.
- PO "Receive Stock" prompt: batch picker → received stock attaches.
- Inventory grid: "Filter by batch" in the options menu + a clearable banner.
- StockLedgerPanel: batch label per row → per-tea origin/restock view.
