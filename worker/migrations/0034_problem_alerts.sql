-- One row per Telegram alert the worker tried to send about a problem in the
-- ledger. It exists so the daily cap is counted in D1, not in isolate memory.
CREATE TABLE IF NOT EXISTS problem_alerts (
  id TEXT PRIMARY KEY,
  incident_id TEXT,
  signature TEXT,
  kind TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_problem_alerts_sent_at ON problem_alerts(sent_at);
