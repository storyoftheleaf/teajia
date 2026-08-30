-- T1: in-flow chat for dialing in tea details during intake.
-- Messages are the audit trail; answers write back to curate_import_items
-- (parsed_json) with an evidenceRef in the same transaction.
CREATE TABLE IF NOT EXISTS curate_import_chat_messages (
  id            TEXT PRIMARY KEY,
  import_id     TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  item_id       TEXT REFERENCES curate_import_items(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('system','agent','operator','assistant')),
  body          TEXT NOT NULL,
  asks_field    TEXT,
  answers_field TEXT,
  answer_value  TEXT,   -- JSON-encoded scalar
  answer_kind   TEXT CHECK (answer_kind IN ('value','unknown','skip')),
  origin        TEXT NOT NULL CHECK (origin IN ('web','agent','system')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_curate_chat_import ON curate_import_chat_messages(import_id, created_at);
CREATE INDEX IF NOT EXISTS idx_curate_chat_item   ON curate_import_chat_messages(item_id, created_at);