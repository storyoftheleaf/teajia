-- 021: Member taste profiles — silent data capture for recommendations

CREATE TABLE IF NOT EXISTS user_taste_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  preferred_types TEXT NOT NULL DEFAULT '{}',    -- JSON: { "Sheng": 12, "Oolong": 5 }
  preferred_notes TEXT NOT NULL DEFAULT '{}',    -- JSON: { "floral": 8, "earthy": 14 }
  preferred_regions TEXT NOT NULL DEFAULT '{}',  -- JSON: { "Yunnan": 9, "Fujian": 3 }
  verdict_counts TEXT NOT NULL DEFAULT '{}',     -- JSON: { "love": 15, "like": 8, "neutral": 2, "pass": 1 }
  total_tastings INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL
);

-- anonymous QR verdicts: stored by browser token, retroactively linked on signup
CREATE TABLE IF NOT EXISTS anonymous_verdicts (
  id TEXT PRIMARY KEY,
  browser_token TEXT NOT NULL,
  table_token TEXT NOT NULL,          -- links to the QR session
  source_entry_id TEXT,               -- the compass entry being tasted
  verdict TEXT NOT NULL,              -- love | like | neutral | pass
  notes TEXT,
  tasting_data TEXT,                  -- JSON
  claimed_by_user_id TEXT,            -- set when user signs up and claims
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_taste_profile_user ON user_taste_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_taste_profile_account ON user_taste_profile(account_id);
CREATE INDEX IF NOT EXISTS idx_anon_verdicts_browser ON anonymous_verdicts(browser_token);
CREATE INDEX IF NOT EXISTS idx_anon_verdicts_table ON anonymous_verdicts(table_token);
