-- Links a person's private Tea Chest to a regular Stock and Sales account.
-- Existing accounts and holdings keep their current ownership.
ALTER TABLE accounts ADD COLUMN personal_inventory_user_id TEXT REFERENCES users(id);
CREATE UNIQUE INDEX idx_accounts_personal_inventory_user ON accounts(personal_inventory_user_id);
