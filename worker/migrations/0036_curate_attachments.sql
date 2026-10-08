-- Private evidence. Nothing here copies business documents into public media.
CREATE TABLE IF NOT EXISTS curate_media_assets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'attached',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(account_id, id)
);
CREATE TABLE IF NOT EXISTS curate_attachments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('tea','vendor','arrival','quote')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('leaf','liquor','wrapper','label','pricelist','businesscard','source_document')),
  position INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(account_id, asset_id) REFERENCES curate_media_assets(account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_curate_attachment_entity ON curate_attachments(account_id,entity_type,entity_id,deleted_at);
