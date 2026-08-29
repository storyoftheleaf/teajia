-- Migration 091: Rename the leaf-form value "Loose Leaf" to "Loose".
--
-- The UI, type union (TeaForm), import mapper, and AI extractor prompt all moved
-- from "Loose Leaf" to the shorter "Loose". Existing rows still hold the old
-- string, which would render as a stale value and break the option <select>
-- (the saved value wouldn't match any option). This migration brings the stored
-- data in line so there is exactly one canonical value.
--
-- `form` lives on three tables: products (the catalog), tea_samples, and
-- tea_profiles. Each UPDATE is scoped to the exact old string, so it is a no-op
-- on any row already migrated (idempotent) and never touches Cake/Brick/etc.

UPDATE products     SET form = 'Loose' WHERE form = 'Loose Leaf';
UPDATE tea_samples  SET form = 'Loose' WHERE form = 'Loose Leaf';
UPDATE tea_profiles SET form = 'Loose' WHERE form = 'Loose Leaf';
