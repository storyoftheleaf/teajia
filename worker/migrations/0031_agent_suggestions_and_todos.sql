-- Two small lists for Curate that agents write to and Adrian clears.
--
-- Adrian, 2026-10-06: what an agent brings in is a suggestion until he ticks
-- it. GrokBot reads a vendor's website, finds ten teas, he picks three, and
-- those three go to samples with the vendor's name, site and contact attached.
-- `curate_suggestions` is that waiting list. A row is NOT a tea in Curate: it
-- becomes one (a tea_compass_entries row) only when Adrian picks it, and the
-- row then points at the tea it became. Dropped rows stay, so the same tea is
-- not suggested twice without anyone seeing it was already turned down.
--
-- `curate_todos` holds "remind me to ask Wang about the 2018": a line Adrian
-- said that is neither a fact about a tea nor about a vendor, but is attached
-- to one of them. There was nowhere to keep it.
--
-- Schema only: no row is written here.
--
-- Defaults: `state` starts at 'waiting' because a new suggestion genuinely
-- starts there. account_id, created_by_user_id, name, category and fields_json
-- have no default: every write states them, and a row that does not say whose
-- shop it belongs to is refused rather than guessed. Prices live inside
-- fields_json with their currency and unit, never as a bare number column.

CREATE TABLE IF NOT EXISTS curate_suggestions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  -- One delivery from one agent: "GrokBot read wangtea.cn" is one batch.
  batch_id TEXT NOT NULL,
  from_agent TEXT,
  from_url TEXT,
  from_vendor_name TEXT,
  from_contact TEXT,
  from_note TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tea', 'teaware')),
  fields_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'picked', 'dropped')),
  compass_entry_id TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_curate_suggestions_waiting
  ON curate_suggestions(account_id, state, created_at);

CREATE TABLE IF NOT EXISTS curate_todos (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  compass_entry_id TEXT,
  vendor_id TEXT,
  from_agent TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_curate_todos_open
  ON curate_todos(account_id, done_at, created_at);
