-- Add `source` column to distinguish inquiry origins (cart vs. consult).
-- Backfilled to 'cart' since all existing rows came from the WhatsApp cart flow.
ALTER TABLE inquiries ADD COLUMN source TEXT NOT NULL DEFAULT 'cart';
CREATE INDEX IF NOT EXISTS idx_inquiries_account_source ON inquiries(account_id, source, created_at DESC);
