-- Recreate event_attendees to expand the status CHECK constraint.
-- The approval flow needs 'requested' and 'denied' but the original
-- table only allowed 'confirmed', 'waitlist', 'cancelled'.
-- SQLite cannot ALTER a CHECK constraint, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE event_attendees_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),
  full_name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  plus_one INTEGER DEFAULT 0,
  plus_one_name TEXT,
  access_tier TEXT DEFAULT 'standard' CHECK(access_tier IN ('standard', 'golden')),
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'waitlist', 'cancelled', 'requested', 'denied')),
  magic_token TEXT UNIQUE NOT NULL,
  photo_consent INTEGER DEFAULT 0,
  notes TEXT,
  tea_preference TEXT,
  bringing_tea TEXT,
  waitlist_position INTEGER,
  claimed_at TEXT,
  claim_expires_at TEXT,
  attended INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  guest_requests TEXT,
  first_visit_briefed INTEGER DEFAULT 0,
  cancellation_note TEXT,
  source TEXT DEFAULT 'direct',
  contact_method TEXT DEFAULT 'whatsapp',
  denial_message TEXT,
  account_id TEXT,
  UNIQUE(event_id, phone_number)
);

INSERT INTO event_attendees_new SELECT
  id, event_id, customer_id, full_name, phone_number, email,
  plus_one, plus_one_name, access_tier, status, magic_token,
  photo_consent, notes, tea_preference, bringing_tea,
  waitlist_position, claimed_at, claim_expires_at, attended, created_at,
  guest_requests, first_visit_briefed, cancellation_note, source,
  contact_method, denial_message, account_id
FROM event_attendees;

DROP TABLE event_attendees;

ALTER TABLE event_attendees_new RENAME TO event_attendees;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_token ON event_attendees(magic_token);
CREATE INDEX IF NOT EXISTS idx_attendees_status ON event_attendees(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendees_phone ON event_attendees(event_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON event_notifications(event_id);
