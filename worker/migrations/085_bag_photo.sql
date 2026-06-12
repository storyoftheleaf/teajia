-- 085: dedicated bag photo slot on products.
-- The capture-time bag shot keeps its own column so later product photo
-- edits (image_url / additional_images) never displace it. It can be
-- replaced deliberately, but nothing overwrites it as a side effect.

ALTER TABLE products ADD COLUMN bag_photo_url TEXT;

-- Backfill: products promoted from the Compass inherit the first capture
-- photo, which was the bag shot at promote time.
UPDATE products
SET bag_photo_url = (
  SELECT json_extract(e.photos, '$[0]')
  FROM tea_compass_entries e
  WHERE e.id = products.source_compass_entry_id
)
WHERE source_compass_entry_id IS NOT NULL
  AND bag_photo_url IS NULL;
