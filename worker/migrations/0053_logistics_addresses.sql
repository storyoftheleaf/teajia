-- Reusable destinations; assigned copies preserve the actual shipment address.
CREATE TABLE logistics_addresses (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 label TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('warehouse','destination')),
 recipient TEXT NOT NULL,
 address_lines TEXT NOT NULL,
 city TEXT,
 region TEXT,
 postal_code TEXT,
 country_code TEXT NOT NULL,
 phone TEXT,
 logistics_company_id TEXT,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX logistics_addresses_account ON logistics_addresses(account_id,archived,role);
ALTER TABLE purchase_logistics ADD COLUMN warehouse_address_id TEXT;
ALTER TABLE purchase_logistics ADD COLUMN warehouse_address_json TEXT;
ALTER TABLE logistics_shipments ADD COLUMN delivery_address_id TEXT;
ALTER TABLE logistics_shipments ADD COLUMN delivery_address_json TEXT;
