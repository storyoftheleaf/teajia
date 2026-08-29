-- Migration 021: Panel tasting — unified review layer for collaborative tasting
-- Adds tea_key to samples, extends tea_reviews for draft state + voice notes,
-- and adds panel sharing to sample sets.

-- 1. Link samples to a tea_key so their tastings aggregate in tea_reviews
ALTER TABLE tea_samples ADD COLUMN tea_key TEXT;
CREATE INDEX IF NOT EXISTS idx_tea_samples_tea_key ON tea_samples(tea_key);

-- 2. Extend tea_reviews for Mode 3 live draft collaboration
ALTER TABLE tea_reviews ADD COLUMN voice_notes TEXT;         -- JSON string[] — raw transcriptions
ALTER TABLE tea_reviews ADD COLUMN status TEXT DEFAULT 'submitted'; -- 'draft' | 'submitted'
ALTER TABLE tea_reviews ADD COLUMN source_sample_id TEXT;   -- link back to the sample that triggered this review
ALTER TABLE tea_reviews ADD COLUMN verdict TEXT;             -- 'love' | 'like' | 'neutral' | 'pass'
ALTER TABLE tea_reviews ADD COLUMN would_buy INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tea_reviews_status ON tea_reviews(status);
CREATE INDEX IF NOT EXISTS idx_tea_reviews_sample ON tea_reviews(source_sample_id);

-- 3. Allow sample sets to be shared with specific accounts for panel tastings
ALTER TABLE tea_sample_sets ADD COLUMN panel_account_ids TEXT; -- JSON string[] of account IDs
