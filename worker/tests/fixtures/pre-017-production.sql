-- Production-shaped schema immediately before migration 017.
-- Includes the co-tasting and inquiry tables that existed via ad-hoc deployment.
-- Teajia D1 Schema (SQLite)
-- Converted from Postgres db_setup.sql

-- TODO: Migrate existing Matcha and Flower products to Herbal
-- UPDATE products SET type = 'Herbal' WHERE type IN ('Matcha', 'Flower');

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    form TEXT,
    given_name TEXT,
    chinese_name TEXT,
    product_name TEXT NOT NULL,
    year TEXT,
    origin_country TEXT,
    origin_region TEXT,
    description TEXT,
    tasting_notes TEXT DEFAULT '[]', -- JSON array stored as text
    image_url TEXT,
    status TEXT DEFAULT 'Active',
    vendor TEXT,
    stock_grams INTEGER DEFAULT 0,
    cost_amount REAL DEFAULT 0,
    cost_currency TEXT DEFAULT 'USD',
    shipping_rate_per_kg REAL DEFAULT 0,
    quantity_purchased INTEGER,
    low_stock_threshold INTEGER DEFAULT 100,
    recheck_stock INTEGER DEFAULT 0,
    markup_multiplier REAL DEFAULT 2.5,
    fixed_retail_price_usd REAL,
    is_personal INTEGER DEFAULT 0,
    can_reorder INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    is_curated INTEGER DEFAULT 0,
    lore TEXT,
    is_custom_wisdom INTEGER DEFAULT 0,
    show_wisdom INTEGER DEFAULT 1,
    processing_notes TEXT,
    terroir TEXT,
    mood TEXT,
    experience TEXT,
    material TEXT,           -- Teaware: e.g. "Yixing clay", "porcelain", "silver"
    capacity_ml INTEGER,     -- Teaware: vessel capacity in ml
    teaware_category TEXT,   -- Teaware: "pot" | "cup" | "tray" | "storage" | "accessory" | "decorative"
    additional_images TEXT DEFAULT '[]', -- JSON array of extra image URLs
    quantity_units INTEGER,  -- Teaware: count of items (instead of grams)
    vendor_id TEXT,                -- FK to customers table (vendor contact)
    is_sample INTEGER DEFAULT 0,                    -- Sample/trial tea not yet committed to inventory
    in_transit INTEGER DEFAULT 0,                   -- Stock ordered but not yet physically arrived
    tasting TEXT DEFAULT '{}',                    -- Structured tasting taxonomy JSON
    sold_out_at TEXT,                             -- When product auto-archived due to zero stock
    stock_verified_at TEXT,                        -- Last time stock was physically verified
    source_compass_entry_id TEXT,                  -- FK to tea_compass_entries(id) — which field note sourced this product
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),  -- Tracks admin edits for smart export
    last_synced_at TEXT                         -- Last time markdown sync touched this row
);

-- 1b. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    preferred_currency TEXT DEFAULT 'USD',
    tags TEXT DEFAULT '[]',        -- JSON array e.g. ["wholesale","vendor","vip"]
    notes TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT PRIMARY KEY,
    rate_to_usd REAL NOT NULL,
    last_updated TEXT DEFAULT (datetime('now'))
);

-- Insert Default Rates
INSERT OR IGNORE INTO exchange_rates (currency, rate_to_usd) VALUES
('USD', 1.0),
('NT', 32.3),
('Yuan', 7.2),
('IDR', 16210),
('JPY', 150.0),
('MYR', 4.7),
('HKD', 7.8);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_number TEXT NOT NULL,
    customer_name TEXT,
    customer_whatsapp TEXT,
    customer_id TEXT,              -- FK to customers table
    display_currency TEXT,
    shipping_cost_usd REAL DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    inventory_deducted INTEGER DEFAULT 0,
    deleted_at TEXT,                          -- Soft-delete timestamp
    notes TEXT,                              -- Free-text notes on the invoice
    source_event_id TEXT,                    -- FK to events table (sale attributed to an event)
    created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Invoice Line Items Table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_id TEXT REFERENCES invoices(id),
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL
);

