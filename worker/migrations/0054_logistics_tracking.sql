-- Reports supplied by a person/agent are observations, never stock receipts.
CREATE TABLE logistics_tracking_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('purchase','shipment')),
  entity_id TEXT NOT NULL,
  tracking_number TEXT,
  identity TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT,
  reported_at TEXT,
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source='agent_update'),
  source_text TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  UNIQUE(account_id,idempotency_key)
);
CREATE INDEX logistics_updates_entity ON logistics_tracking_updates(account_id,kind,entity_id,identity,COALESCE(reported_at,recorded_at) DESC,id DESC);
