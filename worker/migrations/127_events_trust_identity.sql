-- Events Release 1: canonical lifecycle, party identity, public contributors,
-- operational team assignments, and attendee consent.
--
-- This migration is forward-only and additive. Legacy event `status` and
-- attendee columns remain in place while application consumers move to the
-- canonical model.

ALTER TABLE events ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(lifecycle_status IN ('draft','published','registration_closed','completed','cancelled','archived'));
ALTER TABLE events ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'public'
  CHECK(public_visibility IN ('public','unlisted','private'));
ALTER TABLE events ADD COLUMN network_discovery INTEGER NOT NULL DEFAULT 1
  CHECK(network_discovery IN (0, 1));
ALTER TABLE events ADD COLUMN recap_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(recap_status IN ('draft','published'));

ALTER TABLE event_attendees ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE event_attendees ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK(payment_status IN ('not_required','pending','paid','waived','refunded'));

UPDATE events
SET lifecycle_status = CASE status
  WHEN 'active' THEN 'published'
  WHEN 'closed' THEN 'registration_closed'
  WHEN 'archived' THEN 'archived'
  ELSE 'draft'
END;

-- Composite parent keys let every event-owned child enforce that its tenant
-- agrees with the referenced event and participation. The user/account index
-- mirrors the column order used by team assignments; account_members already
-- owns the reverse-order UNIQUE(account_id, user_id) business key.
CREATE UNIQUE INDEX uniq_events_id_account
  ON events(id, account_id);
CREATE UNIQUE INDEX uniq_event_attendees_id_event_account
  ON event_attendees(id, event_id, account_id);
CREATE UNIQUE INDEX uniq_account_members_user_account
  ON account_members(user_id, account_id);

CREATE TABLE event_party_members (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  event_id TEXT NOT NULL,
  participation_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  customer_id TEXT REFERENCES customers(id),
  full_name TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0, 1)),
  invitation_id TEXT,
  seat_status TEXT NOT NULL
    CHECK(seat_status IN ('requested','held','confirmed','cancelled','expired')),
  attendance_status TEXT
    CHECK(attendance_status IN ('checked_in','attended','no_show')),
  checked_in_at TEXT,
  attended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id, account_id)
    REFERENCES events(id, account_id),
  FOREIGN KEY(participation_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id)
);

INSERT INTO event_party_members (
  id,
  account_id,
  event_id,
  participation_id,
  user_id,
  customer_id,
  full_name,
  is_primary,
  seat_status
)
SELECT
  'primary-' || attendee.id,
  event.account_id,
  attendee.event_id,
  attendee.id,
  attendee.user_id,
  attendee.customer_id,
  attendee.full_name,
  1,
  CASE attendee.status
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'requested'
  END
FROM event_attendees AS attendee
JOIN events AS event ON event.id = attendee.event_id;

CREATE TABLE event_contributors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  event_id TEXT NOT NULL,
  contributor_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK(role IN ('lead_host','co_host','guest_host','photographer','author')),
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, contributor_id, role),
  FOREIGN KEY(event_id, account_id)
    REFERENCES events(id, account_id),
  FOREIGN KEY(contributor_id, account_id)
    REFERENCES contributor_accounts(contributor_id, account_id)
);

CREATE TABLE event_team_assignments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK(role IN ('coordinator','service','assistant','inventory','communications','photographer')),
  UNIQUE(event_id, user_id, role),
  FOREIGN KEY(event_id, account_id)
    REFERENCES events(id, account_id),
  FOREIGN KEY(user_id, account_id)
    REFERENCES account_members(user_id, account_id)
);

CREATE TABLE event_consents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  photography INTEGER NOT NULL DEFAULT 0 CHECK(photography IN (0, 1)),
  public_quote INTEGER NOT NULL DEFAULT 0 CHECK(public_quote IN (0, 1)),
  review_publication INTEGER NOT NULL DEFAULT 0 CHECK(review_publication IN (0, 1)),
  contact_exchange INTEGER NOT NULL DEFAULT 0 CHECK(contact_exchange IN (0, 1)),
  operational_messages INTEGER NOT NULL DEFAULT 1 CHECK(operational_messages IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, attendee_id),
  FOREIGN KEY(event_id, account_id)
    REFERENCES events(id, account_id),
  FOREIGN KEY(attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id)
);

CREATE INDEX idx_events_account_lifecycle_date
  ON events(account_id, lifecycle_status, event_date);
CREATE INDEX idx_event_party_members_event_seat
  ON event_party_members(event_id, seat_status);
CREATE UNIQUE INDEX uniq_event_party_members_primary
  ON event_party_members(participation_id)
  WHERE is_primary = 1;
CREATE INDEX idx_event_contributors_event_order
  ON event_contributors(event_id, display_order);
CREATE INDEX idx_event_team_assignments_event_user
  ON event_team_assignments(event_id, user_id);
