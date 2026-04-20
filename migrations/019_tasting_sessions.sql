-- 019: Co-tasting sessions

CREATE TABLE IF NOT EXISTS tasting_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed
  invite_token TEXT UNIQUE,
  max_participants INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  compass_entry_id TEXT REFERENCES tea_compass_entries(id),
  tea_name TEXT NOT NULL,
  tea_key TEXT,
  tea_metadata TEXT, -- JSON snapshot of entry at share time
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasting_session_verdicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  session_tea_id TEXT NOT NULL REFERENCES tasting_session_teas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  verdict TEXT, -- love | like | neutral | pass
  tasting_data TEXT, -- JSON
  notes TEXT,
  submitted_at TEXT NOT NULL,
  UNIQUE(session_tea_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tasting_sessions_account ON tasting_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_token ON tasting_sessions(invite_token);
CREATE INDEX IF NOT EXISTS idx_session_teas_session ON tasting_session_teas(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_session ON tasting_session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_user ON tasting_session_members(user_id);
CREATE INDEX IF NOT EXISTS idx_session_verdicts_session ON tasting_session_verdicts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_verdicts_tea ON tasting_session_verdicts(session_tea_id);
