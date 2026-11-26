-- Launch 5, M4: circles (a named table that meets again) and series (several
-- sessions under one name). todo/plans/guests-and-tea-masters-launch-5-run.md.
-- A table and a column only. No existing row is changed.

CREATE TABLE IF NOT EXISTS session_series (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, host_user_id TEXT NOT NULL,
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('circle','series')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_series_host ON session_series(host_user_id, account_id);

-- The circle or series a session belongs to. NULL is none.
ALTER TABLE events ADD COLUMN series_id TEXT;
CREATE INDEX IF NOT EXISTS idx_events_series ON events(series_id) WHERE series_id IS NOT NULL;
