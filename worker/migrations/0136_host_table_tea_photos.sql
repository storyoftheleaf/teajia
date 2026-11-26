-- Launch 2, slice H6 (todo/plans/guests-and-tea-masters-launch-2-run.md,
-- "Sol, H6"): a host may add their own photograph of a tea on their table,
-- framed in the shared photo editor. One column; no existing row is changed.
ALTER TABLE event_tea_menu ADD COLUMN photo_url TEXT;
