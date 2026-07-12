-- One physical Inventory identity per account-scoped Curate encounter.
--
-- Historical promotion was not concurrency-safe, so some databases may have
-- more than one product carrying the same source encounter. Preserve every
-- product and all stock. First repair the Compass link to one deterministic
-- canonical product (prefer its valid current link; otherwise oldest/id), then
-- detach only the duplicate identity markers before adding the unique index.

UPDATE tea_compass_entries AS entry
SET draft_product_id = COALESCE(
  CASE WHEN EXISTS (
    SELECT 1 FROM products AS linked
    WHERE linked.id = entry.draft_product_id
      AND linked.account_id = entry.account_id
      AND linked.source_compass_entry_id = entry.id
  ) THEN entry.draft_product_id END,
  (
    SELECT candidate.id FROM products AS candidate
    WHERE candidate.account_id = entry.account_id
      AND candidate.source_compass_entry_id = entry.id
    ORDER BY COALESCE(candidate.created_at, '') ASC, candidate.id ASC
    LIMIT 1
  )
)
WHERE EXISTS (
  SELECT 1 FROM products AS source
  WHERE source.account_id = entry.account_id
    AND source.source_compass_entry_id = entry.id
);

UPDATE products AS duplicate
SET source_compass_entry_id = NULL
WHERE duplicate.source_compass_entry_id IS NOT NULL
  AND duplicate.id <> COALESCE(
    (
      SELECT entry.draft_product_id FROM tea_compass_entries AS entry
      WHERE entry.account_id = duplicate.account_id
        AND entry.id = duplicate.source_compass_entry_id
        AND EXISTS (
          SELECT 1 FROM products AS linked
          WHERE linked.id = entry.draft_product_id
            AND linked.account_id = entry.account_id
            AND linked.source_compass_entry_id = entry.id
        )
      LIMIT 1
    ),
    (
      SELECT canonical.id FROM products AS canonical
      WHERE canonical.account_id = duplicate.account_id
        AND canonical.source_compass_entry_id = duplicate.source_compass_entry_id
      ORDER BY COALESCE(canonical.created_at, '') ASC, canonical.id ASC
      LIMIT 1
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_account_compass_identity
  ON products(account_id, source_compass_entry_id)
  WHERE source_compass_entry_id IS NOT NULL;
