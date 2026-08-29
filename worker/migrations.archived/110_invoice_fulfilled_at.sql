-- Applied once by Wrangler's D1 migration ledger. Like the project's other
-- additive-column migrations, repeat deployment is idempotent because an
-- already-recorded migration is not executed again.
ALTER TABLE invoices ADD COLUMN fulfilled_at TEXT;
