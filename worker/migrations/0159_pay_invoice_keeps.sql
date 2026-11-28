-- Saving a pay link grants access to one invoice, in the account that sent it.
CREATE TABLE pay_invoice_keeps (
  id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, invoice_id)
);
CREATE INDEX idx_pay_invoice_keeps_user ON pay_invoice_keeps(user_id);

CREATE INDEX idx_legacy_pay_invoice_audit ON platform_audit_log(account_id, target_id)
WHERE target_type = 'invoice' AND action IN ('pay_invoice.kept', 'pay_invoice.released');
CREATE INDEX idx_legacy_pay_invoice_customer_audit ON platform_audit_log(
  account_id, json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.customer_id')
) WHERE target_type = 'invoice' AND action = 'pay_invoice.kept';

CREATE VIEW pay_invoice_audit_events AS
SELECT rowid AS sequence, id, account_id, target_id AS invoice_id, action, actor_id, created_at,
       CASE WHEN json_valid(details) THEN details ELSE '{}' END AS details
FROM platform_audit_log
WHERE target_type = 'invoice' AND action IN ('pay_invoice.kept', 'pay_invoice.released');

-- Authenticated checkout or tracking claim stores the buyer's library on the
-- order itself. A library with its own buyer identity can preserve that order
-- without trusting an older broad customer binding.
CREATE VIEW invoice_authenticated_buyer AS
SELECT i.id AS invoice_id, i.account_id, c.user_id
FROM invoices i
JOIN customers c ON c.account_id = i.account_id AND c.id = i.customer_id
JOIN accounts library ON library.id = i.customer_library_account_id
  AND (library.owner_user_id = c.user_id OR library.personal_inventory_user_id = c.user_id)
WHERE EXISTS (
  SELECT 1 FROM inquiries q WHERE q.account_id = i.account_id
    AND (q.id = i.source_inquiry_id OR q.converted_invoice_id = i.id)
);

-- The former save logged either a new binding on a previously unlinked
-- customer or a new customer assignment on a previously unassigned invoice.
-- Treat separately verified links and checkout evidence as independent.
CREATE VIEW pay_invoice_legacy_attributions AS
SELECT p.sequence, 'legacy-' || p.id AS id, p.account_id, p.invoice_id,
       c.id AS customer_id, c.user_id, json_extract(p.details, '$.linked') AS linked
FROM pay_invoice_audit_events p
JOIN customers c ON c.account_id = p.account_id AND c.id = json_extract(p.details, '$.customer_id')
                AND c.user_id = p.actor_id
WHERE p.action = 'pay_invoice.kept' AND json_extract(p.details, '$.keep_id') IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pay_invoice_audit_events r
    WHERE r.account_id = p.account_id AND r.invoice_id = p.invoice_id AND r.sequence > p.sequence
      AND r.action = 'pay_invoice.released' AND json_extract(r.details, '$.keep_id') IS NULL
      AND json_extract(r.details, '$.released_user_id') = p.actor_id
      AND json_extract(r.details, '$.linked') = json_extract(p.details, '$.linked')
  )
  AND (
    (json_extract(p.details, '$.linked') = 'customer'
      AND COALESCE(datetime(c.user_linked_at) >= datetime(p.created_at), 0) = 0)
    OR (json_extract(p.details, '$.linked') = 'invoice' AND EXISTS (
      SELECT 1 FROM invoices i WHERE i.id = p.invoice_id AND i.account_id = p.account_id AND i.customer_id = c.id
        AND NOT EXISTS (
          SELECT 1 FROM invoice_authenticated_buyer buyer WHERE buyer.account_id = i.account_id AND buyer.invoice_id = i.id
        )
    ))
  );

CREATE VIEW linked_customer_accounts AS
SELECT c.id, c.account_id, c.user_id, c.name, c.created_at
FROM customers c WHERE c.user_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM pay_invoice_legacy_attributions a
  WHERE a.linked = 'customer' AND a.account_id = c.account_id AND a.customer_id = c.id
);

-- Store contact fields stay on the shop record. The former unnamed save could
-- assign even an independently linked customer record, so exclude the entire
-- derived buyer association on that invoice until the shop changes its customer.
CREATE VIEW invoice_buyer_identity AS
SELECT i.id AS invoice_id, i.account_id, COALESCE(linked.user_id, buyer.user_id) AS user_id, c.email
FROM invoices i
JOIN customers c ON c.account_id = i.account_id AND c.id = i.customer_id
LEFT JOIN linked_customer_accounts linked ON linked.account_id = c.account_id AND linked.id = c.id
LEFT JOIN invoice_authenticated_buyer buyer ON buyer.account_id = i.account_id AND buyer.invoice_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM pay_invoice_legacy_attributions a
  WHERE a.linked = 'invoice' AND a.account_id = i.account_id AND a.invoice_id = i.id
);

CREATE VIEW invoice_keep_grants AS
SELECT id, account_id, invoice_id, user_id FROM pay_invoice_keeps
UNION ALL
SELECT a.id, a.account_id, a.invoice_id, a.user_id
FROM pay_invoice_legacy_attributions a
JOIN invoices i ON i.id = a.invoice_id AND i.account_id = a.account_id AND i.customer_id = a.customer_id
WHERE NOT EXISTS (SELECT 1 FROM pay_invoice_keeps k WHERE k.account_id = a.account_id AND k.invoice_id = a.invoice_id)
  AND NOT EXISTS (
    SELECT 1 FROM pay_invoice_audit_events newer
    WHERE newer.account_id = a.account_id AND newer.invoice_id = a.invoice_id AND newer.sequence > a.sequence
      AND newer.action = 'pay_invoice.kept' AND json_extract(newer.details, '$.linked') IN ('customer', 'invoice')
  )
  AND NOT EXISTS (
    SELECT 1 FROM pay_invoice_audit_events r
    WHERE r.account_id = a.account_id AND r.invoice_id = a.invoice_id AND r.action = 'pay_invoice.released'
      AND json_extract(r.details, '$.keep_id') = a.id
  );
