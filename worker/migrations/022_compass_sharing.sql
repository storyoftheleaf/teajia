-- Migration 022: Compass card sharing — direct push to accounts + invite links
-- Lets admins share a capture card to other accounts or generate a link for external tasters.

-- 1. tea_key on compass entries — the identity link that connects reviews cross-account
ALTER TABLE tea_compass_entries ADD COLUMN tea_key TEXT;
CREATE INDEX IF NOT EXISTS idx_compass_entries_tea_key ON tea_compass_entries(tea_key);

-- 2. incoming status support — handled in app layer via status field
--    (tea_compass_entries.status already has TEXT type, 'incoming' is a new valid value)

-- 3. compass_shares — tracks both direct pushes (target_account_id set) and invite links (invite_token set)
CREATE TABLE IF NOT EXISTS compass_shares (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  -- Source
  source_entry_id TEXT NOT NULL,        -- the compass entry being shared
  source_account_id TEXT NOT NULL,      -- account that owns the entry
  source_user_id TEXT NOT NULL,         -- user who initiated the share
  source_user_name TEXT,                -- display name for the invite page
  source_account_name TEXT,             -- account name for the invite page
  -- Tea identity
  tea_key TEXT NOT NULL,
  shared_metadata TEXT NOT NULL,        -- JSON: stripped entry (no vendor/cost/private notes)
  -- Target — one of these is set
  target_account_id TEXT,               -- set for direct push (Option A)
  invite_token TEXT UNIQUE,             -- set for invite link (Option B), NULL for direct push
  invite_token_expires_at TEXT,         -- ISO timestamp, NULL = no expiry
  -- State
  status TEXT DEFAULT 'pending',        -- 'pending' | 'accepted' | 'declined' | 'expired'
  claimed_by_user_id TEXT,              -- who accepted it
  claimed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compass_shares_target ON compass_shares(target_account_id, status);
CREATE INDEX IF NOT EXISTS idx_compass_shares_token  ON compass_shares(invite_token);
CREATE INDEX IF NOT EXISTS idx_compass_shares_source ON compass_shares(source_entry_id);
