-- 069: Relationship-aware people model.
--
-- One row in customers remains the canonical person/contact record. This table
-- records why that person matters to the account: buyer, source, event guest,
-- collection recipient, contributor, or personal connection.

CREATE TABLE IF NOT EXISTS contact_relationships (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'buyer',
    'vendor',
    'event_guest',
    'collection_recipient',
    'contributor',
    'personal_connection'
  )),
  source TEXT NOT NULL DEFAULT 'manual',
  source_entity_type TEXT,
  source_entity_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, customer_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_contact_relationships_account_kind
  ON contact_relationships(account_id, kind);

CREATE INDEX IF NOT EXISTS idx_contact_relationships_customer
  ON contact_relationships(account_id, customer_id);

-- Backfill buyers from invoices.
INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, customer_id, 'buyer', 'backfill', 'invoice', MIN(id)
  FROM invoices
 WHERE customer_id IS NOT NULL AND customer_id != ''
 GROUP BY account_id, customer_id;

-- Backfill sources from products linked to vendor contacts.
INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, vendor_id, 'vendor', 'backfill', 'product', MIN(id)
  FROM products
 WHERE vendor_id IS NOT NULL AND vendor_id != ''
 GROUP BY account_id, vendor_id;

-- Backfill event guests from event attendees.
INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, customer_id, 'event_guest', 'backfill', 'event_attendee', MIN(id)
  FROM event_attendees
 WHERE customer_id IS NOT NULL AND customer_id != ''
 GROUP BY account_id, customer_id;

-- Backfill collection recipients from publication recipient snapshots.
INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), c.account_id, json_extract(r.value, '$.customer_id'),
       'collection_recipient', 'backfill', 'collection_publication', MIN(cp.id)
  FROM collection_publications cp
  JOIN collections c ON c.id = cp.collection_id
  JOIN json_each(cp.recipients_json) r
 WHERE cp.recipients_json IS NOT NULL
   AND json_extract(r.value, '$.customer_id') IS NOT NULL
 GROUP BY c.account_id, json_extract(r.value, '$.customer_id');

-- Backfill explicit vendor/friend tags without making tags the long-term
-- source of truth.
INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, id, 'vendor', 'backfill', 'customer_tag', id
  FROM customers
 WHERE type = 'supplier'
    OR EXISTS (SELECT 1 FROM json_each(customers.tags) WHERE value = 'vendor');

INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, id, 'personal_connection', 'backfill', 'customer_tag', id
  FROM customers
 WHERE EXISTS (SELECT 1 FROM json_each(customers.tags) WHERE value IN ('friend', 'personal'));

-- Keep the relationship layer fresh as normal workflows happen.
CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_invoice_insert
AFTER INSERT ON invoices
WHEN NEW.customer_id IS NOT NULL AND NEW.customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'buyer', 'workflow', 'invoice', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_invoice_customer_update
AFTER UPDATE OF customer_id ON invoices
WHEN NEW.customer_id IS NOT NULL AND NEW.customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'buyer', 'workflow', 'invoice', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_product_vendor_insert
AFTER INSERT ON products
WHEN NEW.vendor_id IS NOT NULL AND NEW.vendor_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.vendor_id, 'vendor', 'workflow', 'product', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_product_vendor_update
AFTER UPDATE OF vendor_id ON products
WHEN NEW.vendor_id IS NOT NULL AND NEW.vendor_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.vendor_id, 'vendor', 'workflow', 'product', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_event_attendee_insert
AFTER INSERT ON event_attendees
WHEN NEW.customer_id IS NOT NULL AND NEW.customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'event_guest', 'workflow', 'event_attendee', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_event_attendee_customer_update
AFTER UPDATE OF customer_id ON event_attendees
WHEN NEW.customer_id IS NOT NULL AND NEW.customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'event_guest', 'workflow', 'event_attendee', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_collection_publication_insert
AFTER INSERT ON collection_publications
WHEN NEW.recipients_json IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  SELECT lower(hex(randomblob(16))), c.account_id, json_extract(r.value, '$.customer_id'),
         'collection_recipient', 'workflow', 'collection_publication', NEW.id
    FROM collections c, json_each(NEW.recipients_json) r
   WHERE c.id = NEW.collection_id
     AND json_extract(r.value, '$.customer_id') IS NOT NULL;
END;
