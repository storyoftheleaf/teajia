-- Tea Wisdom pilot: which Wisdom claim, at which revision, each article block relies on.
-- One new empty table. No existing row is read, changed or added.
-- Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
-- Numbered 0079 because the plan reserves 0078 for the tasting-consent branch
-- (todo/plans/tea-wisdom-pilot-action-plan.md, Phase 0).
--
-- During the pilot this is applied to the local practice database only.
--
-- block_index: the position of the block in articles.blocks.
-- claim_id:    pageId:sectionKey, e.g. gong-ting:definition.
-- rev_used:    the claim revision the block's prose was written against.
-- use_kind:    'prose' is written text, flagged for review when the claim moves on;
--              'live_block' shows the current approved text and is never flagged.
CREATE TABLE IF NOT EXISTS article_wisdom_claim_uses (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  claim_id TEXT NOT NULL,
  rev_used INTEGER NOT NULL,
  use_kind TEXT NOT NULL CHECK (use_kind IN ('prose', 'live_block')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, block_index, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_article_wisdom_claim_uses_claim
  ON article_wisdom_claim_uses (account_id, claim_id);
