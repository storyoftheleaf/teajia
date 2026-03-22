-- Add in_transit flag: stock exists but hasn't arrived yet
ALTER TABLE products ADD COLUMN in_transit INTEGER DEFAULT 0;
