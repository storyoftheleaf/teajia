-- Launch 4, tea houses as Adrian's portfolio (slice K5 part two of
-- todo/plans/guests-and-tea-masters-launch-4-run.md, "Tea Houses as a
-- portfolio (Adrian, 2026-11-26)"). Tables only; no existing row is touched.
--
-- Both tables belong to the platform owner's account (account_id), and only
-- the platform owner writes them (worker/src/teaHouses.ts). A house is an
-- account (house_account_id). Nothing here is public until he marks the
-- house's page shown, and even then only while the house itself is public.

-- One row per house he has said something about: his order of the houses by
-- hand, and whether its page is shown.
CREATE TABLE IF NOT EXISTS tea_house_pages (
  house_account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  position         INTEGER NOT NULL DEFAULT 0,
  is_shown         INTEGER NOT NULL DEFAULT 0 CHECK (is_shown IN (0,1)),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tea_house_pages_order ON tea_house_pages(account_id, position);

-- What he did in a house, one part per row, in his words, with photographs
-- (a JSON list of media addresses). A part with no row was not his there, and
-- is never shown.
CREATE TABLE IF NOT EXISTS tea_house_contributions (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  house_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  part             TEXT NOT NULL CHECK (part IN ('room','teaware','tea_menu','training','opening','sourcing')),
  words            TEXT NOT NULL,
  photographs      TEXT NOT NULL DEFAULT '[]',
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (house_account_id, part)
);
CREATE INDEX IF NOT EXISTS idx_tea_house_contributions_house ON tea_house_contributions(house_account_id);
