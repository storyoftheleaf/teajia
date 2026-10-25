-- A chosen name belongs to the encounter before stock exists. Source name stays intact.
ALTER TABLE tea_compass_entries ADD COLUMN given_name TEXT;
UPDATE tea_compass_entries
SET given_name = (SELECT p.given_name FROM products p
  WHERE p.account_id = tea_compass_entries.account_id
    AND (p.id = tea_compass_entries.draft_product_id OR p.source_compass_entry_id = tea_compass_entries.id)
  LIMIT 1)
WHERE EXISTS (SELECT 1 FROM products p WHERE p.account_id = tea_compass_entries.account_id
  AND (p.id = tea_compass_entries.draft_product_id OR p.source_compass_entry_id = tea_compass_entries.id));

-- Both existing edit doors address one linked identity. NULL deliberately clears
-- the given name; source names, stock and prices are never changed by these triggers.
CREATE TRIGGER compass_given_name_to_product
AFTER UPDATE OF given_name ON tea_compass_entries
WHEN NEW.given_name IS NOT OLD.given_name
BEGIN
  UPDATE products SET given_name = NEW.given_name, updated_at = datetime('now')
  WHERE account_id = NEW.account_id AND (id = NEW.draft_product_id OR source_compass_entry_id = NEW.id)
    AND given_name IS NOT NEW.given_name;
END;
CREATE TRIGGER product_given_name_to_compass
AFTER UPDATE OF given_name ON products
WHEN NEW.given_name IS NOT OLD.given_name
BEGIN
  UPDATE tea_compass_entries SET given_name = NEW.given_name, updated_at = datetime('now')
  WHERE account_id = NEW.account_id AND (draft_product_id = NEW.id OR id = NEW.source_compass_entry_id)
    AND given_name IS NOT NEW.given_name;
END;
CREATE TRIGGER product_given_name_on_create
AFTER INSERT ON products
WHEN NEW.source_compass_entry_id IS NOT NULL
BEGIN
  UPDATE products SET given_name = (SELECT given_name FROM tea_compass_entries
    WHERE id = NEW.source_compass_entry_id AND account_id = NEW.account_id)
  WHERE id = NEW.id AND EXISTS (SELECT 1 FROM tea_compass_entries
    WHERE id = NEW.source_compass_entry_id AND account_id = NEW.account_id AND given_name IS NOT NULL);
  UPDATE tea_compass_entries SET given_name = (SELECT given_name FROM products WHERE id = NEW.id), updated_at = datetime('now')
  WHERE account_id = NEW.account_id AND id = NEW.source_compass_entry_id
    AND given_name IS NOT (SELECT given_name FROM products WHERE id = NEW.id);
END;

-- Linking an already-named encounter to an existing holding keeps that choice;
-- an encounter without a chosen name adopts the holding's existing name.
CREATE TRIGGER compass_given_name_on_link
AFTER UPDATE OF draft_product_id ON tea_compass_entries
WHEN NEW.draft_product_id IS NOT NULL AND NEW.draft_product_id IS NOT OLD.draft_product_id
BEGIN
  UPDATE products SET given_name = NEW.given_name, updated_at = datetime('now')
  WHERE id = NEW.draft_product_id AND account_id = NEW.account_id
    AND NEW.given_name IS NOT NULL AND given_name IS NOT NEW.given_name;
  UPDATE tea_compass_entries
  SET given_name = (SELECT given_name FROM products WHERE id = NEW.draft_product_id AND account_id = NEW.account_id), updated_at = datetime('now')
  WHERE id = NEW.id AND account_id = NEW.account_id
    AND EXISTS (SELECT 1 FROM products WHERE id = NEW.draft_product_id AND account_id = NEW.account_id)
    AND given_name IS NOT (SELECT given_name FROM products WHERE id = NEW.draft_product_id AND account_id = NEW.account_id);
END;
