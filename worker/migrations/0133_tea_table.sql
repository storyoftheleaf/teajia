-- Launch 4, the Tea Table (todo/plans/guests-and-tea-masters-launch-4-run.md,
-- slice K-C, the part that waited on Q6; Adrian said yes on 2026-11-26).
-- Columns and tables only; no existing row is touched.

-- A piece held at the top of the Tea Table by hand, by its host or by Adrian
-- for the whole table. A hold always ends, so nothing stays on top by being
-- forgotten.
CREATE TABLE IF NOT EXISTS tea_table_holds (
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recap','casual_sit','tasting')),
  item_id   TEXT NOT NULL,
  held_by   TEXT NOT NULL REFERENCES users(id),
  held_until TEXT NOT NULL,
  PRIMARY KEY (item_kind, item_id)
);

-- A piece a person kept to their own favourites. Private; the number of keeps
-- is read only by the platform owner, in Manage.
CREATE TABLE IF NOT EXISTS tea_table_keeps (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recap','casual_sit','tasting')),
  item_id   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_kind, item_id)
);

-- The consent gate (K0 audit, finding 5). A tasting is on the Tea Table only
-- when its author shared it under the Tea Table wording: the moment they did,
-- and the sittings the journal held at that moment (a JSON list of sitting
-- ids). Shares made under the older "On my page" wording have no moment here
-- and stay off the table until shared again.
ALTER TABLE member_tasting_shares ADD COLUMN tea_table_at TEXT;
ALTER TABLE member_tasting_shares ADD COLUMN tea_table_sittings TEXT;

-- A published session recap is on the Tea Table only when its host put it
-- there after the wording existed. Adrian's hide takes it off the table.
ALTER TABLE events ADD COLUMN tea_table_at TEXT;
ALTER TABLE events ADD COLUMN tea_table_by TEXT;
ALTER TABLE events ADD COLUMN tea_table_hidden_at TEXT;
