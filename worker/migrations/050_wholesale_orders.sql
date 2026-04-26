-- 050_wholesale_orders.sql
-- Step 4 of the Network Rollout — wholesale order workflow.
-- Per docs/NETWORK_ROLLOUT_PLAN.md Step 4 + docs/NETWORK_UI_BRIEF.md Surfaces 8 + 9.
--
-- The cross-account transactional layer. A buyer (e.g. Jesse on Teajia
-- Australia) places a wholesale order against a supplier (e.g. Adrian on
-- Teajia Bali). Stock moves from supplier to buyer. Invoices generate on
-- both sides. Per-line pricing is snapshotted at submit time so FX drift
-- doesn't change what either party owes after they shake hands.
--
-- Status lifecycle (per Surface 9):
--   draft     — buyer is still building. Editable. Only buyer sees it.
--   submitted — buyer sent it. Awaiting supplier confirm. Editable by neither.
--   replied   — supplier asked for adjustments. Buyer can edit and resubmit.
--   confirmed — supplier confirmed. Awaiting ship. Supplier adds tracking.
--   shipped   — supplier marked shipped with tracking. Awaiting buyer to receive.
--   received  — buyer marked received. Stock + invoice flows fired. Closed.
--   cancelled — either party cancelled before ship. Terminal state.
--
-- Migration is ADDITIVE ONLY. No changes to existing tables.

-- ── 1. wholesale_orders — the order envelope ────────────────────────────────
CREATE TABLE IF NOT EXISTS wholesale_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Parties
  supplier_account_id TEXT NOT NULL REFERENCES accounts(id),
  buyer_account_id    TEXT NOT NULL REFERENCES accounts(id),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | submitted | replied | confirmed | shipped | received | cancelled

  -- Currency: the buyer's display currency, locked at draft creation.
  -- Per-line snapshots in wholesale_order_items.unit_price_currency may differ
  -- (e.g. supplier prices in IDR but the buyer agreed in AUD); the order's
  -- summary currency is what totals roll up to and what invoices are issued in.
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Money. NULL until first item is added. shipping_amount NULL until
  -- supplier confirms (they set the freight quote then).
  subtotal_amount REAL,
  shipping_amount REAL,
  total_amount    REAL,

  -- Logistics
  shipping_address TEXT,         -- buyer's drop-off address (free-form)
  tracking_number  TEXT,         -- set by supplier on ship
  carrier          TEXT,         -- e.g. 'Pos Indonesia', 'DHL', 'Toll'

  -- Notes from each side. Buyer's note is set on submit; supplier's note on
  -- confirm or reply.
  buyer_notes      TEXT,
  supplier_notes   TEXT,

  -- Side-effect side: invoice ids generated on receive. Both sides get one.
  -- These are FK-style references but we don't enforce REFERENCES because
  -- invoices is in a different scoping context (account-scoped per row).
  invoice_id_supplier TEXT,
  invoice_id_buyer    TEXT,

  -- Audit timestamps for each transition. NULL until that transition fires.
  -- Used by the timeline (Surface 9) to render the diary-entry log.
  submitted_at TEXT,
  replied_at   TEXT,
  confirmed_at TEXT,
  shipped_at   TEXT,
  received_at  TEXT,
  cancelled_at TEXT,
  cancelled_by_account_id TEXT REFERENCES accounts(id),
  cancel_reason TEXT,

  -- Nudge tracking (per Surface 9 stuck-state handling).
  -- last_nudge_at + nudge_count let us throttle "send a nudge" actions so
  -- a buyer can't spam-nudge the supplier.
  last_nudge_at TEXT,
  nudge_count   INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_supplier ON wholesale_orders(supplier_account_id, status);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_buyer    ON wholesale_orders(buyer_account_id, status);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_status   ON wholesale_orders(status);

-- ── 2. wholesale_order_items — per-tea line items ───────────────────────────
CREATE TABLE IF NOT EXISTS wholesale_order_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id TEXT NOT NULL REFERENCES wholesale_orders(id) ON DELETE CASCADE,

  -- The supplier's listing being purchased. We carry profile_id as a
  -- denormalization so the buyer can see what tea this is even after the
  -- supplier archives their listing or changes its content.
  supplier_listing_id TEXT NOT NULL REFERENCES product_listings(id),
  profile_id          TEXT NOT NULL REFERENCES tea_profiles(id),

  -- The buyer's matching listing (optional). NULL when they don't yet carry
  -- this profile. Set on receive — that's when stock lands in their inventory,
  -- which means we either find an existing listing or create one.
  buyer_listing_id TEXT REFERENCES product_listings(id),

  -- Quantity and snapshotted pricing. unit_price_amount is per-gram in
  -- unit_price_currency at submit time; line_total = grams * unit_price_amount.
  grams              REAL NOT NULL,
  unit_price_amount  REAL NOT NULL,
  unit_price_currency TEXT NOT NULL,
  line_total         REAL NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wholesale_items_order    ON wholesale_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_listing_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_items_profile  ON wholesale_order_items(profile_id);
