-- Migration 017: Multi-account (multi-store) scoping
--
-- Adds the accounts + account_members + tea_reviews tables, adds account_id
-- columns to every tenant-scoped table, seeds Adrian's Bali store and a
-- partner Australia store, and backfills all existing rows to the Bali
-- account. Also seeds account_members for existing users and adds AUD to
-- exchange_rates.
--
-- D1 does not support conditional ALTER TABLE ADD COLUMN; if this migration
-- is re-run on a DB that already has the column, the duplicate-column ALTERs
-- will error. That is acceptable — the migration is intended to be run once.
-- The new table CREATE statements all use IF NOT EXISTS for safety.

-- ── New core tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  location_city TEXT,
  location_country TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency_default TEXT DEFAULT 'USD',
  whatsapp_number TEXT,
  contact_email TEXT,
  public_enabled INTEGER DEFAULT 1,
  public_shop_path TEXT,
  invoice_prefix TEXT,
  owner_user_id TEXT,
  status TEXT DEFAULT 'active',
  trust_tier TEXT DEFAULT 'basic',
  is_platform_owner INTEGER DEFAULT 0,
  ships_to_countries TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  invited_by_user_id TEXT,
  invited_at TEXT,
  joined_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active',
  UNIQUE(account_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_members_user ON account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_account ON account_members(account_id);

CREATE TABLE IF NOT EXISTS tea_reviews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tea_key TEXT NOT NULL,
  product_id TEXT,
  product_account_id TEXT,
  author_user_id TEXT NOT NULL,
  author_account_id TEXT NOT NULL,
  visibility TEXT DEFAULT 'network',
  session_date TEXT,
  rating INTEGER,
  notes TEXT,
  tasting TEXT,
  brew_params TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tea_reviews_key ON tea_reviews(tea_key);
CREATE INDEX IF NOT EXISTS idx_tea_reviews_author ON tea_reviews(author_user_id);
CREATE INDEX IF NOT EXISTS idx_tea_reviews_product ON tea_reviews(product_id);

-- ── account_id columns on existing scoped tables ───────────────────────────

ALTER TABLE products ADD COLUMN account_id TEXT;
ALTER TABLE products ADD COLUMN tea_key TEXT;
ALTER TABLE invoices ADD COLUMN account_id TEXT;
ALTER TABLE invoice_line_items ADD COLUMN account_id TEXT;
ALTER TABLE customers ADD COLUMN account_id TEXT;
ALTER TABLE activity_logs ADD COLUMN account_id TEXT;
ALTER TABLE stock_ledger ADD COLUMN account_id TEXT;
ALTER TABLE teaware_collection ADD COLUMN account_id TEXT;
ALTER TABLE teaware_photos ADD COLUMN account_id TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN account_id TEXT;
ALTER TABLE events ADD COLUMN account_id TEXT;
ALTER TABLE event_attendees ADD COLUMN account_id TEXT;
ALTER TABLE event_notifications ADD COLUMN account_id TEXT;
ALTER TABLE event_post_session ADD COLUMN account_id TEXT;
ALTER TABLE event_tea_menu ADD COLUMN account_id TEXT;
ALTER TABLE event_tasting_notes ADD COLUMN account_id TEXT;
ALTER TABLE guest_invites ADD COLUMN account_id TEXT;
ALTER TABLE interest_signups ADD COLUMN account_id TEXT;
ALTER TABLE saved_locations ADD COLUMN account_id TEXT;
ALTER TABLE tea_samples ADD COLUMN account_id TEXT;
ALTER TABLE tea_sample_sets ADD COLUMN account_id TEXT;
ALTER TABLE tea_sample_tastings ADD COLUMN account_id TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN account_id TEXT;
ALTER TABLE stock_holds ADD COLUMN account_id TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN account_id TEXT;
ALTER TABLE user_favorites ADD COLUMN account_id TEXT;

-- Frequently-read scoped tables get an index on account_id.
CREATE INDEX IF NOT EXISTS idx_products_account ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_events_account ON events(account_id);
CREATE INDEX IF NOT EXISTS idx_tea_compass_entries_account ON tea_compass_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_account ON stock_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account ON activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_products_tea_key ON products(tea_key);

-- ── AUD exchange rate ──────────────────────────────────────────────────────

INSERT OR IGNORE INTO exchange_rates (currency, rate_to_usd) VALUES ('AUD', 1.52);

-- ── Seed accounts ──────────────────────────────────────────────────────────

INSERT OR IGNORE INTO accounts
  (id, slug, name, location_city, location_country, timezone, currency_default,
   is_platform_owner, public_enabled, invoice_prefix, tagline)
VALUES
  ('acc_teajia_bali', 'teajia-bali', 'Teajia Bali', 'Ubud', 'Indonesia',
   'Asia/Makassar', 'USD', 1, 1, 'TJB',
   'Tea, sourced and poured with care.');

INSERT OR IGNORE INTO accounts
  (id, slug, name, location_city, location_country, timezone, currency_default,
   is_platform_owner, public_enabled, invoice_prefix, tagline)
VALUES
  ('acc_teajia_australia', 'teajia-australia', 'Teajia Australia', NULL, 'Australia',
   'Australia/Sydney', 'AUD', 0, 1, 'TJA',
   'Lineage tea in Australia.');

-- ── Backfill existing rows to Adrian's Bali account ────────────────────────

UPDATE products              SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE invoices              SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE invoice_line_items    SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE customers             SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE activity_logs         SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE stock_ledger          SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE teaware_collection    SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE teaware_photos        SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE tea_compass_entries   SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE events                SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE event_attendees       SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE event_notifications   SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE event_post_session    SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE event_tea_menu        SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE event_tasting_notes   SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE guest_invites         SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE interest_signups      SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE saved_locations       SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE tea_samples           SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE tea_sample_sets       SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE tea_sample_tastings   SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE customer_tasting_journal SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE stock_holds           SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE newsletter_subscribers SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;
UPDATE user_favorites        SET account_id = 'acc_teajia_bali' WHERE account_id IS NULL;

-- ── Seed account_members for existing users ───────────────────────────────-

INSERT OR IGNORE INTO account_members (id, account_id, user_id, role, joined_at, status)
SELECT lower(hex(randomblob(16))), 'acc_teajia_bali', id,
  CASE
    WHEN role = 'owner' THEN 'owner'
    WHEN role = 'admin' THEN 'manager'
    ELSE 'staff'
  END,
  datetime('now'),
  'active'
FROM users;
