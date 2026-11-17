-- A referral holds only the affected shipment line. Closing it leaves the
-- outstanding quantity in place until a separate stock receipt is recorded.
CREATE TABLE logistics_studio_referrals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  shipment_line_id TEXT NOT NULL REFERENCES logistics_shipment_lines(id),
  reason TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  observed_quantity REAL CHECK(observed_quantity IS NULL OR observed_quantity >= 0),
  recorded_by TEXT NOT NULL,
  recorded_by_name TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  resolved_by TEXT,
  resolved_by_name TEXT,
  resolved_at TEXT,
  resolution TEXT,
  UNIQUE(account_id, idempotency_key)
);
CREATE UNIQUE INDEX logistics_studio_referral_open
  ON logistics_studio_referrals(account_id, shipment_line_id) WHERE resolved_at IS NULL;

-- Close the race between saving a referral and a stock receipt already in
-- flight. This guard rolls back the whole receipt transaction if the hold wins.
CREATE TRIGGER logistics_hold_studio_receipt BEFORE UPDATE OF received_quantity ON logistics_shipment_lines
 WHEN NEW.received_quantity > OLD.received_quantity AND EXISTS (
   SELECT 1 FROM logistics_studio_referrals r
   WHERE r.account_id = OLD.account_id AND r.shipment_line_id = OLD.id AND r.resolved_at IS NULL
 )
 BEGIN SELECT RAISE(ABORT, 'studio receipt referral is open'); END;
