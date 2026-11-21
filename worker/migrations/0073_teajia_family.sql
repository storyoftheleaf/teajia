-- Teajia family, stage 1: storage for member photographs and what the shop
-- does with them. New tables only. No existing row is read, changed or added.
-- Plan: todo/plans/teajia-family.md.
--
-- Notes under a tasting are already dated: customer_tasting_journal keeps one
-- row per person per tea, and its `tastings` column is the dated list of
-- sittings, each with its own notes. So no notes table is added here.

-- A photograph a member took of a shop tea. Both sizes are made on the phone
-- and re-encoded there, so neither file carries location data.
-- share_state is the author's choice; shop_use is the shop's. offered_at is
-- the first moment the author offered it to the shop and is never cleared:
-- once offered, the shop may keep using it even after the author removes it
-- from their own page (removed_by_member_at).
CREATE TABLE IF NOT EXISTS member_photographs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  journal_entry_id TEXT,
  page TEXT CHECK (page IS NULL OR page IN ('impression', 'texture', 'effect', 'taste', 'storage', 'notes', 'other')),
  full_key TEXT NOT NULL UNIQUE,
  small_key TEXT NOT NULL UNIQUE,
  full_bytes INTEGER NOT NULL CHECK (full_bytes > 0),
  small_bytes INTEGER NOT NULL CHECK (small_bytes > 0),
  full_width INTEGER NOT NULL CHECK (full_width > 0),
  full_height INTEGER NOT NULL CHECK (full_height > 0),
  small_width INTEGER NOT NULL CHECK (small_width > 0),
  small_height INTEGER NOT NULL CHECK (small_height > 0),
  share_state TEXT NOT NULL DEFAULT 'private' CHECK (share_state IN ('private', 'page', 'offered')),
  offered_at TEXT,
  shop_use TEXT NOT NULL DEFAULT 'none' CHECK (shop_use IN ('none', 'placed', 'lead', 'passed')),
  shop_use_before_lead TEXT CHECK (shop_use_before_lead IS NULL OR shop_use_before_lead IN ('none', 'placed', 'passed')),
  shop_decided_at TEXT,
  shop_decided_by TEXT REFERENCES users(id),
  removed_by_member_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_member_photographs_author_product
  ON member_photographs(author_user_id, product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_member_photographs_author_created
  ON member_photographs(author_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_member_photographs_account_product
  ON member_photographs(account_id, product_id, share_state);
CREATE INDEX IF NOT EXISTS idx_member_photographs_account_offered
  ON member_photographs(account_id, offered_at);
-- One lead picture per tea.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_photographs_one_lead
  ON member_photographs(account_id, product_id) WHERE shop_use = 'lead';

-- The member's own cover for one tea. Only they see it.
CREATE TABLE IF NOT EXISTS member_tea_covers (
  author_user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  photograph_id TEXT NOT NULL REFERENCES member_photographs(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (author_user_id, product_id)
);

-- Whether a tasting is shared. Words and photographs only: the score stays in
-- the private journal and no route reads it from here.
CREATE TABLE IF NOT EXISTS member_tasting_shares (
  journal_entry_id TEXT PRIMARY KEY REFERENCES customer_tasting_journal(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  share_state TEXT NOT NULL DEFAULT 'private' CHECK (share_state IN ('private', 'page', 'offered')),
  shared_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_member_tasting_shares_author
  ON member_tasting_shares(author_user_id, share_state);
CREATE INDEX IF NOT EXISTS idx_member_tasting_shares_account_product
  ON member_tasting_shares(account_id, product_id, share_state);

-- "Find me more" on a sold-out tea. Lands with the shop.
CREATE TABLE IF NOT EXISTS restock_requests (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_restock_requests_one_open
  ON restock_requests(requester_user_id, product_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_restock_requests_account_status
  ON restock_requests(account_id, status, created_at);

-- A visitor's report on a page, photograph or tasting. A visitor may be signed
-- out; no address or device detail is kept.
CREATE TABLE IF NOT EXISTS family_reports (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('page', 'photograph', 'tasting')),
  target_id TEXT NOT NULL,
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
  reporter_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acted', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_family_reports_account_status
  ON family_reports(account_id, status, created_at);

-- The owner's one-tap hide. A page is addressed by its contributor id, a
-- tasting by its journal entry id. Removing the row is the restore.
CREATE TABLE IF NOT EXISTS family_hides (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('page', 'photograph', 'tasting')),
  target_id TEXT NOT NULL,
  hidden_by TEXT NOT NULL REFERENCES users(id),
  hidden_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, target_kind, target_id)
);
