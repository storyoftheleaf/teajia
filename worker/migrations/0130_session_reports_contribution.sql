-- Launch 3, the part that can start before Launch 2 (todo/plans/guests-and-tea-masters-launch-3-run.md).
-- Columns and one table only; no existing row is touched.

-- Free, by contribution, or a price paid to the host: wording only, money never moves through Teajia (J11).
ALTER TABLE events ADD COLUMN contribution_kind TEXT CHECK (contribution_kind IN ('free','contribution','price'));
ALTER TABLE events ADD COLUMN contribution_note TEXT CHECK (contribution_note IS NULL OR length(contribution_note) <= 140);

-- The host says a session is a tasting; only then are guests offered a screen per tea (J8).
-- Separate from event_format, so turning it off loses nothing.
ALTER TABLE events ADD COLUMN is_tasting INTEGER NOT NULL DEFAULT 0 CHECK (is_tasting IN (0,1));

-- Reports on a session or a person, reviewed by the platform owner (J5).
CREATE TABLE IF NOT EXISTS session_reports (
  id               TEXT PRIMARY KEY,
  target_kind      TEXT NOT NULL CHECK (target_kind IN ('session','person')),
  target_id        TEXT NOT NULL,
  reason           TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
  reporter_user_id TEXT REFERENCES users(id),
  reporter_seat_id TEXT,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acted','dismissed')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  resolved_by      TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_session_reports_open ON session_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_session_reports_target ON session_reports(target_kind, target_id);

-- The session gallery (J7): the taker chooses, when offering a photograph, whether
-- their first name is shown beside it. Not shown unless they say so.
ALTER TABLE session_guest_book_photos ADD COLUMN show_name INTEGER NOT NULL DEFAULT 0 CHECK (show_name IN (0, 1));
