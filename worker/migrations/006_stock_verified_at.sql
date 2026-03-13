-- Add stock_verified_at column to track inventory verification
ALTER TABLE products ADD COLUMN stock_verified_at TEXT DEFAULT NULL;
