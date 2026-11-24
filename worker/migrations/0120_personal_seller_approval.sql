-- Only people Adrian approves may sell from their own Tea Chest. The mark
-- sits on the personal account and starts empty, so nobody is approved by
-- this migration. Withdrawing approval clears it; stock and records stay.
ALTER TABLE accounts ADD COLUMN personal_seller_approved_at TEXT;
ALTER TABLE accounts ADD COLUMN personal_seller_approved_by TEXT REFERENCES users(id);
