-- 040_curator_tier.sql
-- Curator tier: capability flag on users, attribution fields on collections.
-- Members promoted to Curator can create their own collections with attribution;
-- their publications route WhatsApp requests to Adrian, not to them.
ALTER TABLE users ADD COLUMN can_create_collections INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN curator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE collections ADD COLUMN curator_display_name TEXT;
CREATE INDEX IF NOT EXISTS idx_collections_curator ON collections(curator_user_id);
