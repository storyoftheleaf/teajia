-- Launch 2, a few hosts (todo/plans/guests-and-tea-masters-launch-2-run.md, slice H1).
-- Columns and one new table only. No existing row is changed.

-- Host approval, given by Adrian by hand, kept on the person (so it can be
-- given before they open anything) and copied onto their personal account,
-- the same way seller approval is (0120, 0121).
ALTER TABLE users    ADD COLUMN host_approved_at TEXT;
ALTER TABLE users    ADD COLUMN host_approved_by TEXT REFERENCES users(id);
ALTER TABLE accounts ADD COLUMN host_approved_at TEXT;
ALTER TABLE accounts ADD COLUMN host_approved_by TEXT REFERENCES users(id);

-- Every hosted table names its host, even when the host has no public page.
ALTER TABLE events ADD COLUMN host_user_id TEXT REFERENCES users(id);
-- How a guest takes a seat. NULL is an older session, read from
-- requires_approval as before. 'open' is allowed here because a check cannot
-- be widened later without rebuilding the table; every route refuses it
-- until Launch 3.
ALTER TABLE events ADD COLUMN door TEXT CHECK (door IN ('request','link','open'));

-- The host's private line about each guest. Read by that host only.
CREATE TABLE IF NOT EXISTS host_guest_notes (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  attendee_id  TEXT NOT NULL,
  note         TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 500),
  updated_at   TEXT NOT NULL,
  UNIQUE (host_user_id, event_id, attendee_id)
);
