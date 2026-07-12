CREATE TABLE IF NOT EXISTS curate_import_batches (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'reviewing', 'completed', 'abandoned')),
  journey_id TEXT,
  visit_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE tea_compass_entries ADD COLUMN import_item_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_compass_import_item
  ON tea_compass_entries(account_id, user_id, import_item_id)
  WHERE import_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curate_import_batches_account
  ON curate_import_batches(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS curate_import_sources (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wechat', 'invoice', 'vendor_list', 'photo', 'file', 'paste')),
  pasted_text TEXT,
  r2_object_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (pasted_text IS NOT NULL OR r2_object_key IS NOT NULL),
  FOREIGN KEY (batch_id) REFERENCES curate_import_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_curate_import_sources_batch
  ON curate_import_sources(account_id, batch_id, created_at);

CREATE TABLE IF NOT EXISTS curate_import_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_id TEXT,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  category TEXT NOT NULL DEFAULT 'tea' CHECK (category IN ('tea', 'teaware')),
  name TEXT,
  raw_text TEXT,
  parsed_data_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  uncertainty_json TEXT NOT NULL DEFAULT '{}',
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'reviewing', 'accepted', 'merged', 'abandoned')),
  compass_entry_id TEXT,
  reserved_compass_entry_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES curate_import_sources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_curate_import_items_batch
  ON curate_import_items(account_id, batch_id, position);
CREATE INDEX IF NOT EXISTS idx_curate_import_items_compass
  ON curate_import_items(account_id, compass_entry_id);
