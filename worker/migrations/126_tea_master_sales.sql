-- Same-account Tea Master sales authority and settlement snapshots.
-- Grants are revoked in place so fulfilled invoice history remains auditable.
-- Migration 018 created a nullable, tenant-unsafe version of stock_holds.
-- Preserve complete rows and deliberately discard unusable rows whose tenant,
-- invoice, product, or quantity is unknown rather than exposing them globally.
ALTER TABLE stock_holds RENAME TO stock_holds_legacy_126;
DROP INDEX IF EXISTS idx_stock_holds_invoice;
DROP INDEX IF EXISTS idx_stock_holds_product;

CREATE TABLE stock_holds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  held_grams REAL NOT NULL DEFAULT 0,
  expires_at TEXT
);
INSERT INTO stock_holds (id,account_id,invoice_id,product_id,held_grams,expires_at)
SELECT id,account_id,invoice_id,product_id,held_grams,NULL
FROM stock_holds_legacy_126
WHERE id IS NOT NULL AND account_id IS NOT NULL AND invoice_id IS NOT NULL
  AND product_id IS NOT NULL AND held_grams IS NOT NULL;
DROP TABLE stock_holds_legacy_126;

CREATE INDEX idx_stock_holds_invoice ON stock_holds(account_id,invoice_id);
CREATE INDEX idx_stock_holds_product ON stock_holds(account_id,product_id);

CREATE TABLE sales_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  price_floor REAL,
  owner_share_type TEXT NOT NULL DEFAULT 'percent' CHECK(owner_share_type IN ('percent','fixed')),
  owner_share_value REAL NOT NULL DEFAULT 100,
  quantity_limit REAL,
  starts_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE invoices ADD COLUMN sold_by_user_id TEXT REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN payment_recipient_user_id TEXT REFERENCES users(id);
ALTER TABLE invoice_line_items ADD COLUMN stock_owner_user_id TEXT REFERENCES users(id);
ALTER TABLE invoice_line_items ADD COLUMN sales_grant_id TEXT REFERENCES sales_grants(id);

CREATE TABLE sales_settlements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  line_item_id TEXT NOT NULL REFERENCES invoice_line_items(id),
  product_id TEXT REFERENCES products(id),
  stock_owner_user_id TEXT REFERENCES users(id),
  seller_user_id TEXT NOT NULL REFERENCES users(id),
  grant_id TEXT REFERENCES sales_grants(id),
  gross_amount REAL NOT NULL,
  owner_amount REAL NOT NULL,
  seller_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'owed' CHECK(status IN ('owed','paid','reversed')),
  reversed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, line_item_id)
);

CREATE INDEX idx_sales_grants_account_product_seller
  ON sales_grants(account_id, product_id, seller_user_id);
CREATE INDEX idx_sales_grants_account_seller_active
  ON sales_grants(account_id, seller_user_id, revoked_at, starts_at, expires_at);
CREATE INDEX idx_sales_settlements_account_status
  ON sales_settlements(account_id, status);
CREATE INDEX idx_sales_settlements_account_seller
  ON sales_settlements(account_id, seller_user_id);
CREATE INDEX idx_sales_settlements_account_owner
  ON sales_settlements(account_id, stock_owner_user_id);

CREATE TRIGGER trg_stock_holds_available_quantity
BEFORE INSERT ON stock_holds
FOR EACH ROW WHEN NEW.held_grams < 0
BEGIN
  SELECT RAISE(ABORT, 'insufficient available stock');
END;
