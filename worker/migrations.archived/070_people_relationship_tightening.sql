-- 070: Tighten the relationship taxonomy into owner-safe product behavior.
--
-- Contributors remain public editorial identities. This adds an optional
-- private contact bridge so a contributor can also point to the canonical
-- customer/contact record when Adrian needs operational context.
--
-- Personal notes move into an owner-only table. A note can mark a person as a
-- personal connection without exposing the actual note to non-owner staff.

ALTER TABLE contributors ADD COLUMN contact_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contributors_contact_customer
  ON contributors(account_id, contact_customer_id)
  WHERE contact_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS contact_private_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_private_notes_customer
  ON contact_private_notes(account_id, customer_id);

-- Conservative contributor/contact backfill: only exact normalized display
-- name matches, and only where the contributor has no private link yet.
UPDATE contributors
   SET contact_customer_id = (
     SELECT c.id
       FROM customers c
      WHERE c.account_id = contributors.account_id
        AND lower(trim(c.name)) = lower(trim(contributors.display_name))
      LIMIT 1
   )
 WHERE contact_customer_id IS NULL
   AND EXISTS (
     SELECT 1
       FROM customers c
      WHERE c.account_id = contributors.account_id
        AND lower(trim(c.name)) = lower(trim(contributors.display_name))
   );

INSERT OR IGNORE INTO contact_relationships
  (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
SELECT lower(hex(randomblob(16))), account_id, contact_customer_id, 'contributor', 'backfill', 'contributor', id
  FROM contributors
 WHERE contact_customer_id IS NOT NULL
   AND contact_customer_id != '';

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_contributor_insert
AFTER INSERT ON contributors
WHEN NEW.contact_customer_id IS NOT NULL AND NEW.contact_customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.contact_customer_id, 'contributor', 'workflow', 'contributor', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_relationship_contributor_contact_update
AFTER UPDATE OF contact_customer_id ON contributors
WHEN NEW.contact_customer_id IS NOT NULL AND NEW.contact_customer_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.contact_customer_id, 'contributor', 'workflow', 'contributor', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_private_note_relationship_insert
AFTER INSERT ON contact_private_notes
WHEN trim(NEW.body) != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'personal_connection', 'workflow', 'private_note', NEW.customer_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_private_note_relationship_update
AFTER UPDATE OF body ON contact_private_notes
WHEN trim(NEW.body) != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.customer_id, 'personal_connection', 'workflow', 'private_note', NEW.customer_id);
END;
