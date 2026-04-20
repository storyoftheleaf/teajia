-- Feature 28: Vendor → customer record link on compass entries
ALTER TABLE tea_compass_entries ADD COLUMN linked_customer_id TEXT REFERENCES customers(id);
