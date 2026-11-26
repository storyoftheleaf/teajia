-- Launch 4, slice K4, "Add your table"
-- (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
--
-- A host names one of their saved places (Launch 2, H8) as their table. It
-- stays private: the public is told the area the host writes here, never the
-- address, the map link, the way in or the place's id.
--
-- Columns and one index only. No existing row is touched: every place starts
-- as not a table, with no area.
ALTER TABLE saved_locations ADD COLUMN is_host_table INTEGER NOT NULL DEFAULT 0 CHECK (is_host_table IN (0,1));
ALTER TABLE saved_locations ADD COLUMN area_hint TEXT CHECK (area_hint IS NULL OR length(area_hint) <= 80);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_locations_one_host_table
  ON saved_locations(account_id) WHERE is_host_table = 1;
