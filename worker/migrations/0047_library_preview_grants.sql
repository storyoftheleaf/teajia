-- Opaque, read-only Library capabilities; no full session or refresh credential.
CREATE TABLE IF NOT EXISTS library_preview_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_version INTEGER NOT NULL,
  origin TEXT NOT NULL CHECK (origin = 'http://127.0.0.1:7789'),
  challenge TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  code_expires_at INTEGER NOT NULL,
  token_hash TEXT UNIQUE,
  consumed_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS library_preview_grants_owner ON library_preview_grants(user_id, account_id, expires_at);
