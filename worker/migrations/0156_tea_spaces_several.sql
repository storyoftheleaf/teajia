-- Tea spaces, step 2 (todo/plans/tea-spaces.md). Adrian, 2026-11-27: "In my
-- house I have two spaces, they're different rooms designed differently", and
-- "anyone can own a space". A host may now mark more than one of their saved
-- places as a tea space, so the one-per-account index goes. Schema only: no
-- row is read, changed or removed.
DROP INDEX IF EXISTS idx_saved_locations_one_host_table;
