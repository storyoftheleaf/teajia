-- Migration 025: Unified notes thread
-- A single note corpus keyed by tea_key (or compass_entry_id for drafts),
-- shared across compass captures, tasting sessions, events, and product pages.

-- 1. Note sessions — group notes from a sourcing trip, vendor visit, or event
CREATE TABLE IF NOT EXISTS note_sessions (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id),
  title        TEXT,                        -- "Wuyishan vendor visit", "Home gongfu"
  session_date TEXT NOT NULL,              -- ISO date
  location     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_note_sessions_account ON note_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_note_sessions_date    ON note_sessions(account_id, session_date);

-- 2. Notes — the unified thread
CREATE TABLE IF NOT EXISTS notes (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),

  -- Anchors — at least one must be set
  tea_key          TEXT,            -- set when product exists
  compass_entry_id TEXT,            -- set for draft entries; migrated to tea_key on product creation
  session_id       TEXT REFERENCES note_sessions(id),

  -- Content
  text             TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'voice' | 'tasting' | 'vendor'
  tasting_id       TEXT,                             -- links to a CustomerTasting when source_type='tasting'
  tasting_snapshot TEXT,                             -- JSON snapshot of TastingData at save time

  -- Attribution
  author_id        TEXT NOT NULL,
  author_name      TEXT NOT NULL,

  -- Privacy
  visibility       TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'network' | 'public'

  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_account        ON notes(account_id);
CREATE INDEX IF NOT EXISTS idx_notes_tea_key        ON notes(tea_key);
CREATE INDEX IF NOT EXISTS idx_notes_compass_entry  ON notes(compass_entry_id);
CREATE INDEX IF NOT EXISTS idx_notes_session        ON notes(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_tasting        ON notes(tasting_id);
-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  text,
  author_name,
  content='notes',
  content_rowid='rowid'
);
