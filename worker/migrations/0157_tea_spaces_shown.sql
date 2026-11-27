-- Tea spaces, step 3 (todo/plans/tea-spaces.md): a host's tea space appears on
-- the tea spaces page only once its owner turns it on, and even then by its
-- area alone. Schema only: every existing place starts off the page.
ALTER TABLE saved_locations ADD COLUMN shown_on_spaces INTEGER NOT NULL DEFAULT 0 CHECK (shown_on_spaces IN (0, 1));
