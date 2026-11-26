-- Launch 3, anyone can host (todo/plans/guests-and-tea-masters-launch-3-run.md, slice J1).
-- Columns only. No existing row is changed.

-- Adrian stops one host by hand: no new table and no new seat. Guests already
-- confirmed keep what they had. Never shown to a guest. NULL is not stopped.
ALTER TABLE users ADD COLUMN hosting_stopped_at TEXT;
ALTER TABLE users ADD COLUMN hosting_stopped_by TEXT REFERENCES users(id);

-- How widely a host's sessions may be found, set only by Adrian in Manage and
-- read only by the server (slice J10). NULL reads as 'invitation': found only
-- by their link.
ALTER TABLE users ADD COLUMN host_reach TEXT CHECK (host_reach IN ('invitation','teajia','listed'));
