-- Teajia family, stage 3: one word for who a person is on Teajia.
-- Plan: todo/plans/teajia-family.md (decision 13).
--
-- 'family' (anyone), 'creator' or 'master' (only the owner grants these two).
-- The page address and the page's content never change when the word does.
-- NULL means a page that existed before the family: it keeps its own role
-- text, its draft-and-approve gate and its Pay exactly as they were.
-- One new column, no existing row read or changed.
ALTER TABLE contributors ADD COLUMN page_tier TEXT;
