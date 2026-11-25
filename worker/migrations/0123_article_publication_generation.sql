-- A public transition invalidates older reviews even if status and date cycle
-- back to the same values within the same second.
ALTER TABLE articles ADD COLUMN publication_generation INTEGER NOT NULL DEFAULT 0;
