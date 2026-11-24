-- A guest's note can name one of the teas the host served (the served tea's
-- id), so the public recap places it under that tea. NULL means the table.
ALTER TABLE session_guest_book ADD COLUMN tea_id TEXT;
-- A note agreed only to reach this session's guests. Showing it on the public
-- recap needs the guest's own yes; every existing note keeps 0.
ALTER TABLE session_guest_book ADD COLUMN public_recap INTEGER NOT NULL DEFAULT 0 CHECK (public_recap IN (0, 1));
