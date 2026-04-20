-- 022: Member connection graph + QR table tokens

CREATE TABLE IF NOT EXISTS member_connections (
  id TEXT PRIMARY KEY,
  user_id_a TEXT NOT NULL, -- always stored lexicographically smaller
  user_id_b TEXT NOT NULL, -- always stored lexicographically larger
  source TEXT NOT NULL,    -- event | store | share | gift | manual
  source_ref TEXT,         -- event_id / share_id / invoice_id that triggered it
  created_at TEXT NOT NULL,
  UNIQUE(user_id_a, user_id_b)
);

CREATE TABLE IF NOT EXISTS connection_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  pending_share_id TEXT,   -- compass_share waiting for acceptance
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

-- QR table share tokens (short-lived, for at-table tasting)
CREATE TABLE IF NOT EXISTS table_share_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  source_entry_id TEXT NOT NULL REFERENCES tea_compass_entries(id),
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,          -- 24h lifetime
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connections_a ON member_connections(user_id_a);
CREATE INDEX IF NOT EXISTS idx_connections_b ON member_connections(user_id_b);
CREATE INDEX IF NOT EXISTS idx_invites_from ON connection_invites(from_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_to ON connection_invites(to_user_id);
CREATE INDEX IF NOT EXISTS idx_table_tokens_token ON table_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_table_tokens_entry ON table_share_tokens(source_entry_id);