-- 5. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',  -- 'owner', 'admin', 'user'
    admin_request_status TEXT NOT NULL DEFAULT 'none',  -- 'none', 'pending', 'approved', 'denied'
    admin_requested_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 5b. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 6. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_email TEXT,
    action TEXT,
    details TEXT,
    entity_type TEXT,             -- product, invoice, customer, etc.
    entity_id TEXT,               -- ID of affected entity
    created_at TEXT DEFAULT (datetime('now'))
);

-- 6b. Stock Ledger Table (audit trail for stock changes)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    product_id TEXT NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL,           -- Change amount (+100, -50, etc.)
    balance_after INTEGER NOT NULL,   -- Stock after the change
    reason TEXT NOT NULL,             -- MANUAL_ADJUST, FULFILLMENT, VOID, MANUAL_INCREMENT
    source_invoice_id TEXT,           -- FK to invoices (if change was from invoice)
    source_invoice_number TEXT,       -- Denormalized for easy display
    user_email TEXT,
    note TEXT,                        -- Human-readable description
    created_at TEXT DEFAULT (datetime('now'))
);

-- 7. Teaware Collection Table (personal collection, organised by category)
CREATE TABLE IF NOT EXISTS teaware_collection (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    chinese_name TEXT,
    category TEXT NOT NULL,          -- pot, cup, gaiwan, tray, storage, accessory, decorative, chaxi
    material TEXT,                   -- Yixing clay, porcelain, silver, bamboo, glass, etc.
    capacity_ml INTEGER,
    origin TEXT,                     -- Where it's from (region/country)
    artist TEXT,                     -- Artisan or maker
    year_acquired TEXT,
    purchase_price REAL,
    purchase_currency TEXT DEFAULT 'USD',
    description TEXT,
    condition TEXT DEFAULT 'excellent',  -- excellent, good, fair, worn
    is_favorite INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 8. Teaware Photos Table (multiple photos per collection item)
CREATE TABLE IF NOT EXISTS teaware_photos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    teaware_id TEXT NOT NULL REFERENCES teaware_collection(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teaware_collection_category ON teaware_collection(category);
CREATE INDEX IF NOT EXISTS idx_teaware_photos_teaware_id ON teaware_photos(teaware_id);

-- 9. Tea Compass Entries (localStorage-first, synced to D1)
CREATE TABLE IF NOT EXISTS tea_compass_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT,
  chinese_name TEXT,
  type TEXT,
  form TEXT,
  year INTEGER,
  season TEXT,
  storage TEXT,
  origin_region TEXT,
  price_amount REAL,
  price_currency TEXT DEFAULT 'NT',
  price_per_unit_grams REAL,
  category TEXT DEFAULT 'tea',
  teaware_category TEXT,
  material TEXT,
  capacity_ml INTEGER,
  quantity INTEGER DEFAULT 1,
  era TEXT,
  vendor_id TEXT,
  vendor_name TEXT,
  notes TEXT,
  tasting TEXT,
  photos TEXT,
  audio_clips TEXT,
  status TEXT DEFAULT 'logged',
  buy_quantity_grams REAL,
  buy_quantity_units INTEGER,
  buy_total REAL,
  draft_product_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compass_user_id ON tea_compass_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_compass_status ON tea_compass_entries(status);

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

-- Event System V2: Approval flow, briefing cards, guest invites, journey support
-- This migration adds columns to existing tables and creates new tables.
-- D1 doesn't support ALTER TABLE ADD COLUMN with CHECK constraints,
-- so we use simple TEXT columns and enforce constraints in application code.

-- ============================================================
-- events table additions
-- ============================================================
ALTER TABLE events ADD COLUMN briefing_cards TEXT;          -- JSON: BriefingCard[]
ALTER TABLE events ADD COLUMN interested_list TEXT;         -- JSON: [{phone, name, email, created_at}]
ALTER TABLE events ADD COLUMN area_hint TEXT;               -- General area shown before approval
ALTER TABLE events ADD COLUMN mood_hints TEXT;              -- JSON: string[] (pre-session mood hints)

-- ============================================================
-- event_attendees table additions
-- ============================================================
-- Guest requests replaces plus_one integer with richer model
ALTER TABLE event_attendees ADD COLUMN guest_requests TEXT;        -- JSON: GuestRequest[]
ALTER TABLE event_attendees ADD COLUMN first_visit_briefed INTEGER DEFAULT 0;
ALTER TABLE event_attendees ADD COLUMN cancellation_note TEXT;
ALTER TABLE event_attendees ADD COLUMN source TEXT DEFAULT 'direct';       -- direct | waitlist_notify | public_page | guest_invite
ALTER TABLE event_attendees ADD COLUMN contact_method TEXT DEFAULT 'whatsapp';  -- whatsapp | email
ALTER TABLE event_attendees ADD COLUMN denial_message TEXT;

-- D1 doesn't support ALTER CHECK constraint, so we handle 'requested'/'denied' status in app code.
-- The existing CHECK is: status IN ('confirmed', 'waitlist', 'cancelled')
-- We need to recreate the table or handle this in application logic.
-- For safety, we'll handle validation in the Worker code and accept that
-- D1 will allow the new values since CHECK constraints are not strictly enforced in all SQLite modes.

-- ============================================================
-- event_post_session table additions
-- ============================================================
ALTER TABLE event_post_session ADD COLUMN host_notes TEXT;
ALTER TABLE event_post_session ADD COLUMN energy TEXT;           -- intimate_warm | lively | contemplative | etc
ALTER TABLE event_post_session ADD COLUMN host_changes TEXT;

-- ============================================================
-- customers table additions (for quiet accounts + journey)
-- ============================================================
ALTER TABLE customers ADD COLUMN contact_preference TEXT DEFAULT 'whatsapp';
ALTER TABLE customers ADD COLUMN notification_prefs TEXT DEFAULT '["sessions"]';
ALTER TABLE customers ADD COLUMN tea_preferences TEXT DEFAULT '[]';
ALTER TABLE customers ADD COLUMN verification_code TEXT;
ALTER TABLE customers ADD COLUMN verification_expires TEXT;

-- ============================================================
-- guest_invites table (new) — single-use invite links for +guests
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  parent_attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  invite_token TEXT UNIQUE NOT NULL,
  name_hint TEXT,                    -- "my partner", "a friend new to tea"
  claimed_by_name TEXT,
  claimed_by_phone TEXT,
  claimed_by_email TEXT,
  claimed_attendee_id TEXT REFERENCES event_attendees(id),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired')),
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_guest_invites_event ON guest_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_invites_token ON guest_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_guest_invites_parent ON guest_invites(parent_attendee_id);

-- ============================================================
-- interest_signups table (new) — "notify me of next session"
-- ============================================================
CREATE TABLE IF NOT EXISTS interest_signups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT REFERENCES events(id),     -- the event they saw (optional, could be general interest)
  customer_id TEXT REFERENCES customers(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interest_event ON interest_signups(event_id);

-- Saved locations (reusable venues for events)
CREATE TABLE IF NOT EXISTS saved_locations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  map_link TEXT,
  guidelines TEXT,
  venue_guide TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add location_id FK to events table
ALTER TABLE events ADD COLUMN location_id TEXT REFERENCES saved_locations(id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_name ON saved_locations(name);

-- 063: Create the four core co-tasting tables.
--
-- Why this migration exists this late: the co-tasting feature was built and
-- shipped without a migration that actually defines the tables it uses. The
-- tables existed on the original development DB via ad-hoc seeds, but new
-- environments (and the live remote D1, until 2026-05-04) had handler code
-- referencing tables that didn't exist.
--
-- This is a recovery migration: idempotent CREATE TABLE IF NOT EXISTS so it
-- safely runs on environments that already have the tables (via seed) and
-- creates them fresh on environments that don't.
--
-- These four tables are the foundation for every other tasting-related
-- migration (058 / 060 / 061 reference them).

CREATE TABLE IF NOT EXISTS tasting_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invite_token TEXT UNIQUE,
  max_participants INTEGER NOT NULL DEFAULT 8,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_account ON tasting_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_status ON tasting_sessions(status);

CREATE TABLE IF NOT EXISTS tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  compass_entry_id TEXT,
  tea_name TEXT,
  tea_key TEXT,
  tea_metadata TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_session_teas_session ON tasting_session_teas(session_id);

CREATE TABLE IF NOT EXISTS tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_session_members_session ON tasting_session_members(session_id);

CREATE TABLE IF NOT EXISTS tasting_session_verdicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  session_tea_id TEXT NOT NULL REFERENCES tasting_session_teas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  verdict TEXT,
  tasting_data TEXT,
  notes TEXT,
  submitted_at TEXT NOT NULL,
  UNIQUE(session_tea_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_session_verdicts_session ON tasting_session_verdicts(session_id);

CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
