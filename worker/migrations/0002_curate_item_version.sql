-- X1: optimistic concurrency for curate import items (two intake lanes: web + agent)
ALTER TABLE curate_import_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;