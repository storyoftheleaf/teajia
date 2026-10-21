-- Full-transcript references retain their scope when reopened. Existing links
-- are excerpts; this state default records that existing behavior only.
ALTER TABLE curate_ar_links ADD COLUMN transcript_mode TEXT NOT NULL DEFAULT 'excerpt' CHECK (transcript_mode IN ('excerpt','full'));
