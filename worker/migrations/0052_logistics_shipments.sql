-- Supplier delivery to a forwarder never changes stock. Only studio receipts do.
CREATE TABLE purchase_logistics (
  purchase_id TEXT PRIMARY KEY REFERENCES purchase_orders(id),
  account_id TEXT NOT NULL,
  logistics_company_id TEXT,
  logistics_company_name TEXT NOT NULL,
  inbound_courier TEXT,
  inbound_tracking_number TEXT,
  logistics_arrived_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX purchase_logistics_account ON purchase_logistics(account_id);
CREATE TABLE logistics_services (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  logistics_company_id TEXT NOT NULL REFERENCES customers(id),
  logistics_company_name TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('air','sea')),
  basis TEXT NOT NULL CHECK(basis IN ('kg','m3','fixed')),
  rate REAL NOT NULL CHECK(rate>=0),
  currency TEXT NOT NULL,
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id,logistics_company_id,name)
);
CREATE INDEX logistics_services_account ON logistics_services(account_id);
CREATE TABLE logistics_shipments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  logistics_company_id TEXT,
  logistics_company_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('air','sea')),
  state TEXT NOT NULL CHECK(state IN ('draft','in_transit','partially_received','received','cancelled')),
  outbound_courier TEXT,
  tracking_number TEXT,
  eta TEXT,
  freight_json TEXT,
  service_id TEXT REFERENCES logistics_services(id),
  service_quote_json TEXT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  dispatched_at TEXT,
  UNIQUE(account_id,idempotency_key)
);
CREATE TABLE logistics_shipment_lines (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL REFERENCES logistics_shipments(id),
  purchase_id TEXT NOT NULL REFERENCES purchase_orders(id),
  receipt_line_id TEXT NOT NULL REFERENCES inventory_receipt_lines(id),
  quantity REAL NOT NULL CHECK(quantity>0),
  received_quantity REAL NOT NULL CHECK(received_quantity>=0 AND received_quantity<=quantity),
  weight_kg REAL CHECK(weight_kg IS NULL OR weight_kg>=0),
  weight_estimated INTEGER NOT NULL CHECK(weight_estimated IN (0,1)),
  volume_m3 REAL CHECK(volume_m3 IS NULL OR volume_m3>=0),
  volume_estimated INTEGER NOT NULL CHECK(volume_estimated IN (0,1)),
  image_url TEXT,
  source_url TEXT,
  UNIQUE(shipment_id,receipt_line_id)
);
CREATE INDEX logistics_lines_account_receipt ON logistics_shipment_lines(account_id,receipt_line_id);
CREATE TABLE logistics_studio_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  shipment_line_id TEXT NOT NULL REFERENCES logistics_shipment_lines(id),
  ledger_id TEXT NOT NULL REFERENCES stock_ledger(id),
  quantity REAL NOT NULL CHECK(quantity>0),
  idempotency_key TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(account_id,idempotency_key),
  UNIQUE(ledger_id)
);
-- These guards are evaluated inside D1's write transaction, not just in a
-- potentially stale API preflight. Failed batches roll back every reservation.
CREATE TRIGGER logistics_reserve_line BEFORE INSERT ON logistics_shipment_lines
 WHEN NOT EXISTS (
  SELECT 1 FROM inventory_receipt_lines r
  JOIN purchase_orders p ON p.receipt_id=r.receipt_id AND p.account_id=r.account_id
  JOIN purchase_logistics h ON h.purchase_id=p.id AND h.account_id=p.account_id
  JOIN logistics_shipments s ON s.id=NEW.shipment_id AND s.account_id=r.account_id
  WHERE r.id=NEW.receipt_line_id AND r.account_id=NEW.account_id AND p.id=NEW.purchase_id
  AND h.logistics_arrived_at IS NOT NULL AND s.state='draft'
  AND h.logistics_company_id IS s.logistics_company_id AND h.logistics_company_name=s.logistics_company_name
  AND (r.unit!='unit' OR NEW.quantity=CAST(NEW.quantity AS INTEGER))
  AND NEW.quantity <= r.expected_quantity-r.received_quantity-r.cancelled_quantity-
   COALESCE((SELECT SUM(l.quantity-l.received_quantity) FROM logistics_shipment_lines l JOIN logistics_shipments active ON active.id=l.shipment_id AND active.account_id=l.account_id WHERE l.receipt_line_id=r.id AND l.account_id=r.account_id AND active.state!='cancelled'),0)
 ) BEGIN SELECT RAISE(ABORT,'logistics reservation changed or goods not at logistics company'); END;
CREATE TRIGGER logistics_protect_receipt BEFORE UPDATE OF expected_quantity,received_quantity,cancelled_quantity ON inventory_receipt_lines
 WHEN NEW.expected_quantity-NEW.received_quantity-NEW.cancelled_quantity <
  COALESCE((SELECT SUM(l.quantity-l.received_quantity) FROM logistics_shipment_lines l JOIN logistics_shipments s ON s.id=l.shipment_id AND s.account_id=l.account_id WHERE l.receipt_line_id=NEW.id AND l.account_id=NEW.account_id AND s.state!='cancelled'),0)
 BEGIN SELECT RAISE(ABORT,'goods reserved in logistics shipment'); END;
CREATE TRIGGER logistics_receive_dispatched BEFORE UPDATE OF received_quantity ON logistics_shipment_lines
 WHEN NEW.received_quantity<>OLD.received_quantity AND NOT EXISTS(SELECT 1 FROM logistics_shipments WHERE id=NEW.shipment_id AND account_id=NEW.account_id AND state IN ('in_transit','partially_received'))
 BEGIN SELECT RAISE(ABORT,'shipment must be dispatched before studio receipt'); END;
CREATE TRIGGER logistics_protect_company BEFORE UPDATE OF logistics_company_id,logistics_company_name,logistics_arrived_at ON purchase_logistics
 WHEN (NEW.logistics_company_id IS NOT OLD.logistics_company_id OR NEW.logistics_company_name!=OLD.logistics_company_name OR NEW.logistics_arrived_at IS NULL)
 AND EXISTS(SELECT 1 FROM logistics_shipment_lines l JOIN logistics_shipments s ON s.id=l.shipment_id AND s.account_id=l.account_id WHERE l.purchase_id=OLD.purchase_id AND l.account_id=OLD.account_id AND s.state!='cancelled')
 BEGIN SELECT RAISE(ABORT,'company cannot change after shipment allocation'); END;
