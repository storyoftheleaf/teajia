-- Add contact type (customer vs supplier) and optional user account link
ALTER TABLE customers ADD COLUMN type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE customers ADD COLUMN user_id TEXT;
ALTER TABLE customers ADD COLUMN user_linked_at TEXT;
