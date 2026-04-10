-- Remap legacy status values in tea_compass_entries to new vocabulary
UPDATE tea_compass_entries SET status = 'noted'    WHERE status = 'logged';
UPDATE tea_compass_entries SET status = 'in_stock' WHERE status = 'bought';

-- Indexes for filter queries on the new status values
CREATE INDEX IF NOT EXISTS idx_compass_entries_status ON tea_compass_entries(status);
CREATE INDEX IF NOT EXISTS idx_compass_entries_account_status ON tea_compass_entries(account_id, status);
