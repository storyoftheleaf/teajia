-- How a delivery travels home: air, sea, land (carried, or a car), courier.
-- The same four words curate_freight_costs.mode and
-- tea_compass_entries.transport_mode already use (0032), so a receipt and the
-- freight leg it rides on describe the journey the same way.
--
-- Shown on the phone's Incoming screen beside each supplier's delivery
-- (todo/plans/stock-phone-by-supplier.md, stage 3). Set after the receipt
-- exists, through PUT /api/inventory/receipts/:id/transport, never on create:
-- the create request is idempotent on a fingerprint of its body, and a new
-- field there would turn an honest retry into a 409.
--
-- Schema only: no row is written, and there is no default. NULL means nobody
-- said how it is travelling.

ALTER TABLE inventory_receipts ADD COLUMN transport_mode TEXT CHECK (transport_mode IS NULL OR transport_mode IN ('air', 'sea', 'land', 'courier'));
