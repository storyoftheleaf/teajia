-- Parent history probes each mutation's records. The entity index begins with
-- account_id and otherwise scans that entire account for EVERY mutation.
CREATE INDEX idx_curate_mutation_records_history
  ON curate_mutation_records(account_id, mutation_id);
-- Resolving undo must also probe the original mutation, not scan all account
-- mutations once for every history result. No history rows or guards change.
CREATE INDEX idx_curate_mutations_undo
  ON curate_mutations(account_id, undo_of, confirmed_at DESC);
-- Named-tea history follows indexed before/after parents, including moved
-- children, rather than parsing every unrelated record in the account.
CREATE INDEX idx_curate_records_tea_before
  ON curate_mutation_records(account_id, json_extract(before_json, '$.compass_entry_id'));
CREATE INDEX idx_curate_records_tea_after
  ON curate_mutation_records(account_id, json_extract(after_json, '$.compass_entry_id'));
