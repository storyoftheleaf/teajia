-- 063: Create the four core co-tasting tables.
--
-- Why this migration exists this late: the co-tasting feature was built and
-- shipped without a migration that actually defines the tables it uses. The
-- tables existed on the original development DB via ad-hoc seeds, but new
-- environments (and the live remote D1, until 2026-05-04) had handler code
-- referencing tables that didn't exist.
--
-- This is a recovery migration: idempotent CREATE TABLE IF NOT EXISTS so it
-- safely runs on environments that already have the tables (via seed) and
-- creates them fresh on environments that don't.
--
-- These four tables are the foundation for every other tasting-related
-- migration (058 / 060 / 061 reference them).

CREATE TABLE IF NOT EXISTS tasting_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invite_token TEXT UNIQUE,
  max_participants INTEGER NOT NULL DEFAULT 8,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_account ON tasting_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_status ON tasting_sessions(status);

CREATE TABLE IF NOT EXISTS tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  compass_entry_id TEXT,
  tea_name TEXT,
  tea_key TEXT,
  tea_metadata TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_session_teas_session ON tasting_session_teas(session_id);
CREATE INDEX IF NOT EXISTS idx_session_teas_product ON tasting_session_teas(product_id);

CREATE TABLE IF NOT EXISTS tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_session_members_session ON tasting_session_members(session_id);

CREATE TABLE IF NOT EXISTS tasting_session_verdicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  session_tea_id TEXT NOT NULL REFERENCES tasting_session_teas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  verdict TEXT,
  tasting_data TEXT,
  notes TEXT,
  submitted_at TEXT NOT NULL,
  UNIQUE(session_tea_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_session_verdicts_session ON tasting_session_verdicts(session_id);
