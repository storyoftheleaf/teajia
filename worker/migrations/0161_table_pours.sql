-- Pours land on the tea table (Adrian, 2026-11-28: "Someone else might be
-- pouring my teas at some point. It would make sense for them to use this.").
--
-- shop_pourers        the people a shop's owner has named to pour its tea at
--                     their own tables. A row is the whole permission: the
--                     pourer sees the shelf's teas and weights, never a cost.
-- event_tea_menu.poured_at  when a tea on a table was poured from the pour
--                     page, so a tea planned ahead and a tea poured read apart.
--
-- Schema only: no existing row is rewritten.

CREATE TABLE IF NOT EXISTS shop_pourers (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  named_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_pourers_user ON shop_pourers(user_id);

ALTER TABLE event_tea_menu ADD COLUMN poured_at TEXT;
