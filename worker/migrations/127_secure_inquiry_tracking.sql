-- Public inquiry tracking uses an unguessable bearer token. Store only its
-- SHA-256 hash so a database read cannot recover customer tracking links.
ALTER TABLE inquiries ADD COLUMN tracking_token_hash TEXT;
ALTER TABLE inquiries ADD COLUMN request_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_tracking_token_hash
  ON inquiries(tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_account_ref
  ON inquiries(account_id, ref_number, created_at DESC);
