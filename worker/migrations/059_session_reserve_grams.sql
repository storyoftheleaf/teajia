-- Add session_reserve_grams to products.
-- Frontend AddProductModal sends this field for tea products
-- (reserve quantity that should never drop below). Without the column,
-- product creation fails with "no column named session_reserve_grams".

ALTER TABLE products ADD COLUMN session_reserve_grams INTEGER;
