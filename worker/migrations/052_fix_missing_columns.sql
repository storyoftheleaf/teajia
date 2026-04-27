-- 052_fix_missing_columns.sql
-- Reconciles two columns referenced by worker handlers but missing on remote D1.
-- Both are additive and nullable.

-- handleGetNotes (worker/src/index.ts) filters on `deleted IS NULL OR deleted = 0`.
ALTER TABLE notes ADD COLUMN deleted INTEGER DEFAULT 0;

-- handleSyncCompassEntries inserts `linked_customer_id`.
ALTER TABLE tea_compass_entries ADD COLUMN linked_customer_id TEXT;
