-- Article ↔ Product cross-references (for Magazine ↔ Shop linking)
CREATE TABLE IF NOT EXISTS article_products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    article_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_products_unique ON article_products (article_id, product_id);
CREATE INDEX IF NOT EXISTS idx_article_products_article ON article_products (article_id);
CREATE INDEX IF NOT EXISTS idx_article_products_product ON article_products (product_id);

-- Module ↔ Product cross-references (for Learn ↔ Shop linking)
CREATE TABLE IF NOT EXISTS module_products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    module_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_products_unique ON module_products (module_id, product_id);

-- Project ↔ Product cross-references (for Consult ↔ Shop linking)
CREATE TABLE IF NOT EXISTS project_products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_products_unique ON project_products (project_id, product_id);
