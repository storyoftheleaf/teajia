-- Short codes (Adrian, 2026-11-27): every vendor gets V1, V2 ... and every
-- tea or sample a number within its vendor, so "V1T12" names vendor V1's
-- twelfth tea. Numbers are handed out once and never reused: a counter per
-- account (vendors) and per vendor (teas) only ever goes up.
--
-- Every vendor's V code lives in curate_vendor_short_codes. A code typed by
-- hand in the vendor page's Vendor code field (curate_vendor_profiles) is
-- never touched: it is shown instead of the V code, and both find the vendor.
-- A tea's number is server-owned: no client door writes it, the triggers do.
--
-- This migration writes rows (the backfill of numbers and codes). Adrian saw
-- the preview page of the codes before it shipped.

ALTER TABLE tea_compass_entries ADD COLUMN vendor_tea_number INTEGER;

CREATE TABLE IF NOT EXISTS curate_code_counters (
  account_id TEXT NOT NULL,
  scope TEXT NOT NULL,          -- 'vendor', or 'tea:<vendor id>'
  last_number INTEGER NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (account_id, scope)
);

CREATE TABLE IF NOT EXISTS curate_vendor_short_codes (
  vendor_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_compass_vendor_tea_number
  ON tea_compass_entries(account_id, vendor_tea_number);

-- Backfill 1: vendors in the order they were added. A vendor is a contact
-- tagged vendor, a supplier contact, or one any Library tea names.
CREATE TABLE short_code_vendors_0155 AS
SELECT c.id AS vendor_id, c.account_id AS account_id,
       ROW_NUMBER() OVER (PARTITION BY c.account_id ORDER BY c.created_at, c.id) AS n
  FROM customers c
 WHERE c.account_id IS NOT NULL
   AND c.deleted_at IS NULL AND c.merged_into_id IS NULL
   AND (
     c.type = 'supplier'
     OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(c.tags) THEN c.tags ELSE '[]' END) WHERE value = 'vendor')
     OR EXISTS (SELECT 1 FROM tea_compass_entries e
                 WHERE e.account_id = c.account_id
                   AND COALESCE(NULLIF(e.linked_customer_id, ''), NULLIF(e.vendor_id, '')) = c.id)
   );

INSERT INTO curate_vendor_short_codes (vendor_id, account_id, code)
SELECT vendor_id, account_id, 'V' || n FROM short_code_vendors_0155;

INSERT INTO curate_code_counters (account_id, scope, last_number)
SELECT account_id, 'vendor', MAX(n) FROM short_code_vendors_0155 GROUP BY account_id;

DROP TABLE short_code_vendors_0155;

-- Backfill 2: each vendor's teas and samples in the order they were added,
-- archived and deleted ones included so a number is never handed out twice.
CREATE TABLE short_code_teas_0155 (id TEXT PRIMARY KEY, n INTEGER NOT NULL);
INSERT INTO short_code_teas_0155 (id, n)
SELECT e.id,
       ROW_NUMBER() OVER (
         PARTITION BY e.account_id, COALESCE(NULLIF(e.linked_customer_id, ''), NULLIF(e.vendor_id, ''))
         ORDER BY e.created_at, e.id)
  FROM tea_compass_entries e
 WHERE e.account_id IS NOT NULL
   AND COALESCE(NULLIF(e.linked_customer_id, ''), NULLIF(e.vendor_id, '')) IS NOT NULL;

UPDATE tea_compass_entries
   SET vendor_tea_number = (SELECT t.n FROM short_code_teas_0155 t WHERE t.id = tea_compass_entries.id)
 WHERE id IN (SELECT id FROM short_code_teas_0155);

DROP TABLE short_code_teas_0155;

INSERT INTO curate_code_counters (account_id, scope, last_number)
SELECT account_id, 'tea:' || COALESCE(NULLIF(linked_customer_id, ''), NULLIF(vendor_id, '')), MAX(vendor_tea_number)
  FROM tea_compass_entries
 WHERE vendor_tea_number IS NOT NULL
 GROUP BY account_id, COALESCE(NULLIF(linked_customer_id, ''), NULLIF(vendor_id, ''));

-- From now on: a new tea with a vendor takes the next number for that
-- vendor, and its vendor gets a V code if it has none.
CREATE TRIGGER short_code_tea_insert AFTER INSERT ON tea_compass_entries
WHEN NEW.vendor_tea_number IS NULL AND NEW.account_id IS NOT NULL
 AND COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')) IS NOT NULL
