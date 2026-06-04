-- 082: Tea Compass per-entry verdict.
--
-- Promotes the sourcing verdict (love / like / neutral / pass) from a
-- sample-only signal to a first-class field on every compass entry. This is
-- the single organizing signal the triage / "tasted 10, keep 2" review reads
-- and writes, so it must survive across devices — hence a real column rather
-- than the localStorage-only fields (taste_order, tasting_history, is_sample).

ALTER TABLE tea_compass_entries ADD COLUMN verdict TEXT;  -- 'love' | 'like' | 'neutral' | 'pass'

CREATE INDEX IF NOT EXISTS idx_compass_entries_verdict
  ON tea_compass_entries(verdict);
