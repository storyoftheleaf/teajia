-- 044_collection_tag_audience.sql
-- Extend collection_publications.target_type to include 'tag'. Tag-audience
-- publications snapshot the matching customers into recipients_json at
-- publish time, identical to person-audience publications, so the public
-- link is stable even if tag membership later drifts.
--
-- SQLite cannot alter a CHECK constraint in place. The standard rebuild is
-- create-new + copy + drop-old + rename. D1 forbids CREATE TEMPORARY TABLE
-- (see migration 041 fix), but plain CREATE TABLE is fine.

CREATE TABLE collection_publications_new (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL DEFAULT 'person' CHECK (target_type IN ('person','store','event','shop','tag')),
    target_id TEXT,
    slug TEXT NOT NULL UNIQUE,
    recipients_json TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    unpublished_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT,
    recipient_seen_at TEXT
);

INSERT INTO collection_publications_new (
    id, collection_id, target_type, target_id, slug, recipients_json,
    published_at, unpublished_at, view_count, created_by_user_id, recipient_seen_at
)
SELECT
    id, collection_id, target_type, target_id, slug, recipients_json,
    published_at, unpublished_at, view_count, created_by_user_id, recipient_seen_at
FROM collection_publications;

DROP TABLE collection_publications;
ALTER TABLE collection_publications_new RENAME TO collection_publications;

CREATE INDEX IF NOT EXISTS idx_collection_publications_collection
    ON collection_publications(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_publications_slug
    ON collection_publications(slug);
CREATE INDEX IF NOT EXISTS idx_collection_publications_target
    ON collection_publications(target_type, target_id, unpublished_at);
