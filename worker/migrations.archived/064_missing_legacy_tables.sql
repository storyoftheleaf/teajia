-- 064: Recovery migration for 7 legacy tables that were never declared in
-- a migration file but are referenced by worker handler code.
--
-- Same root cause as 063 (the co-tasting tables): these existed on the
-- original development DB via ad-hoc seeds, but were never on remote D1.
-- Production handlers that touched them either threw, or in the case of
-- _upsertTasteProfile silently degraded behind a try/catch.
--
-- This migration is idempotent. CREATE TABLE IF NOT EXISTS so it's safe on
-- environments that already have the tables.
--
-- Discovered while reconciling schema for the Tasting Event launch.
-- Schemas reverse-engineered from the worker's INSERT/SELECT/UPDATE statements.

-- ── Per-account taste fingerprint built from session verdicts ───────────────
-- Written by _upsertTasteProfile; only ever updated, never deleted by handler.
-- Wrapped in try/catch in the worker, so missing table degrades silently.
CREATE TABLE IF NOT EXISTS user_taste_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  verdict_counts TEXT NOT NULL DEFAULT '{}',
  total_tastings INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL,
  UNIQUE(user_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_user_taste_profile_user ON user_taste_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_taste_profile_account ON user_taste_profile(account_id);

-- ── QR table-card share tokens (per compass entry) ──────────────────────────
CREATE TABLE IF NOT EXISTS table_share_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  source_entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_table_share_tokens_token ON table_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_table_share_tokens_entry ON table_share_tokens(source_entry_id);

-- ── Verdicts left by guests scanning a table-card QR before signing up ──────
CREATE TABLE IF NOT EXISTS anonymous_verdicts (
  id TEXT PRIMARY KEY,
  browser_token TEXT NOT NULL,
  table_token TEXT NOT NULL,
  source_entry_id TEXT,
  verdict TEXT NOT NULL,
  notes TEXT,
  tasting_data TEXT,
  claimed_by_user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anonymous_verdicts_browser ON anonymous_verdicts(browser_token);
CREATE INDEX IF NOT EXISTS idx_anonymous_verdicts_table ON anonymous_verdicts(table_token);

-- ── Member connections graph (mutual, symmetric) ────────────────────────────
CREATE TABLE IF NOT EXISTS member_connections (
  id TEXT PRIMARY KEY,
  user_id_a TEXT NOT NULL,
  user_id_b TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id_a, user_id_b)
);
CREATE INDEX IF NOT EXISTS idx_member_connections_a ON member_connections(user_id_a);
CREATE INDEX IF NOT EXISTS idx_member_connections_b ON member_connections(user_id_b);

-- ── Pending invites that resolve into a member_connections row on accept ────
CREATE TABLE IF NOT EXISTS connection_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  pending_share_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_connection_invites_from ON connection_invites(from_user_id);
CREATE INDEX IF NOT EXISTS idx_connection_invites_to ON connection_invites(to_user_id);

-- ── Purchase orders (admin-only sourcing tool) ──────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  vendor_name TEXT,
  vendor_id TEXT,
  vendor_contact TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  total_usd REAL NOT NULL DEFAULT 0,
  display_currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  message_text TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_account ON purchase_orders(account_id);

-- ── Refresh tokens (only DELETE'd from in handleDeleteAccount cascade) ──────
-- Minimal shape; the worker only references user_id.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
