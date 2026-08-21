-- Inquiry delivery integrity: a request fingerprint lets a retried send be
-- recognised as the same order rather than filed twice.
--
-- This lands as its own migration on purpose. The column and the widened index
-- below were originally written into 130, but 130 had already been applied to
-- production by the time this work followed it, and D1 records migrations by
-- filename — it would never have re-run 130, so the change would have been
-- silently absent in production while the code expected it.
ALTER TABLE inquiries ADD COLUMN request_fingerprint TEXT;

DROP INDEX IF EXISTS idx_inquiries_account_ref;
CREATE INDEX IF NOT EXISTS idx_inquiries_account_ref
  ON inquiries(account_id, ref_number, created_at DESC);
