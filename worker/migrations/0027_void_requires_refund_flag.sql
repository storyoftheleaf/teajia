-- Legacy void paths restore stock. A paid order must instead use cancel-invoice,
-- which keeps the money and stock history and marks the refund obligation.
CREATE TRIGGER IF NOT EXISTS invoice_no_paid_legacy_void
BEFORE UPDATE OF status ON invoices
WHEN NEW.status='Void' AND OLD.status!='Void' AND COALESCE(NEW.refund_required,0)=0
  AND EXISTS (SELECT 1 FROM invoice_payments
    WHERE invoice_id=OLD.id AND account_id=OLD.account_id AND status='confirmed')
BEGIN SELECT RAISE(ABORT, 'paid_invoice_requires_refund_flag'); END;
