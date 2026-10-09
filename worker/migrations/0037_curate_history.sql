-- Correcting a Curate record never destroys its provenance or physical holdings.
ALTER TABLE tea_compass_entries ADD COLUMN archived_at TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN merged_into_id TEXT;
ALTER TABLE customers ADD COLUMN archived_at TEXT;
ALTER TABLE customers ADD COLUMN deleted_at TEXT;
ALTER TABLE customers ADD COLUMN merged_into_id TEXT;
ALTER TABLE curate_todos ADD COLUMN deleted_at TEXT;
ALTER TABLE tea_samples ADD COLUMN archived_at TEXT;
-- Existing balances remain reported; new unmeasured bridge requests name 0.
ALTER TABLE tea_samples ADD COLUMN grams_known INTEGER NOT NULL DEFAULT 1 CHECK (grams_known IN (0,1));
CREATE TABLE curate_mutations (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, command_type TEXT NOT NULL,
 actor_user_id TEXT NOT NULL, actor_token_id TEXT, agent_name TEXT,
 confirmed_at TEXT NOT NULL, undo_of TEXT, idempotency_key TEXT NOT NULL,
 guards_json TEXT NOT NULL DEFAULT '[]',
 UNIQUE(account_id, idempotency_key)
);
CREATE TABLE curate_mutation_records (
 mutation_id TEXT NOT NULL REFERENCES curate_mutations(id), account_id TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 before_json TEXT NOT NULL, after_json TEXT NOT NULL,
 PRIMARY KEY(mutation_id, entity_type, entity_id)
);
CREATE INDEX idx_curate_mutations_history ON curate_mutations(account_id, confirmed_at DESC);
CREATE INDEX idx_curate_mutation_records_entity ON curate_mutation_records(account_id, entity_type, entity_id);
