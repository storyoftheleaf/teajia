-- Launch 3, slice J9: the waiting list and a released seat
-- (todo/plans/guests-and-tea-masters.md). A column and one table only; no
-- existing row is touched.

-- When a guest's offer of a freed seat ran out unclaimed. The next guest is
-- offered the seat, and a guest whose offer lapsed is not offered again by
-- itself: the host can still say yes to them.
ALTER TABLE event_attendees ADD COLUMN offer_lapsed_at TEXT;

-- What happened to a seat, for the host to read on their table page or in
-- Manage. An in-app list only: nothing here is ever sent to anyone.
CREATE TABLE IF NOT EXISTS event_seat_notices (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  attendee_id TEXT,
  kind        TEXT NOT NULL CHECK (kind IN ('cancelled','released','offered','offer_lapsed','claimed')),
  seats       INTEGER NOT NULL DEFAULT 0 CHECK (seats >= 0),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_seat_notices_event ON event_seat_notices(event_id, account_id, created_at);
