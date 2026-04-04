-- Stock holds for pending invoices
CREATE TABLE IF NOT EXISTS stock_holds (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    held_grams INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_holds_invoice ON stock_holds (invoice_id);
CREATE INDEX IF NOT EXISTS idx_stock_holds_product ON stock_holds (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_holds_expires ON stock_holds (expires_at);
