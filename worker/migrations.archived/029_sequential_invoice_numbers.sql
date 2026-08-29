-- Sequential invoice numbering: add per-account counter, seed from existing invoice count
ALTER TABLE accounts ADD COLUMN invoice_seq INTEGER NOT NULL DEFAULT 0;
UPDATE accounts SET invoice_seq = (SELECT COUNT(*) FROM invoices WHERE invoices.account_id = accounts.id);
