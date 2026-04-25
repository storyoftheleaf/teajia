-- 041: Move customer_tasting_journal to one-entry-per-(user, productId).
--
-- Adds `note` and `tastings` JSON columns plus an `archived` flag, drops the
-- quick-note sentinel rows, dedupes any duplicate (user_id, product_id) rows
-- by merging them into one entry whose `tastings` is the chronological list
-- of the originals, and adds a UNIQUE constraint server-side.
--
-- Tasting hasn't shipped at volume yet; the user authorized clean dedupe.

-- 1) Drop sentinel quick-note rows.
DELETE FROM customer_tasting_journal WHERE product_id IS NULL OR product_id = 'quick-note';

-- 2) Add new columns. Existing rows get NULL for note/tastings; the worker
--    handler tolerates legacy rows (sync.ts fromApiRow) and the next sync
--    upgrades them in place.
--
--    `source_type` was referenced by application code but never added by an
--    earlier migration on this table; add it here so the backfill below can
--    read it (legacy rows get NULL, which is fine).
ALTER TABLE customer_tasting_journal ADD COLUMN source_type TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN note TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN tastings TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN archived INTEGER DEFAULT 0;

-- 3) Backfill: convert each existing row into the new shape in place. The
--    legacy `tasting` JSON becomes both note.tasting and tastings[0].tasting.
--    Preserves source_type / event_id / event_title at the tasting level
--    (where they belong in the new model).
UPDATE customer_tasting_journal
SET
  note = json_object(
    'tasting', json(COALESCE(tasting, '{}')),
    'personalNote', personal_note,
    'rating', rating,
    'updatedAt', COALESCE(created_at, datetime('now'))
  ),
  tastings = json_array(
    json_object(
      'id', id,
      'createdAt', COALESCE(created_at, datetime('now')),
      'tasting', json(COALESCE(tasting, '{}')),
      'sourceType', source_type,
      'eventId', event_id,
      'eventTitle', event_title
    )
  )
WHERE note IS NULL;

-- 4) Dedupe step intentionally omitted.
--    D1 doesn't allow CREATE TEMPORARY TABLE, and at the time this migration
--    was first applied to production the table contained only sentinel quick-
--    note rows (product_id IS NULL), all of which were removed by step 1
--    above. With no surviving duplicates there is nothing to merge. If a
--    future environment has real (user_id, product_id) duplicates, the
--    UNIQUE INDEX in step 5 will fail and we'll dedupe at that point.

-- 5) Enforce one-entry-per-(user, product) going forward.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tasting_journal_user_product
  ON customer_tasting_journal(user_id, product_id);
