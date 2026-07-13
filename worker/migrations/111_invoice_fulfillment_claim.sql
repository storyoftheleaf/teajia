-- Applied once by Wrangler's D1 migration ledger.
ALTER TABLE invoices ADD COLUMN fulfillment_claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_fulfillment_claim
  ON invoices(account_id, fulfillment_claim_token);
