CREATE TABLE IF NOT EXISTS incident_ledger (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('network', 'configuration', 'server', 'auth', 'authorization', 'workflow', 'client')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'repairing', 'observing', 'resolved')),
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  route TEXT,
  method TEXT,
  http_status INTEGER,
  error_code TEXT NOT NULL,
  safe_message TEXT NOT NULL,
  deployment TEXT,
  account_id TEXT,
  user_id TEXT,
  sample_json TEXT NOT NULL DEFAULT '{}',
  resolved_at TEXT,
  resolution_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_ledger_status_severity_last_seen
  ON incident_ledger(status, severity, last_seen DESC);
