-- Customer tasting journal (synced from localStorage)
CREATE TABLE IF NOT EXISTS customer_tasting_journal (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    product_image TEXT,
    tasting TEXT DEFAULT '{}',
    personal_note TEXT,
    rating INTEGER,
    event_id TEXT,
    event_title TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasting_journal_user ON customer_tasting_journal (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasting_journal_product ON customer_tasting_journal (product_id);
