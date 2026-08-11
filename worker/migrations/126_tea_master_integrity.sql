-- Close the Tea Master review boundary and add an immutable, redacted audit
-- trail for changes to public payment destinations.

ALTER TABLE contributor_profile_drafts ADD COLUMN reviewer_note TEXT
  CHECK (reviewer_note IS NULL OR length(reviewer_note) <= 1000);

CREATE TABLE IF NOT EXISTS payment_method_audit_events (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  payment_method_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('created','updated','deleted')),
  changed_fields TEXT NOT NULL DEFAULT '[]',
  redacted_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_method_audit_contributor
  ON payment_method_audit_events(contributor_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS payment_method_audit_events_immutable_update
BEFORE UPDATE ON payment_method_audit_events
BEGIN
  SELECT RAISE(ABORT, 'payment audit events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS payment_method_audit_events_immutable_delete
BEFORE DELETE ON payment_method_audit_events
BEGIN
  SELECT RAISE(ABORT, 'payment audit events are immutable');
END;
