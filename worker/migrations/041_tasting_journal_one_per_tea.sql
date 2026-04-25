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

-- 4) Dedupe: for any (user_id, product_id) with multiple rows, merge them.
--    Strategy: the oldest row wins as the canonical id. We append every
--    other row's tastings JSON into its tastings array (in chronological
--    order), keep the latest row's note as the synthesized note, and delete
--    the duplicates.
--
--    SQLite doesn't make this trivial with pure SQL, but we can do it in
--    two passes: build the merged tastings array via json_group_array over
--    the duplicates, write it onto the canonical row, then delete the rest.

-- 4a) Identify the canonical row id per (user_id, product_id) group.
CREATE TEMPORARY TABLE _ctj_canonical AS
  SELECT
    user_id,
    product_id,
    (SELECT id FROM customer_tasting_journal c2
       WHERE c2.user_id = c1.user_id AND c2.product_id = c1.product_id
       ORDER BY c2.created_at ASC, c2.id ASC LIMIT 1) AS canonical_id
  FROM customer_tasting_journal c1
  GROUP BY user_id, product_id
  HAVING COUNT(*) > 1;

-- 4b) For each canonical row, build the merged tastings array and the
--     latest-note string from across all duplicate rows.
UPDATE customer_tasting_journal AS target
SET
  tastings = (
    SELECT json_group_array(json_each.value)
    FROM customer_tasting_journal AS src,
         json_each(src.tastings)
    WHERE src.user_id = target.user_id
      AND src.product_id = target.product_id
    ORDER BY src.created_at ASC
  ),
  note = (
    SELECT note FROM customer_tasting_journal AS src
    WHERE src.user_id = target.user_id
      AND src.product_id = target.product_id
    ORDER BY src.created_at DESC LIMIT 1
  )
WHERE target.id IN (SELECT canonical_id FROM _ctj_canonical);

-- 4c) Delete the non-canonical duplicate rows.
DELETE FROM customer_tasting_journal
WHERE rowid IN (
  SELECT c.rowid FROM customer_tasting_journal c
  JOIN _ctj_canonical k ON c.user_id = k.user_id AND c.product_id = k.product_id
  WHERE c.id != k.canonical_id
);

DROP TABLE _ctj_canonical;

-- 5) Enforce one-entry-per-(user, product) going forward.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tasting_journal_user_product
  ON customer_tasting_journal(user_id, product_id);
