-- Tea Sample QR Tracking System
-- Samples are small tasting portions (5-15g) tracked separately from inventory.
-- Each sample gets a QR code linking to /s/{id} for scan-to-taste flow.

CREATE TABLE IF NOT EXISTS tea_samples (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  chinese_name TEXT,
  type TEXT,
  form TEXT,
  year INTEGER,
  origin_region TEXT,
  source_id TEXT,
  source_name TEXT,
  source_contact TEXT,        -- JSON: VendorDetails (phone, whatsapp, wechat, line)
  product_id TEXT,            -- Links to products.id if sample matches inventory
  compass_entry_id TEXT,      -- Links to tea_compass_entries.id if promoted
  set_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'untasted',
  grams REAL NOT NULL DEFAULT 10,
  notes TEXT,
  photos TEXT DEFAULT '[]',   -- JSON array of URLs
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS tea_sample_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  source_name TEXT,
  purpose TEXT NOT NULL DEFAULT 'sourcing',  -- sourcing | customer-gifted | event
  notes TEXT,
  shared_with TEXT DEFAULT '[]',  -- JSON array of customer tokens
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS tea_sample_tastings (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  taster_id TEXT NOT NULL DEFAULT 'admin',
  taster_name TEXT,
  tasting TEXT NOT NULL DEFAULT '{}',  -- JSON: TastingData (flavor, body, finish, feeling, etc.)
  rating INTEGER,
  verdict TEXT NOT NULL DEFAULT 'neutral',  -- love | like | neutral | pass
  would_buy INTEGER NOT NULL DEFAULT 0,
  personal_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sample_id) REFERENCES tea_samples(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_samples_set_id ON tea_samples(set_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON tea_samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_source_id ON tea_samples(source_id);
CREATE INDEX IF NOT EXISTS idx_sample_tastings_sample_id ON tea_sample_tastings(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_sets_purpose ON tea_sample_sets(purpose);
