ALTER TABLE invoice_payments ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payment_request_once
  ON invoice_payments(account_id, invoice_id, request_id) WHERE request_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS invoice_payment_no_confirmed_on_void_insert
BEFORE INSERT ON invoice_payments
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM invoices WHERE id=NEW.invoice_id AND account_id=NEW.account_id AND status='Void'
)
BEGIN SELECT RAISE(ABORT, 'confirmed_payment_on_void_invoice'); END;

CREATE TRIGGER IF NOT EXISTS invoice_payment_no_confirmed_on_void_update
BEFORE UPDATE OF status ON invoice_payments
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM invoices WHERE id=NEW.invoice_id AND account_id=NEW.account_id AND status='Void'
)
BEGIN SELECT RAISE(ABORT, 'confirmed_payment_on_void_invoice'); END;
