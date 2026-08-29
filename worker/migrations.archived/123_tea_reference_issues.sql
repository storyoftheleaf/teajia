CREATE TABLE IF NOT EXISTS tea_reference_issues (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  page_slug TEXT NOT NULL,
  route TEXT NOT NULL,
  section_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'incorrect_information',
    'translation',
    'unclear_writing',
    'wrong_source',
    'geography_or_hierarchy',
    'missing_information'
  )),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  normalized_note TEXT NOT NULL CHECK (length(normalized_note) > 0),
  public_text_snapshot TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(source_ids_json) AND json_type(source_ids_json) = 'array'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_by_user_id TEXT REFERENCES users(id),
  resolved_at TEXT,
  CHECK (
    (status = 'open' AND resolved_by_user_id IS NULL AND resolved_at IS NULL)
    OR
    (status = 'resolved' AND resolved_by_user_id IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tea_reference_issues_open_account_page
  ON tea_reference_issues(account_id, page_id, section_key, created_at, id)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tea_reference_issues_open_duplicate
  ON tea_reference_issues(account_id, page_id, section_key, category, normalized_note)
  WHERE status = 'open';
