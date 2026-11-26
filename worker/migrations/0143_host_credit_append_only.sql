CREATE TRIGGER IF NOT EXISTS host_credit_entries_immutable_update
BEFORE UPDATE ON host_credit_entries
BEGIN
  SELECT RAISE(ABORT, 'Host credit entries are append-only');
END;

CREATE TRIGGER IF NOT EXISTS host_credit_entries_immutable_delete
BEFORE DELETE ON host_credit_entries
BEGIN
  SELECT RAISE(ABORT, 'Host credit entries are append-only');
END;
