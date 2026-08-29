-- Add in_transit_grams and in_transit_eta to products.
-- The frontend AddProductModal already sends these fields when "in transit"
-- is checked; without these columns the INSERT fails with
-- "no column named in_transit_grams". The base in_transit flag was added in
-- migration 009 (applied manually to remote D1).

ALTER TABLE products ADD COLUMN in_transit_grams INTEGER;
ALTER TABLE products ADD COLUMN in_transit_eta TEXT;