BEGIN
  INSERT INTO curate_code_counters (account_id, scope, last_number)
  VALUES (NEW.account_id, 'tea:' || COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')), 1)
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  UPDATE tea_compass_entries SET vendor_tea_number = (
    SELECT last_number FROM curate_code_counters
     WHERE account_id = NEW.account_id
       AND scope = 'tea:' || COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')))
   WHERE id = NEW.id;
  INSERT INTO curate_code_counters (account_id, scope, last_number)
  SELECT NEW.account_id, 'vendor', 1
   WHERE NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c
                      WHERE c.vendor_id = COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')))
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  INSERT OR IGNORE INTO curate_vendor_short_codes (vendor_id, account_id, code)
  SELECT COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')), NEW.account_id,
         'V' || (SELECT last_number FROM curate_code_counters WHERE account_id = NEW.account_id AND scope = 'vendor')
   WHERE NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c
                      WHERE c.vendor_id = COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')));
END;

-- A tea moved to another vendor (or given its first vendor) takes that
-- vendor's next number, unless the same write set the number itself (an undo).
CREATE TRIGGER short_code_tea_vendor_change AFTER UPDATE OF vendor_id, linked_customer_id ON tea_compass_entries
WHEN NEW.account_id IS NOT NULL
 AND COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')) IS NOT NULL
 AND COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, ''))
     IS NOT COALESCE(NULLIF(OLD.linked_customer_id, ''), NULLIF(OLD.vendor_id, ''))
 AND NEW.vendor_tea_number IS OLD.vendor_tea_number
BEGIN
  INSERT INTO curate_code_counters (account_id, scope, last_number)
  VALUES (NEW.account_id, 'tea:' || COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')), 1)
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  UPDATE tea_compass_entries SET vendor_tea_number = (
    SELECT last_number FROM curate_code_counters
     WHERE account_id = NEW.account_id
       AND scope = 'tea:' || COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')))
   WHERE id = NEW.id;
  INSERT INTO curate_code_counters (account_id, scope, last_number)
  SELECT NEW.account_id, 'vendor', 1
   WHERE NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c
                      WHERE c.vendor_id = COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')))
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  INSERT OR IGNORE INTO curate_vendor_short_codes (vendor_id, account_id, code)
  SELECT COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')), NEW.account_id,
         'V' || (SELECT last_number FROM curate_code_counters WHERE account_id = NEW.account_id AND scope = 'vendor')
   WHERE NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c
                      WHERE c.vendor_id = COALESCE(NULLIF(NEW.linked_customer_id, ''), NULLIF(NEW.vendor_id, '')));
END;

-- A new vendor contact, or a contact newly tagged vendor, gets its V code.
CREATE TRIGGER short_code_vendor_insert AFTER INSERT ON customers
WHEN NEW.account_id IS NOT NULL AND (NEW.type = 'supplier'
  OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(NEW.tags) THEN NEW.tags ELSE '[]' END) WHERE value = 'vendor'))
 AND NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c WHERE c.vendor_id = NEW.id)
BEGIN
  INSERT INTO curate_code_counters (account_id, scope, last_number) VALUES (NEW.account_id, 'vendor', 1)
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  INSERT OR IGNORE INTO curate_vendor_short_codes (vendor_id, account_id, code)
  VALUES (NEW.id, NEW.account_id,
          'V' || (SELECT last_number FROM curate_code_counters WHERE account_id = NEW.account_id AND scope = 'vendor'));
END;

CREATE TRIGGER short_code_vendor_tagged AFTER UPDATE OF tags, type ON customers
WHEN NEW.account_id IS NOT NULL AND (NEW.type = 'supplier'
  OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(NEW.tags) THEN NEW.tags ELSE '[]' END) WHERE value = 'vendor'))
 AND NOT EXISTS (SELECT 1 FROM curate_vendor_short_codes c WHERE c.vendor_id = NEW.id)
BEGIN
  INSERT INTO curate_code_counters (account_id, scope, last_number) VALUES (NEW.account_id, 'vendor', 1)
  ON CONFLICT(account_id, scope) DO UPDATE SET last_number = last_number + 1;
  INSERT OR IGNORE INTO curate_vendor_short_codes (vendor_id, account_id, code)
  VALUES (NEW.id, NEW.account_id,
          'V' || (SELECT last_number FROM curate_code_counters WHERE account_id = NEW.account_id AND scope = 'vendor'));
END;
