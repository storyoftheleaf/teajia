-- Events (with custom slug for pretty URLs)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  flyer_image_url TEXT,
  event_date TEXT NOT NULL,
  event_end_date TEXT,
  location_name TEXT,
  address_text TEXT,
  map_link TEXT,
  guidelines_text TEXT,
  venue_guide TEXT,
  total_capacity INTEGER NOT NULL DEFAULT 12,
  claim_window_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'Asia/Taipei',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed', 'archived')),
  session_flow TEXT,
  playlist_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_attendees (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  plus_one INTEGER DEFAULT 0,
  plus_one_name TEXT,
  access_tier TEXT DEFAULT 'standard' CHECK(access_tier IN ('standard', 'golden')),
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
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
  UNIQUE(event_id, phone_number)
);

CREATE TABLE IF NOT EXISTS event_tea_menu (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  product_id TEXT REFERENCES products(id),
  custom_name TEXT,
  custom_description TEXT,
  reveal_date TEXT,
  brew_order INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_tasting_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  tea_menu_id TEXT REFERENCES event_tea_menu(id),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  impression TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_post_session (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT UNIQUE NOT NULL REFERENCES events(id),
  tea_ledger TEXT,
  playlist_url TEXT,
  gallery_images TEXT,
  session_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT REFERENCES event_attendees(id),
  type TEXT NOT NULL CHECK(type IN ('checkin_reminder', 'waitlist_promotion', 'spot_claimed', 'event_update')),
  message_template TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_token ON event_attendees(magic_token);
CREATE INDEX IF NOT EXISTS idx_attendees_status ON event_attendees(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendees_phone ON event_attendees(event_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_tea_menu_event ON event_tea_menu(event_id);
CREATE INDEX IF NOT EXISTS idx_tasting_notes_event ON event_tasting_notes(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON event_notifications(event_id);
