-- Parent history probes each mutation's records. The entity index begins with
-- account_id and otherwise scans that entire account for EVERY mutation.
CREATE INDEX idx_curate_mutation_records_history
  ON curate_mutation_records(account_id, mutation_id);
-- Resolving undo must also probe the original mutation, not scan all account
-- mutations once for every history result. No history rows or guards change.
CREATE INDEX idx_curate_mutations_undo
  ON curate_mutations(account_id, undo_of, confirmed_at DESC);
