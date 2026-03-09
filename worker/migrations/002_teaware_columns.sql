-- Add teaware-specific columns to products table
ALTER TABLE products ADD COLUMN material TEXT;
ALTER TABLE products ADD COLUMN capacity_ml INTEGER;
ALTER TABLE products ADD COLUMN teaware_category TEXT;
ALTER TABLE products ADD COLUMN quantity_units INTEGER;
