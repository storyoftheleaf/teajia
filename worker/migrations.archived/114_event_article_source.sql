ALTER TABLE articles ADD COLUMN source_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_account_source_event
  ON articles(account_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- The public recap already reads this field, but no prior migration created it.
ALTER TABLE event_post_session ADD COLUMN shared_tasting_notes TEXT;
