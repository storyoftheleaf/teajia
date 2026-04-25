-- 043_customer_tags.sql
-- Freeform admin-only tags on customers. Tags are the platform-wide
-- segmentation primitive (see project_contact_tags_feature memory).
-- Storage is lowercase; matching is case-insensitive by virtue of that.

CREATE TABLE IF NOT EXISTS customer_tags (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prevents duplicate (account, customer, tag) rows. Powers idempotent POST.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_unique
    ON customer_tags(account_id, customer_id, tag);

-- Powers "everyone tagged X" and the autocomplete usage-count query.
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag
    ON customer_tags(account_id, tag);
