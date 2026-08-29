-- Migration 018: Create tables that were referenced in code and migration 017
-- but never existed in the remote database.

-- ── guest_invites (from 004_events_v2.sql, never applied remotely) ──────

CREATE TABLE IF NOT EXISTS guest_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  parent_attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  invite_token TEXT UNIQUE NOT NULL,
  name_hint TEXT,
  claimed_by_name TEXT,
  claimed_by_phone TEXT,
  claimed_by_email TEXT,
  claimed_attendee_id TEXT REFERENCES event_attendees(id),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired')),
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT
);

-- ── interest_signups (from 004_events_v2.sql) ───────────────────────────

CREATE TABLE IF NOT EXISTS interest_signups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── tea_samples (from 0007_tea_samples.sql) ─────────────────────────────

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
  source_contact TEXT,
  product_id TEXT,
  compass_entry_id TEXT,
  set_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'untasted',
  grams REAL NOT NULL DEFAULT 10,
  notes TEXT,
  photos TEXT DEFAULT '[]',
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  user_id TEXT
);

-- ── tea_sample_sets (from 0007_tea_samples.sql) ─────────────────────────

CREATE TABLE IF NOT EXISTS tea_sample_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  source_name TEXT,
  purpose TEXT NOT NULL DEFAULT 'sourcing',
  notes TEXT,
  shared_with TEXT DEFAULT '[]',
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT
);

-- ── tea_sample_tastings (from 0007_tea_samples.sql) ─────────────────────

CREATE TABLE IF NOT EXISTS tea_sample_tastings (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  taster_id TEXT NOT NULL DEFAULT 'admin',
  taster_name TEXT,
  tasting TEXT NOT NULL DEFAULT '{}',
  rating INTEGER,
  verdict TEXT NOT NULL DEFAULT 'neutral',
  would_buy INTEGER NOT NULL DEFAULT 0,
  personal_note TEXT,
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sample_id) REFERENCES tea_samples(id) ON DELETE CASCADE
);

-- ── customer_tasting_journal (new — inferred from worker code) ──────────

CREATE TABLE IF NOT EXISTS customer_tasting_journal (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  product_type TEXT,
  product_image TEXT,
  tasting TEXT DEFAULT '{}',
  personal_note TEXT,
  rating INTEGER,
  event_id TEXT,
  event_title TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_tasting_journal_user ON customer_tasting_journal(user_id);

-- ── stock_holds (new — inferred from worker code) ───────────────────────

CREATE TABLE IF NOT EXISTS stock_holds (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  invoice_id TEXT,
  product_id TEXT,
  held_grams REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_holds_invoice ON stock_holds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stock_holds_product ON stock_holds(product_id);

-- ── newsletter_subscribers (new — inferred from worker code) ────────────

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT,
  email TEXT NOT NULL,
  source TEXT,
  subscribed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, email)
);

-- ── user_favorites (new — inferred from worker code) ────────────────────

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  account_id TEXT,
  item_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, account_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
