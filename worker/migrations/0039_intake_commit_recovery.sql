-- A lost purchase-order response can be replayed without creating a second order.
ALTER TABLE purchase_orders ADD COLUMN create_request_key TEXT;
ALTER TABLE purchase_orders ADD COLUMN create_request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_account_create_request_key
  ON purchase_orders(account_id, create_request_key)
  WHERE create_request_key IS NOT NULL;

-- Freeze the exact intake payload before its first inventory write. A reload
-- replays the same product chunks and purchase keys instead of rebuilding from
-- partially hydrated browser state.
CREATE TABLE IF NOT EXISTS intake_commit_operations (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  batch_id TEXT,
  request_fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (account_id, id)
);
