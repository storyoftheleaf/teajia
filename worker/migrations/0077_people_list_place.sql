-- The people list: who the owner names a founding member, and who he pins.
-- Two new columns, both empty for every existing page. No row is read,
-- changed or added. Plan: todo/plans/teajia-family.md, "The people list".
--
-- founding_member: 1 when the owner picked this person for "Founding members".
-- list_pinned_at:  when the owner pinned them to the top of their group; NULL is not pinned.
ALTER TABLE contributors ADD COLUMN founding_member INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contributors ADD COLUMN list_pinned_at TEXT;
