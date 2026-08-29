-- Teajia D1 baseline from live remote schema dump (2026-08-29)
-- tables -> indexes -> triggers, all IF NOT EXISTS

CREATE TABLE IF NOT EXISTS account_applications (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  applicant_email       TEXT NOT NULL,
  applicant_name        TEXT,
  proposed_account_kind TEXT NOT NULL,        
  note                  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
                                              
  decided_by_user_id    TEXT REFERENCES users(id),
  decided_at            TEXT,
  decision_note         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_features (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  enabled_by  TEXT REFERENCES users(id),
  enabled_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, feature)
);

CREATE TABLE IF NOT EXISTS account_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  invited_by_user_id TEXT,
  invited_at TEXT,
  joined_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active', permissions TEXT NOT NULL DEFAULT '{}',
  UNIQUE(account_id, user_id)
);

CREATE TABLE IF NOT EXISTS account_wholesale_overrides (
  profile_id          TEXT NOT NULL REFERENCES tea_profiles(id),
  buyer_account_id    TEXT NOT NULL REFERENCES accounts(id),
  margin_pct_override INTEGER NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, buyer_account_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  location_city TEXT,
  location_country TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency_default TEXT DEFAULT 'USD',
  whatsapp_number TEXT,
  contact_email TEXT,
  public_enabled INTEGER DEFAULT 1,
  public_shop_path TEXT,
  invoice_prefix TEXT,
  owner_user_id TEXT,
  status TEXT DEFAULT 'active',
  trust_tier TEXT DEFAULT 'basic',
  is_platform_owner INTEGER DEFAULT 0,
  ships_to_countries TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, invoice_seq INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'location', host_contributor_id TEXT, openai_api_key_encrypted TEXT, openai_api_key_last4 TEXT);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_email TEXT,
    action TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, entity_type TEXT, entity_id TEXT, account_id TEXT);

CREATE TABLE IF NOT EXISTS anonymous_verdicts (
  id TEXT PRIMARY KEY,
  browser_token TEXT NOT NULL,
  table_token TEXT NOT NULL,
  source_entry_id TEXT,
  verdict TEXT NOT NULL,
  notes TEXT,
  tasting_data TEXT,
  claimed_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_external_sources (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  content_hash TEXT NOT NULL,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS article_products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  article_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  title TEXT NOT NULL,
  subtitle TEXT,
  author_id TEXT,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  cover_image_url TEXT,
  blocks TEXT NOT NULL DEFAULT '[]',
  layout_template TEXT,
  reading_time_mins INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, subject_ids TEXT NOT NULL DEFAULT '[]', pull_quote TEXT, pull_quote_subject TEXT, source_event_id TEXT);

CREATE TABLE IF NOT EXISTS batches (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id  TEXT NOT NULL,
    label       TEXT NOT NULL,            -- e.g. "June 2026 order", "Personal aged stock"
    intake_date TEXT,                     -- the real-world acquisition date Adrian asserts (nullable)
    vendor      TEXT,                     -- optional sourcing label
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_items (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    item_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), recommended_quantity TEXT, recommended_price_usd REAL,
    UNIQUE (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS "collection_publications" (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL DEFAULT 'person' CHECK (target_type IN ('person','store','event','shop','tag')),
    target_id TEXT,
    slug TEXT NOT NULL UNIQUE,
    recipients_json TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    unpublished_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT,
    recipient_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT,
    hero_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
    created_by_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, curator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, curator_display_name TEXT, is_featured_collection INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS compass_shares (id TEXT PRIMARY KEY, source_entry_id TEXT NOT NULL, source_account_id TEXT NOT NULL, source_user_id TEXT NOT NULL, source_user_name TEXT, source_account_name TEXT, tea_key TEXT, shared_metadata TEXT, target_account_id TEXT, invite_token TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', claimed_by_user_id TEXT, claimed_at TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS connection_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  pending_share_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS contact_private_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, customer_id)
);

CREATE TABLE IF NOT EXISTS contact_relationships (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'buyer',
    'vendor',
    'event_guest',
    'collection_recipient',
    'contributor',
    'personal_connection'
  )),
  source TEXT NOT NULL DEFAULT 'manual',
  source_entity_type TEXT,
  source_entity_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, customer_id, kind)
);

CREATE TABLE IF NOT EXISTS contributor_accounts (
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_role TEXT,
  is_host INTEGER NOT NULL DEFAULT 0 CHECK (is_host IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (contributor_id, account_id)
);

CREATE TABLE IF NOT EXISTS contributor_profile_drafts (
  contributor_id TEXT PRIMARY KEY REFERENCES contributors(id) ON DELETE CASCADE,
  payload TEXT NOT NULL DEFAULT '{}',
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','changes_requested')),
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, reviewer_note TEXT
  CHECK (reviewer_note IS NULL OR length(reviewer_note) <= 1000));

CREATE TABLE IF NOT EXISTS contributor_user_link_conflicts (
  contributor_id TEXT PRIMARY KEY REFERENCES contributors(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  kept_contributor_id TEXT NOT NULL REFERENCES contributors(id),
  discovered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contributors (
  id                       TEXT PRIMARY KEY,        -- slug, e.g. "chen-wei"
  account_id               TEXT NOT NULL REFERENCES accounts(id),

  -- Optional links into other identity systems
  user_id                  TEXT REFERENCES users(id),
  face_of_account_id       TEXT REFERENCES accounts(id),

  -- Identity
  display_name             TEXT NOT NULL,
  chinese_name             TEXT,
  role                     TEXT,                    -- "Tea Master", "Host", "Writer", "Maker", freeform
  pronouns                 TEXT,
  location_line            TEXT,                    -- single italic line under the name; freeform
  active_since             TEXT,                    -- year, optional

  -- Editorial body (markdown, all optional except beginnings to publish)
  beginnings               TEXT,                    -- the Origin paragraph
  now_text                 TEXT,                    -- current preoccupation (column avoids `now` reserved usage)
  now_stamp                TEXT,                    -- contributor-written date phrase
  now_updated_at           TEXT,                    -- ISO datetime fallback for now_stamp
  inspirations             TEXT,
  closing                  TEXT,                    -- max 200 chars, freeform

  -- Media
  avatar_url               TEXT,
  portrait_url             TEXT,
  portrait_caption         TEXT,
  voice_clip_url           TEXT,
  voice_clip_caption       TEXT,

  -- Pouring today (single tea offering)
  pouring_today_product_id TEXT,                    -- references products(id) softly; product table predates FK conventions
  pouring_today_note       TEXT,

  -- Where to find them (only rendered when face_of_account_id is set)
  where_to_find_text       TEXT,

  -- Outbound links: JSON array of {label, url}
  links                    TEXT NOT NULL DEFAULT '[]',

  -- Visibility
  is_published             INTEGER NOT NULL DEFAULT 0,

  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
, contact_customer_id TEXT, languages TEXT NOT NULL DEFAULT '[]', unpublished_at TEXT);

CREATE TABLE IF NOT EXISTS curate_import_batches (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'reviewing', 'completed', 'abandoned')),
  journey_id TEXT,
  visit_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, client_idempotency_key TEXT, request_fingerprint TEXT, analysis_state TEXT NOT NULL DEFAULT 'not_started'
  CHECK (analysis_state IN ('not_started','analyzing','complete','failed')), analysis_overview TEXT, analysis_language TEXT, analysis_version INTEGER NOT NULL DEFAULT 0, analysis_model TEXT, analysis_error TEXT, analysis_attempt_token TEXT, finalize_idempotency_key TEXT, finalize_result_json TEXT, completed_at TEXT, analysis_annotations_json TEXT);

CREATE TABLE IF NOT EXISTS curate_import_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_id TEXT,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  category TEXT NOT NULL DEFAULT 'tea' CHECK (category IN ('tea', 'teaware')),
  name TEXT,
  raw_text TEXT,
  parsed_data_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  uncertainty_json TEXT NOT NULL DEFAULT '{}',
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'reviewing', 'accepted', 'merged', 'abandoned')),
  compass_entry_id TEXT,
  reserved_compass_entry_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), vendor_group_id TEXT REFERENCES curate_import_vendor_groups(id) ON DELETE SET NULL, manually_corrected_fields_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (batch_id) REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES curate_import_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS curate_import_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  vendor_group_id TEXT NOT NULL REFERENCES curate_import_vendor_groups(id) ON DELETE RESTRICT,
  inventory_receipt_id TEXT NOT NULL REFERENCES inventory_receipts(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, vendor_group_id),
  UNIQUE (account_id, inventory_receipt_id)
);

CREATE TABLE IF NOT EXISTS curate_import_sources (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wechat', 'invoice', 'vendor_list', 'photo', 'file', 'paste')),
  pasted_text TEXT,
  r2_object_key TEXT,
  client_evidence_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), client_idempotency_key TEXT, request_fingerprint TEXT, analysis_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (analysis_status IN ('pending','analyzed','reference_only','failed')), analysis_error TEXT, reference_metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (pasted_text IS NOT NULL OR r2_object_key IS NOT NULL),
  FOREIGN KEY (batch_id) REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  UNIQUE (account_id, batch_id, client_evidence_id)
);

CREATE TABLE IF NOT EXISTS curate_import_vendor_groups (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  group_key TEXT NOT NULL,
  proposed_vendor_name TEXT,
  resolved_vendor_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  vendor_confidence REAL CHECK (vendor_confidence IS NULL OR (vendor_confidence >= 0 AND vendor_confidence <= 1)),
  uncertainty_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, batch_id, group_key)
);

CREATE TABLE IF NOT EXISTS curate_journeys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  season TEXT,
  year INTEGER,
  started_at TEXT,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curate_receipt_proposals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  compass_entry_id TEXT REFERENCES tea_compass_entries(id) ON DELETE SET NULL,
  import_id TEXT REFERENCES curate_import_batches(id) ON DELETE SET NULL,
  import_item_id TEXT REFERENCES curate_import_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  product_name TEXT,
  product_type TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('working', 'sample', 'personal')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'unit')),
  acquisition_kind TEXT NOT NULL CHECK (acquisition_kind IN ('purchase', 'free_sample', 'gift', 'transfer', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  idempotency_key TEXT NOT NULL,
  ledger_id TEXT REFERENCES stock_ledger(id) ON DELETE SET NULL,
  proposed_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, idempotency_key),
  UNIQUE(ledger_id)
);

CREATE TABLE IF NOT EXISTS curate_visits (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  journey_id TEXT,
  vendor_id TEXT,
  vendor_name TEXT,
  place TEXT,
  visited_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (journey_id) REFERENCES curate_journeys(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_tags (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_tasting_journal (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  product_type TEXT,
  product_image TEXT,
  tasting TEXT DEFAULT '{}',
  personal_note TEXT,
  rating INTEGER,
  event_id TEXT,
  event_title TEXT,
  created_at TEXT DEFAULT (datetime('now'))
, source_type TEXT, note TEXT, tastings TEXT, archived INTEGER DEFAULT 0, session_id TEXT, session_title TEXT);

CREATE TABLE IF NOT EXISTS customer_tea_discovery (
  user_id          TEXT PRIMARY KEY,          
  account_id       TEXT,                       
  answers          TEXT NOT NULL DEFAULT '{}', 
  level            TEXT,                       
  disposition_id   TEXT,
  disposition_name TEXT,
  completed_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

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
    tags TEXT DEFAULT '[]',
    notes TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
, account_id TEXT, contact_preference TEXT DEFAULT 'whatsapp', notification_prefs TEXT DEFAULT '["sessions"]', tea_preferences TEXT DEFAULT '[]', verification_code TEXT, verification_expires TEXT, type TEXT NOT NULL DEFAULT 'customer', user_id TEXT, user_linked_at TEXT, contacts TEXT NOT NULL DEFAULT '[]', business_card_photo TEXT, storefront_photo TEXT, latitude REAL, longitude REAL, line TEXT);

CREATE TABLE IF NOT EXISTS d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "event_attendees" (
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
  account_id TEXT, user_id TEXT REFERENCES users(id), payment_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK(payment_status IN ('not_required','pending','paid','waived','refunded')),
  UNIQUE(event_id, phone_number)
);

CREATE TABLE IF NOT EXISTS event_consents (
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

CREATE TABLE IF NOT EXISTS event_contributors (
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

CREATE TABLE IF NOT EXISTS event_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT REFERENCES event_attendees(id),
  type TEXT NOT NULL CHECK(type IN ('checkin_reminder', 'waitlist_promotion', 'spot_claimed', 'event_update')),
  message_template TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
, account_id TEXT);

CREATE TABLE IF NOT EXISTS event_party_members (
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
    REFERENCES event_attendees(id, event_id, account_id),
  FOREIGN KEY(customer_id, account_id)
    REFERENCES customers(id, account_id)
);

CREATE TABLE IF NOT EXISTS event_post_session (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT UNIQUE NOT NULL REFERENCES events(id),
  tea_ledger TEXT,
  playlist_url TEXT,
  gallery_images TEXT,
  session_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
, account_id TEXT, host_notes TEXT, energy TEXT, host_changes TEXT, shared_tasting_notes TEXT);

CREATE TABLE IF NOT EXISTS event_tasting_note_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  original_note_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  original_account_id TEXT,
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  tea_menu_id TEXT,
  rating INTEGER,
  impression TEXT,
  is_favorite INTEGER,
  created_at TEXT,
  archive_reason TEXT NOT NULL
    CHECK(archive_reason IN ('superseded_during_migration_129')),
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id, account_id)
    REFERENCES events(id, account_id),
  FOREIGN KEY(attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id)
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
, account_id TEXT);

CREATE TABLE IF NOT EXISTS event_tea_menu (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  product_id TEXT REFERENCES products(id),
  custom_name TEXT,
  custom_description TEXT,
  reveal_date TEXT,
  brew_order INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
, account_id TEXT);

CREATE TABLE IF NOT EXISTS event_team_assignments (
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
, location_id TEXT REFERENCES saved_locations(id), account_id TEXT, briefing_cards TEXT, interested_list TEXT, area_hint TEXT, mood_hints TEXT, venue_id TEXT REFERENCES venues(id), active_space_ids TEXT, event_format TEXT NOT NULL DEFAULT 'private_tasting', gathering_type TEXT DEFAULT 'private', requires_approval INTEGER NOT NULL DEFAULT 1, lifecycle_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(lifecycle_status IN ('draft','published','registration_closed','completed','cancelled','archived')), public_visibility TEXT NOT NULL DEFAULT 'public'
  CHECK(public_visibility IN ('public','unlisted','private')), network_discovery INTEGER NOT NULL DEFAULT 1
  CHECK(network_discovery IN (0, 1)), recap_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(recap_status IN ('draft','published')));

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT PRIMARY KEY,
    rate_to_usd REAL NOT NULL,
    last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_status (
  feature_id   TEXT PRIMARY KEY,           

  
  stage        TEXT NOT NULL DEFAULT 'needs_testing',

  
  works        TEXT NOT NULL DEFAULT 'unknown',

  
  tested       INTEGER NOT NULL DEFAULT 0,

  
  visual       TEXT NOT NULL DEFAULT 'unknown',

  
  notes        TEXT NOT NULL DEFAULT '',

  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guest_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  parent_attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  invite_token TEXT UNIQUE NOT NULL,
  name_hint TEXT,
  claimed_by_name TEXT,
  claimed_by_phone TEXT,
  claimed_by_email TEXT,
  claimed_attendee_id TEXT REFERENCES event_attendees(id),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired')),
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT
, contact TEXT);

CREATE TABLE IF NOT EXISTS identity_email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose = 'signup-email'),
  code_hash TEXT NOT NULL,
  client_nonce_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incident_ledger (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('network', 'configuration', 'server', 'auth', 'authorization', 'workflow', 'client')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'repairing', 'observing', 'resolved')),
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  route TEXT,
  method TEXT,
  http_status INTEGER,
  error_code TEXT NOT NULL,
  safe_message TEXT NOT NULL,
  deployment TEXT,
  account_id TEXT,
  user_id TEXT,
  sample_json TEXT NOT NULL DEFAULT '{}',
  resolved_at TEXT,
  resolution_ref TEXT
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  items TEXT NOT NULL,         
  total_usd REAL,
  currency TEXT DEFAULT 'USD',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', 
  created_at TEXT NOT NULL DEFAULT (datetime('now')), source TEXT NOT NULL DEFAULT 'cart', ref_number TEXT, tracking_token_hash TEXT, request_fingerprint TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS interest_signups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
, converted_at TEXT);

CREATE TABLE IF NOT EXISTS inventory_receipt_lines (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  expected_quantity REAL NOT NULL CHECK (expected_quantity > 0),
  received_quantity REAL NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  cancelled_quantity REAL NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('g','unit')),
  intended_purpose TEXT NOT NULL CHECK (intended_purpose IN ('working','sample','personal')),
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  intake_batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), original_cost_amount REAL, original_cost_currency TEXT, original_unit_cost REAL, pack_count REAL, original_cost_amount_exact TEXT, original_unit_cost_exact TEXT,
  CHECK (received_quantity + cancelled_quantity <= expected_quantity)
);

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','ordered','in_transit','partially_received','received','cancelled')),
  vendor_name TEXT,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  eta TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_id TEXT REFERENCES invoices(id),
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL
, account_id TEXT, custom_name TEXT, stock_owner_user_id TEXT REFERENCES users(id), sales_grant_id TEXT REFERENCES sales_grants(id), owner_share_type TEXT NOT NULL DEFAULT 'percent' CHECK(owner_share_type IN ('percent','fixed')), owner_share_value REAL NOT NULL DEFAULT 100);

CREATE TABLE IF NOT EXISTS invoice_line_repairs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  line_item_id TEXT NOT NULL REFERENCES invoice_line_items(id),
  repair_key TEXT NOT NULL UNIQUE,
  old_price_at_sale REAL NOT NULL,
  new_price_at_sale REAL NOT NULL,
  old_line_total REAL NOT NULL,
  new_line_total REAL NOT NULL,
  repaired_by TEXT NOT NULL REFERENCES users(id),
  repaired_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_number TEXT NOT NULL,
    customer_name TEXT,
    customer_whatsapp TEXT,
    display_currency TEXT,
    shipping_cost_usd REAL DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    inventory_deducted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
, customer_id TEXT, deleted_at TEXT, notes TEXT, account_id TEXT, source_event_id TEXT, payment_status TEXT DEFAULT 'unpaid', payment_date TEXT, payment_method TEXT, source_collection_id TEXT, source_publication_id TEXT, fulfilled_at TEXT, fulfillment_claim_token TEXT, fulfillment_claimed_at TEXT, sold_by_user_id TEXT REFERENCES users(id), payment_recipient_user_id TEXT REFERENCES users(id));

CREATE TABLE IF NOT EXISTS mcp_confirmation_tickets (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
, token_id TEXT);

CREATE TABLE IF NOT EXISTS mcp_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    label TEXT NOT NULL,           -- human-readable, e.g. "Claude desktop on MBP"
    token_hash TEXT NOT NULL,      -- SHA-256 hex of the plaintext secret
    token_prefix TEXT NOT NULL,    -- first 8 chars of the plaintext, shown in the admin UI
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT
, scopes TEXT NOT NULL DEFAULT '["inventory:read","stock:write","customers:read","sales:write"]', creator_tier TEXT NOT NULL DEFAULT 'account_owner', expires_at INTEGER);

CREATE TABLE IF NOT EXISTS member_connections (
  id TEXT PRIMARY KEY,
  user_id_a TEXT NOT NULL,
  user_id_b TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id_a, user_id_b)
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT,
  email TEXT NOT NULL,
  source TEXT,
  subscribed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, email)
);

CREATE TABLE IF NOT EXISTS note_sessions (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id),
  title        TEXT,                        
  session_date TEXT NOT NULL,              
  location     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),

  
  tea_key          TEXT,            
  compass_entry_id TEXT,            
  session_id       TEXT REFERENCES note_sessions(id),

  
  text             TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'manual',  
  tasting_id       TEXT,                             
  tasting_snapshot TEXT,                             

  
  author_id        TEXT NOT NULL,
  author_name      TEXT NOT NULL,

  
  visibility       TEXT NOT NULL DEFAULT 'private',  

  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
, deleted INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS oauth_authorize_requests (
  id TEXT PRIMARY KEY,                    
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  response_type TEXT,
  code_challenge TEXT NOT NULL,           
  code_challenge_method TEXT NOT NULL,
  state TEXT,
  scope TEXT,
  expires_at INTEGER NOT NULL,            
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_name TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,    -- JSON array of allowed redirect URIs
    grant_types TEXT NOT NULL DEFAULT '["authorization_code"]',
    response_types TEXT NOT NULL DEFAULT '["code"]',
    -- Public client (PKCE only) — no client secret stored. The MCP spec
    -- recommends public clients with PKCE for desktop/mobile.
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_codes (
    code TEXT PRIMARY KEY,                 -- random opaque string
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    user_id TEXT NOT NULL,                 -- the Teajia user who approved
    user_email TEXT NOT NULL,
    account_id TEXT NOT NULL,              -- approved scope is this account
    code_challenge TEXT NOT NULL,          -- PKCE S256 challenge
    code_challenge_method TEXT NOT NULL,   -- always 'S256'
    expires_at TEXT NOT NULL,              -- 5 min from issue
    used_at TEXT,                          -- prevents replay
    created_at TEXT DEFAULT (datetime('now'))
, scopes TEXT, creator_tier TEXT);

CREATE TABLE IF NOT EXISTS password_reset_tokens (     id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,     token TEXT UNIQUE NOT NULL,     expires_at TEXT NOT NULL,     used INTEGER DEFAULT 0,     created_at TEXT DEFAULT (datetime('now')) );

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

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('bank_transfer','payment_link','provider_qr','other')),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  recipient_name TEXT NOT NULL CHECK (length(trim(recipient_name)) BETWEEN 1 AND 120),
  account_identifier TEXT CHECK (account_identifier IS NULL OR length(account_identifier) <= 240),
  instructions TEXT CHECK (instructions IS NULL OR length(instructions) <= 1000),
  external_url TEXT,
  qr_image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personal_cellar_items (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL,            
  name              TEXT NOT NULL,
  type              TEXT,                      
  year              INTEGER,
  origin            TEXT,
  notes             TEXT,
  grams             REAL NOT NULL DEFAULT 0,   
  image_url         TEXT,

  
  
  
  
  placement_status      TEXT NOT NULL DEFAULT 'private',
  placement_account_id  TEXT,                  
  linked_product_id     TEXT,                  

  
  shelf_published   INTEGER NOT NULL DEFAULT 0,

  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action      TEXT NOT NULL,       -- e.g. 'account.created', 'feature.toggled', 'platform_role.changed', 'account.suspended'
  actor_id    TEXT,                -- user_id of who did it
  actor_email TEXT,                -- denormalised for readability after user deletion
  target_type TEXT,                -- 'account' | 'user' | 'feature' | 'member'
  target_id   TEXT,                -- id of the affected entity
  details     TEXT DEFAULT '{}',   -- JSON: extra context (old value, new value, etc.)
  created_at  TEXT DEFAULT (datetime('now'))
, account_id TEXT, actor_account_id TEXT);

CREATE TABLE IF NOT EXISTS private_recordings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transcript TEXT,
  last_error_code TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_impressions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  candidate_id TEXT NOT NULL UNIQUE REFERENCES tasting_note_candidates(id),
  text TEXT NOT NULL,
  attribution_name TEXT NOT NULL,
  attribution_detail TEXT,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_listings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  -- Inventory
  stock_grams INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 100,
  recheck_stock INTEGER DEFAULT 0,
  -- Pricing
  fixed_retail_price_usd REAL,        -- if set, overrides markup_multiplier-derived price
  markup_multiplier REAL DEFAULT 2.5,
  -- Cost / sourcing (PROTECTED from cross-account reads, per Phase 1A protections)
  vendor TEXT,
  vendor_id TEXT,
  cost_amount REAL DEFAULT 0,
  cost_currency TEXT DEFAULT 'USD',
  shipping_rate_per_kg REAL DEFAULT 0,
  quantity_purchased INTEGER,
  source_compass_entry_id TEXT,
  stock_verified_at TEXT,
  -- Per-listing override of canonical content
  store_note TEXT,
  listing_photos TEXT DEFAULT '[]',           -- JSON, shown FIRST on storefront if present
  hide_canonical_photos INTEGER NOT NULL DEFAULT 0,
  -- Visibility flags (each carries distinct intent, per memory_visibility_flag_semantics)
  is_personal INTEGER DEFAULT 0,
  can_reorder INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_curated INTEGER DEFAULT 0,
  is_sample INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  show_wisdom INTEGER DEFAULT 1,
  is_custom_wisdom INTEGER DEFAULT 0,
  -- Lifecycle (soft-delete: partner stops carrying — per Decision 13)
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  archived_at TEXT,
  archived_reason TEXT,
  sold_out_at TEXT,
  -- Tasting (per-listing because tasting is per-account-per-tea)
  tasting TEXT DEFAULT '{}',
  tasting_source TEXT,
  -- Migration anchor — the legacy product row this listing was created from.
  -- Populated by backfill below; NULL for listings created post-migration.
  legacy_product_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), owner_user_id TEXT, shown_in_shop INTEGER NOT NULL DEFAULT 1, inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal')), stock_known_at TEXT,
  UNIQUE(account_id, profile_id)
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    given_name TEXT,
    chinese_name TEXT,
    product_name TEXT NOT NULL,
    year INTEGER,
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
    markup_multiplier REAL DEFAULT 2.5,
    fixed_retail_price_usd REAL,
    is_personal INTEGER DEFAULT 0,
    can_reorder INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    lore TEXT,
    is_custom_wisdom INTEGER DEFAULT 0,
    show_wisdom INTEGER DEFAULT 1,
    processing_notes TEXT,
    mood TEXT,
    experience TEXT,
    liquor_color TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, material TEXT, capacity_ml INTEGER, teaware_category TEXT, quantity_units INTEGER, form TEXT, terroir TEXT, additional_images TEXT DEFAULT '[]', recheck_stock INTEGER DEFAULT 0, vendor_id TEXT, stock_verified_at TEXT DEFAULT NULL, is_curated INTEGER DEFAULT 0, updated_at TEXT, last_synced_at TEXT, tasting TEXT DEFAULT '{}', is_sample INTEGER DEFAULT 0, in_transit INTEGER DEFAULT 0, sold_out_at TEXT, account_id TEXT, tea_key TEXT, source_compass_entry_id TEXT, wholesale_price REAL DEFAULT NULL, catalog_visible INTEGER NOT NULL DEFAULT 0, tasting_source TEXT, imported_from_product_id TEXT, imported_via_publication_id TEXT, in_transit_grams INTEGER, in_transit_eta TEXT, session_reserve_grams INTEGER, sourced_by TEXT, roasted_by TEXT, vouched_by TEXT, bag_photo_url TEXT, owner_user_id TEXT, shown_in_shop INTEGER NOT NULL DEFAULT 1, inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal')), stock_known_at TEXT, stock_movement_guard TEXT, classification TEXT, cultivar TEXT, slug TEXT);

CREATE TABLE IF NOT EXISTS profile_favorites (
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  tea_profile_id TEXT NOT NULL REFERENCES tea_profiles(id) ON DELETE CASCADE,
  source_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  source_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  source_listing_id TEXT REFERENCES product_listings(id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR length(note) <= 280),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (contributor_id, tea_profile_id),
  CHECK (source_product_id IS NULL OR source_listing_id IS NULL),
  CHECK ((source_product_id IS NULL AND source_listing_id IS NULL) OR source_account_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS profile_suggestion_fields (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  suggestion_id TEXT NOT NULL REFERENCES profile_suggestions(id) ON DELETE CASCADE,
  -- Which canonical field. Whitelisted in the worker, not in SQL.
  -- See PROFILE_SUGGESTABLE_FIELDS in worker/src/index.ts.
  field_name TEXT NOT NULL,
  -- Snapshot of the canonical value at suggestion time so the curator can
  -- see "current vs proposed" even if canonical drifts before review.
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  -- Per-field decision. status='pending' until the curator decides.
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  -- Optional curator note shown back to the partner when the decision lands.
  -- No rationale on the partner side (the change is the argument), but the
  -- curator can leave a note explaining a rejection if they want.
  reject_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_suggestions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  -- Which profile is being suggested against
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  -- Who suggested (account-level + user-level for attribution)
  suggested_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  suggested_by_user_id TEXT NOT NULL REFERENCES users(id),
  -- Bundle status. Per-field decisions live in profile_suggestion_fields;
  -- this rolls up the overall verdict.
  --   pending             — no fields decided yet
  --   partial             — some fields decided, others still pending
  --   resolved            — every field has a decision (accepted or rejected)
  --   withdrawn           — partner withdrew before any decision
  status TEXT NOT NULL DEFAULT 'pending',
  -- Curator review timestamps + actor (when the bundle becomes resolved)
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_jobs (
  account_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  lock_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, operation)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  vendor_name TEXT,
  vendor_id TEXT,
  vendor_contact TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  total_usd REAL NOT NULL DEFAULT 0,
  display_currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  message_text TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  price_floor REAL,
  owner_share_type TEXT NOT NULL DEFAULT 'percent' CHECK(owner_share_type IN ('percent','fixed')),
  owner_share_value REAL NOT NULL DEFAULT 100,
  quantity_limit REAL,
  starts_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_settlements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  line_item_id TEXT NOT NULL REFERENCES invoice_line_items(id),
  product_id TEXT REFERENCES products(id),
  stock_owner_user_id TEXT REFERENCES users(id),
  seller_user_id TEXT NOT NULL REFERENCES users(id),
  grant_id TEXT REFERENCES sales_grants(id),
  gross_amount REAL NOT NULL,
  owner_amount REAL NOT NULL,
  seller_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'owed' CHECK(status IN ('owed','paid','reversed')),
  reversed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, line_item_id)
);

CREATE TABLE IF NOT EXISTS saved_collections (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  via_slug      TEXT,                       -- publication slug they arrived through
  source        TEXT NOT NULL DEFAULT 'saved', -- 'received' | 'saved'
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (user_id, collection_id)
);

CREATE TABLE IF NOT EXISTS saved_locations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  map_link TEXT,
  guidelines TEXT,
  venue_guide TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, account_id TEXT);

CREATE TABLE IF NOT EXISTS seasonal_calendar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  region      TEXT NOT NULL,                    -- "Wuyishan", "Taipei", "Yunnan", ...
  month_start INTEGER NOT NULL,                 -- 1-12
  month_end   INTEGER NOT NULL,                 -- 1-12
  day_start   INTEGER,                          -- 1-31, NULL = whole month
  day_end     INTEGER,
  line        TEXT NOT NULL,                    -- "Wuyishan, spring picking. Week three."
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_holds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  held_grams REAL NOT NULL DEFAULT 0,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS stock_ledger (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    product_id TEXT NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    source_invoice_id TEXT,
    source_invoice_number TEXT,
    user_email TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, account_id TEXT, batch_id TEXT, movement_unit TEXT CHECK (movement_unit IS NULL OR movement_unit IN ('gram', 'unit')), receipt_proposal_id TEXT REFERENCES curate_receipt_proposals(id) ON DELETE SET NULL, inventory_receipt_line_id TEXT REFERENCES inventory_receipt_lines(id) ON DELETE SET NULL, movement_type TEXT CHECK (movement_type IS NULL OR movement_type IN ('receipt','sale','sample_use','gift','waste','return','recount','transfer')), idempotency_key TEXT, source_compass_entry_id TEXT REFERENCES tea_compass_entries(id) ON DELETE SET NULL, movement_fingerprint TEXT);

CREATE TABLE IF NOT EXISTS story_content (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'published',   -- 'published' | 'draft'
  content TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS story_content_versions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS story_photos (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  frame_slot TEXT NOT NULL,
  image_url TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT '{"scale":1,"x":0.5,"y":0.5}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS table_share_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  source_entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasting_join_codes (
  code TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  redemption_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasting_note_candidates (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  journal_entry_id TEXT NOT NULL REFERENCES customer_tasting_journal(id),
  note_key TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  source_text TEXT NOT NULL,
  source_tasting TEXT,
  status TEXT NOT NULL DEFAULT 'starred' CHECK (status IN ('starred', 'promoted', 'dismissed')),
  edited_text TEXT,
  attribution_name TEXT,
  attribution_detail TEXT,
  promoted_at TEXT,
  promoted_by TEXT REFERENCES users(id),
  dismissed_at TEXT,
  dismissed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (author_user_id, journal_entry_id, note_key)
);

CREATE TABLE IF NOT EXISTS tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  compass_entry_id TEXT,
  tea_name TEXT,
  tea_key TEXT,
  tea_metadata TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

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
, account_id TEXT, tea_key TEXT, linked_customer_id TEXT, source_entry_id TEXT, session_id TEXT, verdict TEXT, decision TEXT
  CHECK (decision IS NULL OR decision IN ('considering', 'selected', 'passed_on')), journey_id TEXT, visit_id TEXT, import_item_id TEXT, sample_state TEXT
  CHECK (sample_state IS NULL OR sample_state IN ('requested', 'received', 'tasted')), sample_set_id TEXT REFERENCES tea_sample_sets(id), origin_country TEXT, classification TEXT, description TEXT, cultivar TEXT);

CREATE TABLE IF NOT EXISTS tea_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  -- Lineage (immutable) vs stewardship (transferable). Per Decision 10.
  originated_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  curated_by_account_id    TEXT NOT NULL REFERENCES accounts(id),
  -- Identity
  name TEXT NOT NULL,
  chinese_name TEXT,
  type TEXT,                          -- 'White' | 'Green' | 'Oolong' | 'Red' | 'Aged' | 'Pu-erh' | 'Hei' | 'Yancha' | etc.
  form TEXT,                          -- 'Loose' | 'Cake' | 'Brick' | etc.
  -- Provenance
  origin_country TEXT,
  origin_region TEXT,
  varietal TEXT,                      -- not in legacy products; stays NULL until edited
  harvest_year TEXT,                  -- mirrors products.year (kept as TEXT for "2024 spring" etc.)
  -- Editorial content
  description TEXT,
  lore TEXT,
  processing_notes TEXT,
  terroir TEXT,
  mood TEXT,                          -- short mood phrase (e.g. "Grounding & Meditative")
  experience TEXT,                    -- 1-2 sentences on the feeling of drinking
  tasting_notes TEXT DEFAULT '[]',    -- JSON array, denormalized for quick display
  -- Photos
  image_url TEXT,                     -- primary canonical photo
  canonical_photos TEXT DEFAULT '[]', -- JSON array of additional R2 URLs (mirrors additional_images)
  -- Tags (live in tasting per Decision 23; columns exist for the
  -- tasting-to-canonical promotion flow that lands in Step 3)
  flavor_tags TEXT DEFAULT '[]',
  mood_tags TEXT DEFAULT '[]',
  -- Network economics
  wholesale_margin_pct INTEGER,       -- profile-level override; NULL falls back to trust-tier default
  network_visible INTEGER NOT NULL DEFAULT 1,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'published' | 'archived'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, suggested_for_network_at TEXT, suggested_for_network_by_user_id TEXT REFERENCES users(id), suggested_for_network_note TEXT, adoption_decision TEXT, adoption_decided_at TEXT, adoption_decided_by_user_id TEXT REFERENCES users(id), adoption_decline_note TEXT);

CREATE TABLE IF NOT EXISTS tea_reference_issues (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  page_slug TEXT NOT NULL,
  route TEXT NOT NULL,
  section_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'incorrect_information',
    'translation',
    'unclear_writing',
    'wrong_source',
    'geography_or_hierarchy',
    'missing_information'
  )),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  normalized_note TEXT NOT NULL CHECK (length(normalized_note) > 0),
  public_text_snapshot TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(source_ids_json) AND json_type(source_ids_json) = 'array'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_by_user_id TEXT REFERENCES users(id),
  resolved_at TEXT,
  CHECK (
    (status = 'open' AND resolved_by_user_id IS NULL AND resolved_at IS NULL)
    OR
    (status = 'resolved' AND resolved_by_user_id IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS tea_reviews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tea_key TEXT NOT NULL,
  product_id TEXT,
  product_account_id TEXT,
  author_user_id TEXT NOT NULL,
  author_account_id TEXT NOT NULL,
  visibility TEXT DEFAULT 'network',
  session_date TEXT,
  rating INTEGER,
  notes TEXT,
  tasting TEXT,
  brew_params TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, profile_id TEXT REFERENCES tea_profiles(id));

CREATE TABLE IF NOT EXISTS tea_sample_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  source_name TEXT,
  purpose TEXT NOT NULL DEFAULT 'sourcing',
  notes TEXT,
  shared_with TEXT DEFAULT '[]',
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT
, archived INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS tea_sample_tastings (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  taster_id TEXT NOT NULL DEFAULT 'admin',
  taster_name TEXT,
  tasting TEXT NOT NULL DEFAULT '{}',
  rating INTEGER,
  verdict TEXT NOT NULL DEFAULT 'neutral',
  would_buy INTEGER NOT NULL DEFAULT 0,
  personal_note TEXT,
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sample_id) REFERENCES tea_samples(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tea_samples (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  chinese_name TEXT,
  type TEXT,
  form TEXT,
  year INTEGER,
  origin_region TEXT,
  source_id TEXT,
  source_name TEXT,
  source_contact TEXT,
  product_id TEXT,
  compass_entry_id TEXT,
  set_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'untasted',
  grams REAL NOT NULL DEFAULT 10,
  notes TEXT,
  photos TEXT DEFAULT '[]',
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS teaware_collection (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    chinese_name TEXT,
    category TEXT NOT NULL,          
    material TEXT,                   
    capacity_ml INTEGER,
    origin TEXT,                     
    artist TEXT,                     
    year_acquired TEXT,
    purchase_price REAL,
    purchase_currency TEXT DEFAULT 'USD',
    description TEXT,
    condition TEXT DEFAULT 'excellent',  
    is_favorite INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
, account_id TEXT);

CREATE TABLE IF NOT EXISTS teaware_photos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    teaware_id TEXT NOT NULL REFERENCES teaware_collection(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
, account_id TEXT);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  account_id TEXT,
  item_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, account_id, item_id)
);

CREATE TABLE IF NOT EXISTS user_taste_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  verdict_counts TEXT NOT NULL DEFAULT '{}',
  total_tastings INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL,
  UNIQUE(user_id, account_id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
, admin_request_status TEXT NOT NULL DEFAULT 'none', admin_requested_at TEXT, username TEXT, platform_role TEXT DEFAULT NULL, google_id TEXT, phone TEXT, can_create_collections INTEGER NOT NULL DEFAULT 0, shelf_enabled  INTEGER NOT NULL DEFAULT 0, shelf_slug     TEXT, shelf_title    TEXT, shelf_whatsapp TEXT, session_version INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT);

CREATE TABLE IF NOT EXISTS venue_spaces (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  venue_id    TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                    -- "Charcoal Table", "Social Table"
  capacity    INTEGER NOT NULL DEFAULT 10,
  description TEXT,                             -- vibe note shown to guests
  photos      TEXT,                             -- JSON array of image URLs
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
, tea_styles TEXT);

CREATE TABLE IF NOT EXISTS venues (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  name        TEXT NOT NULL,                    -- "Adrian's Flat", "Art Studio"
  address     TEXT NOT NULL,
  map_link    TEXT,
  area_hint   TEXT,                             -- shown before approval, e.g. "Da'an District"
  arrival_notes TEXT,
  photos      TEXT,                             -- JSON array of image URLs
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
, website TEXT, instagram TEXT);

CREATE TABLE IF NOT EXISTS verification_challenges (
  id TEXT PRIMARY KEY,
  contact_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signin', 'event')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wholesale_margin_defaults (
  trust_tier TEXT PRIMARY KEY,        -- 'basic' | 'verified' | 'partner' | 'tea_master'
  default_margin_pct INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wholesale_order_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id TEXT NOT NULL REFERENCES wholesale_orders(id) ON DELETE CASCADE,

  -- The supplier's listing being purchased. We carry profile_id as a
  -- denormalization so the buyer can see what tea this is even after the
  -- supplier archives their listing or changes its content.
  supplier_listing_id TEXT NOT NULL REFERENCES product_listings(id),
  profile_id          TEXT NOT NULL REFERENCES tea_profiles(id),

  -- The buyer's matching listing (optional). NULL when they don't yet carry
  -- this profile. Set on receive — that's when stock lands in their inventory,
  -- which means we either find an existing listing or create one.
  buyer_listing_id TEXT REFERENCES product_listings(id),

  -- Quantity and snapshotted pricing. unit_price_amount is per-gram in
  -- unit_price_currency at submit time; line_total = grams * unit_price_amount.
  grams              REAL NOT NULL,
  unit_price_amount  REAL NOT NULL,
  unit_price_currency TEXT NOT NULL,
  line_total         REAL NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wholesale_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Parties
  supplier_account_id TEXT NOT NULL REFERENCES accounts(id),
  buyer_account_id    TEXT NOT NULL REFERENCES accounts(id),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | submitted | replied | confirmed | shipped | received | cancelled

  -- Currency: the buyer's display currency, locked at draft creation.
  -- Per-line snapshots in wholesale_order_items.unit_price_currency may differ
  -- (e.g. supplier prices in IDR but the buyer agreed in AUD); the order's
  -- summary currency is what totals roll up to and what invoices are issued in.
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Money. NULL until first item is added. shipping_amount NULL until
  -- supplier confirms (they set the freight quote then).
  subtotal_amount REAL,
  shipping_amount REAL,
  total_amount    REAL,

  -- Logistics
  shipping_address TEXT,         -- buyer's drop-off address (free-form)
  tracking_number  TEXT,         -- set by supplier on ship
  carrier          TEXT,         -- e.g. 'Pos Indonesia', 'DHL', 'Toll'

  -- Notes from each side. Buyer's note is set on submit; supplier's note on
  -- confirm or reply.
  buyer_notes      TEXT,
  supplier_notes   TEXT,

  -- Side-effect side: invoice ids generated on receive. Both sides get one.
  -- These are FK-style references but we don't enforce REFERENCES because
  -- invoices is in a different scoping context (account-scoped per row).
  invoice_id_supplier TEXT,
  invoice_id_buyer    TEXT,

  -- Audit timestamps for each transition. NULL until that transition fires.
  -- Used by the timeline (Surface 9) to render the diary-entry log.
  submitted_at TEXT,
  replied_at   TEXT,
  confirmed_at TEXT,
  shipped_at   TEXT,
  received_at  TEXT,
  cancelled_at TEXT,
  cancelled_by_account_id TEXT REFERENCES accounts(id),
  cancel_reason TEXT,

  -- Nudge tracking (per Surface 9 stuck-state handling).
  -- last_nudge_at + nudge_count let us throttle "send a nudge" actions so
  -- a buyer can't spam-nudge the supplier.
  last_nudge_at TEXT,
  nudge_count   INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wisdom_entry_verifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('cultivar', 'region', 'producer', 'style', 'mark', 'namedTea')),
  entry_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (
    length(content_hash) = 64
    AND content_hash NOT GLOB '*[^0-9a-f]*'
  ),
  verified_by_user_id TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, entry_kind, entry_id)
);

CREATE TABLE IF NOT EXISTS wisdom_node_overrides (
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK (editorial_status IN ('draft','review','approved')),
  public_state TEXT NOT NULL DEFAULT 'inherit' CHECK (public_state IN ('inherit','public','hidden')),
  editor_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (node_type, node_id)
);

CREATE TABLE IF NOT EXISTS wisdom_relations (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('article','tea_profile','wisdom_node','product_tasting','promoted_tasting_note')),
  target_id TEXT NOT NULL,
  target_subtype TEXT,
  relationship_kind TEXT NOT NULL CHECK (relationship_kind IN ('supports','illustrates','mentions','is_example_of')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','exact_backfill','inferred')),
  review_status TEXT NOT NULL DEFAULT 'proposed' CHECK (review_status IN ('proposed','approved','rejected')),
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((target_type = 'wisdom_node' AND target_subtype IS NOT NULL) OR
         (target_type != 'wisdom_node' AND target_subtype IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_account_applications_email  ON account_applications(applicant_email);

CREATE INDEX IF NOT EXISTS idx_account_applications_status ON account_applications(status);

CREATE INDEX IF NOT EXISTS idx_account_members_account ON account_members(account_id);

CREATE INDEX IF NOT EXISTS idx_account_members_user ON account_members(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_host_contributor
  ON accounts(host_contributor_id) WHERE host_contributor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_kind ON accounts(kind);

CREATE INDEX IF NOT EXISTS idx_activity_logs_account ON activity_logs(account_id);

CREATE INDEX IF NOT EXISTS idx_anonymous_verdicts_browser ON anonymous_verdicts(browser_token);

CREATE INDEX IF NOT EXISTS idx_anonymous_verdicts_table ON anonymous_verdicts(table_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_external_sources_article
  ON article_external_sources(account_id, article_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_external_sources_source
  ON article_external_sources(account_id, source_system, source_id);

CREATE INDEX IF NOT EXISTS idx_article_products_article ON article_products(article_id);

CREATE INDEX IF NOT EXISTS idx_article_products_product ON article_products(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_products_unique ON article_products(article_id, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_account_source_event
  ON articles(account_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_account_status ON articles(account_id, status);

CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_pull_quote_subject
  ON articles(pull_quote_subject)
  WHERE pull_quote_subject IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);

CREATE INDEX IF NOT EXISTS idx_attendees_phone ON event_attendees(event_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_attendees_status ON event_attendees(event_id, status);

CREATE INDEX IF NOT EXISTS idx_attendees_token ON event_attendees(magic_token);

CREATE INDEX IF NOT EXISTS idx_batches_account ON batches(account_id);

CREATE INDEX IF NOT EXISTS idx_cellar_owner ON personal_cellar_items(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_cellar_placement ON personal_cellar_items(placement_account_id, placement_status);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id, position);

CREATE INDEX IF NOT EXISTS idx_collection_items_product ON collection_items(product_id);

CREATE INDEX IF NOT EXISTS idx_collection_publications_collection
    ON collection_publications(collection_id);

CREATE INDEX IF NOT EXISTS idx_collection_publications_slug
    ON collection_publications(slug);

CREATE INDEX IF NOT EXISTS idx_collection_publications_target
    ON collection_publications(target_type, target_id, unpublished_at);

CREATE INDEX IF NOT EXISTS idx_collections_account_status ON collections(account_id, status);

CREATE INDEX IF NOT EXISTS idx_collections_curator ON collections(curator_user_id);

CREATE INDEX IF NOT EXISTS idx_collections_featured
  ON collections(account_id, is_featured_collection)
  WHERE is_featured_collection = 1;

CREATE INDEX IF NOT EXISTS idx_compass_account_decision
  ON tea_compass_entries(account_id, decision);

CREATE INDEX IF NOT EXISTS idx_compass_account_sample_set
  ON tea_compass_entries(account_id, sample_set_id);

CREATE INDEX IF NOT EXISTS idx_compass_account_sample_state
  ON tea_compass_entries(account_id, sample_state);

CREATE INDEX IF NOT EXISTS idx_compass_cultivar ON tea_compass_entries(cultivar);

CREATE INDEX IF NOT EXISTS idx_compass_entries_account_status ON tea_compass_entries(account_id, status);

CREATE INDEX IF NOT EXISTS idx_compass_entries_journey ON tea_compass_entries(account_id, journey_id);

CREATE INDEX IF NOT EXISTS idx_compass_entries_session
  ON tea_compass_entries(session_id);

CREATE INDEX IF NOT EXISTS idx_compass_entries_source
  ON tea_compass_entries(source_entry_id);

CREATE INDEX IF NOT EXISTS idx_compass_entries_status ON tea_compass_entries(status);

CREATE INDEX IF NOT EXISTS idx_compass_entries_verdict
  ON tea_compass_entries(verdict);

CREATE INDEX IF NOT EXISTS idx_compass_entries_visit ON tea_compass_entries(account_id, visit_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compass_import_item
  ON tea_compass_entries(account_id, user_id, import_item_id)
  WHERE import_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compass_status ON tea_compass_entries(status);

CREATE INDEX IF NOT EXISTS idx_compass_user ON tea_compass_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_connection_invites_from ON connection_invites(from_user_id);

CREATE INDEX IF NOT EXISTS idx_connection_invites_to ON connection_invites(to_user_id);

CREATE INDEX IF NOT EXISTS idx_contact_private_notes_customer
  ON contact_private_notes(account_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_contact_relationships_account_kind
  ON contact_relationships(account_id, kind);

CREATE INDEX IF NOT EXISTS idx_contact_relationships_customer
  ON contact_relationships(account_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_contributor_accounts_account
  ON contributor_accounts(account_id, display_order, contributor_id);

CREATE INDEX IF NOT EXISTS idx_contributors_account
  ON contributors(account_id);

CREATE INDEX IF NOT EXISTS idx_contributors_contact_customer
  ON contributors(account_id, contact_customer_id)
  WHERE contact_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contributors_face_of_account
  ON contributors(face_of_account_id);

CREATE INDEX IF NOT EXISTS idx_contributors_published
  ON contributors(is_published, account_id);

CREATE INDEX IF NOT EXISTS idx_contributors_user
  ON contributors(user_id);

CREATE INDEX IF NOT EXISTS idx_ctj_session ON customer_tasting_journal(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_import_batch_idempotency
  ON curate_import_batches(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curate_import_batches_account
  ON curate_import_batches(account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_curate_import_items_batch
  ON curate_import_items(account_id, batch_id, position);

CREATE INDEX IF NOT EXISTS idx_curate_import_items_compass
  ON curate_import_items(account_id, compass_entry_id);

CREATE INDEX IF NOT EXISTS idx_curate_import_receipts_batch ON curate_import_receipts(account_id, batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_import_source_idempotency
  ON curate_import_sources(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curate_import_sources_batch
  ON curate_import_sources(account_id, batch_id, created_at);

CREATE INDEX IF NOT EXISTS idx_curate_import_vendor_groups_batch
  ON curate_import_vendor_groups(account_id, batch_id, position);

CREATE INDEX IF NOT EXISTS idx_curate_journeys_account ON curate_journeys(account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_curate_visits_account ON curate_visits(account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_curate_visits_journey ON curate_visits(account_id, journey_id);

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag
    ON customer_tags(account_id, tag);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_unique
    ON customer_tags(account_id, customer_id, tag);

CREATE INDEX IF NOT EXISTS idx_customer_tasting_journal_user ON customer_tasting_journal(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tasting_journal_user_product
  ON customer_tasting_journal(user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_customer_tea_discovery_account
  ON customer_tea_discovery(account_id);

CREATE INDEX IF NOT EXISTS idx_customers_account ON customers(account_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers (whatsapp);

CREATE INDEX IF NOT EXISTS idx_event_contributors_event_order
  ON event_contributors(event_id, display_order);

CREATE INDEX IF NOT EXISTS idx_event_party_members_event_seat
  ON event_party_members(event_id, seat_status);

CREATE INDEX IF NOT EXISTS idx_event_tasting_note_history_account_event
  ON event_tasting_note_history(account_id, event_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_event_team_assignments_event_user
  ON event_team_assignments(event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_events_account ON events(account_id);

CREATE INDEX IF NOT EXISTS idx_events_account_lifecycle_date
  ON events(account_id, lifecycle_status, event_date);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE INDEX IF NOT EXISTS idx_events_venue         ON events(venue_id);

CREATE INDEX IF NOT EXISTS idx_guest_invites_event ON guest_invites(event_id);

CREATE INDEX IF NOT EXISTS idx_guest_invites_parent ON guest_invites(parent_attendee_id);

CREATE INDEX IF NOT EXISTS idx_guest_invites_token ON guest_invites(invite_token);

CREATE INDEX IF NOT EXISTS idx_identity_email_verifications_user
  ON identity_email_verifications(user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_ledger_status_severity_last_seen
  ON incident_ledger(status, severity, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_inquiries_account ON inquiries(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiries_account_ref
  ON inquiries(account_id, ref_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiries_account_source ON inquiries(account_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiries_ref_number ON inquiries(ref_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_tracking_token_hash
  ON inquiries(tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interest_event ON interest_signups(event_id);

CREATE INDEX IF NOT EXISTS idx_inventory_receipt_lines_receipt ON inventory_receipt_lines(account_id, receipt_id);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_account_state ON inventory_receipts(account_id, state, created_at);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON invoice_line_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_product
  ON invoice_line_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_repairs_account_invoice
  ON invoice_line_repairs(account_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);

CREATE INDEX IF NOT EXISTS idx_invoices_account_customer
  ON invoices(account_id, customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_account_invoice_number_active
  ON invoices(account_id, invoice_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_fulfillment_claim
  ON invoices(account_id, fulfillment_claim_token);

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices (account_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_invoices_source_collection
  ON invoices(source_collection_id);

CREATE INDEX IF NOT EXISTS idx_invoices_source_event
  ON invoices(source_event_id);

CREATE INDEX IF NOT EXISTS idx_invoices_source_publication
  ON invoices(source_publication_id);

CREATE INDEX IF NOT EXISTS idx_join_codes_active ON tasting_join_codes(session_id, expires_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_join_codes_session ON tasting_join_codes(session_id);

CREATE INDEX IF NOT EXISTS idx_listings_account        ON product_listings(account_id);

CREATE INDEX IF NOT EXISTS idx_listings_account_owner  ON product_listings(account_id, owner_user_id);

CREATE INDEX IF NOT EXISTS idx_listings_account_status ON product_listings(account_id, status);

CREATE INDEX IF NOT EXISTS idx_listings_legacy         ON product_listings(legacy_product_id);

CREATE INDEX IF NOT EXISTS idx_listings_profile        ON product_listings(profile_id);

CREATE INDEX IF NOT EXISTS idx_mcp_confirmation_tickets_account_active
  ON mcp_confirmation_tickets(account_id, consumed_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_account ON mcp_tokens(account_id, revoked_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_member_connections_a ON member_connections(user_id_a);

CREATE INDEX IF NOT EXISTS idx_member_connections_b ON member_connections(user_id_b);

CREATE INDEX IF NOT EXISTS idx_note_sessions_account ON note_sessions(account_id);

CREATE INDEX IF NOT EXISTS idx_note_sessions_date    ON note_sessions(account_id, session_date);

CREATE INDEX IF NOT EXISTS idx_notes_account        ON notes(account_id);

CREATE INDEX IF NOT EXISTS idx_notes_compass_entry  ON notes(compass_entry_id);

CREATE INDEX IF NOT EXISTS idx_notes_session        ON notes(session_id);

CREATE INDEX IF NOT EXISTS idx_notes_tasting        ON notes(tasting_id);

CREATE INDEX IF NOT EXISTS idx_notes_tea_key        ON notes(tea_key);

CREATE INDEX IF NOT EXISTS idx_notifications_event ON event_notifications(event_id);

CREATE INDEX IF NOT EXISTS idx_oauth_authorize_requests_expires
  ON oauth_authorize_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_payment_method_audit_contributor
  ON payment_method_audit_events(contributor_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_contributor
  ON payment_methods(contributor_id, account_id, is_published, position);

CREATE INDEX IF NOT EXISTS idx_platform_audit_account ON platform_audit_log(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_actor   ON platform_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_target  ON platform_audit_log(target_id);

CREATE INDEX IF NOT EXISTS idx_private_recordings_owner ON private_recordings(account_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_product_impressions_account_product_published
  ON product_impressions(account_id, product_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_account ON products(account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_account_compass_identity
  ON products(account_id, source_compass_entry_id)
  WHERE source_compass_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_account_owner  ON products(account_id, owner_user_id);

CREATE INDEX IF NOT EXISTS idx_products_account_shown ON products(account_id, shown_in_shop);

CREATE INDEX IF NOT EXISTS idx_products_cultivar ON products(cultivar);

CREATE INDEX IF NOT EXISTS idx_products_imported_from
    ON products(account_id, imported_from_product_id);

CREATE INDEX IF NOT EXISTS idx_products_roasted_by
  ON products(roasted_by) WHERE roasted_by IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE INDEX IF NOT EXISTS idx_products_source_compass ON products(source_compass_entry_id);

CREATE INDEX IF NOT EXISTS idx_products_sourced_by
  ON products(sourced_by) WHERE sourced_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tea_key ON products(tea_key);

CREATE INDEX IF NOT EXISTS idx_products_vouched_by
  ON products(vouched_by) WHERE vouched_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_favorites_public
  ON profile_favorites(contributor_id, is_public, position);

CREATE INDEX IF NOT EXISTS idx_profiles_adoption_pending
  ON tea_profiles(adoption_decision, suggested_for_network_at)
  WHERE adoption_decision = 'pending';

CREATE INDEX IF NOT EXISTS idx_profiles_curated    ON tea_profiles(curated_by_account_id);

CREATE INDEX IF NOT EXISTS idx_profiles_network    ON tea_profiles(network_visible, status);

CREATE INDEX IF NOT EXISTS idx_profiles_originated ON tea_profiles(originated_by_account_id);

CREATE INDEX IF NOT EXISTS idx_profiles_type       ON tea_profiles(type);

CREATE INDEX IF NOT EXISTS idx_publications_shop_active
  ON collection_publications(target_type, unpublished_at)
  WHERE target_type = 'shop' AND unpublished_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_account ON purchase_orders(account_id);

CREATE INDEX IF NOT EXISTS idx_receipt_proposals_account_status ON curate_receipt_proposals(account_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_profile ON tea_reviews(profile_id);

CREATE INDEX IF NOT EXISTS idx_sales_grants_account_product_seller
  ON sales_grants(account_id, product_id, seller_user_id);

CREATE INDEX IF NOT EXISTS idx_sales_grants_account_seller_active
  ON sales_grants(account_id, seller_user_id, revoked_at, starts_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_sales_settlements_account_owner
  ON sales_settlements(account_id, stock_owner_user_id);

CREATE INDEX IF NOT EXISTS idx_sales_settlements_account_seller
  ON sales_settlements(account_id, seller_user_id);

CREATE INDEX IF NOT EXISTS idx_sales_settlements_account_status
  ON sales_settlements(account_id, status);

CREATE INDEX IF NOT EXISTS idx_sample_sets_purpose ON tea_sample_sets(purpose);

CREATE INDEX IF NOT EXISTS idx_sample_tastings_sample_id ON tea_sample_tastings(sample_id);

CREATE INDEX IF NOT EXISTS idx_samples_set_id ON tea_samples(set_id);

CREATE INDEX IF NOT EXISTS idx_samples_source_id ON tea_samples(source_id);

CREATE INDEX IF NOT EXISTS idx_samples_status ON tea_samples(status);

CREATE INDEX IF NOT EXISTS idx_saved_collections_collection ON saved_collections(collection_id);

CREATE INDEX IF NOT EXISTS idx_saved_collections_user ON saved_collections(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_locations_name ON saved_locations(name);

CREATE INDEX IF NOT EXISTS idx_seasonal_calendar_region
  ON seasonal_calendar(region, account_id);

CREATE INDEX IF NOT EXISTS idx_session_members_session ON tasting_session_members(session_id);

CREATE INDEX IF NOT EXISTS idx_session_teas_product ON tasting_session_teas(product_id);

CREATE INDEX IF NOT EXISTS idx_session_teas_session ON tasting_session_teas(session_id);

CREATE INDEX IF NOT EXISTS idx_session_verdicts_session ON tasting_session_verdicts(session_id);

CREATE INDEX IF NOT EXISTS idx_stock_holds_invoice ON stock_holds(account_id,invoice_id);

CREATE INDEX IF NOT EXISTS idx_stock_holds_product ON stock_holds(account_id,product_id);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_account ON stock_ledger(account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ledger_account_idempotency
  ON stock_ledger(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(batch_id);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_compass_entry ON stock_ledger(account_id, source_compass_entry_id);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_product
  ON stock_ledger(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_receipt_line ON stock_ledger(inventory_receipt_line_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ledger_receipt_proposal ON stock_ledger(receipt_proposal_id) WHERE receipt_proposal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_source_invoice
  ON stock_ledger(source_invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_content_slug_state
  ON story_content(account_id, story_slug, state);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_photos_slug_slot
  ON story_photos(account_id, story_slug, frame_slot);

CREATE INDEX IF NOT EXISTS idx_story_versions_slug
  ON story_content_versions(account_id, story_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggestion_fields_status     ON profile_suggestion_fields(status);

CREATE INDEX IF NOT EXISTS idx_suggestion_fields_suggestion ON profile_suggestion_fields(suggestion_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_account  ON profile_suggestions(suggested_by_account_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_profile  ON profile_suggestions(profile_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_status   ON profile_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_table_share_tokens_entry ON table_share_tokens(source_entry_id);

CREATE INDEX IF NOT EXISTS idx_table_share_tokens_token ON table_share_tokens(token);

CREATE INDEX IF NOT EXISTS idx_tasting_note_candidates_account_product
  ON tasting_note_candidates(account_id, product_id);

CREATE INDEX IF NOT EXISTS idx_tasting_note_candidates_account_status_created
  ON tasting_note_candidates(account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasting_notes_event ON event_tasting_notes(event_id);

CREATE INDEX IF NOT EXISTS idx_tasting_sessions_account ON tasting_sessions(account_id);

CREATE INDEX IF NOT EXISTS idx_tasting_sessions_status ON tasting_sessions(status);

CREATE INDEX IF NOT EXISTS idx_tea_compass_entries_account ON tea_compass_entries(account_id);

CREATE INDEX IF NOT EXISTS idx_tea_menu_event ON event_tea_menu(event_id);

CREATE INDEX IF NOT EXISTS idx_tea_reference_issues_open_account_page
  ON tea_reference_issues(account_id, page_id, section_key, created_at, id)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tea_reference_issues_open_duplicate
  ON tea_reference_issues(account_id, page_id, section_key, category, normalized_note)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_tea_reviews_author ON tea_reviews(author_user_id);

CREATE INDEX IF NOT EXISTS idx_tea_reviews_key ON tea_reviews(tea_key);

CREATE INDEX IF NOT EXISTS idx_tea_reviews_product ON tea_reviews(product_id);

CREATE INDEX IF NOT EXISTS idx_teaware_collection_category ON teaware_collection(category);

CREATE INDEX IF NOT EXISTS idx_teaware_photos_teaware_id ON teaware_photos(teaware_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_user_taste_profile_account ON user_taste_profile(account_id);

CREATE INDEX IF NOT EXISTS idx_user_taste_profile_user ON user_taste_profile(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shelf_slug ON users(shelf_slug) WHERE shelf_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_spaces_account ON venue_spaces(account_id);

CREATE INDEX IF NOT EXISTS idx_venue_spaces_venue   ON venue_spaces(venue_id);

CREATE INDEX IF NOT EXISTS idx_venues_account       ON venues(account_id);

CREATE INDEX IF NOT EXISTS idx_verification_challenges_contact_purpose
  ON verification_challenges(contact_normalized, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wholesale_items_order    ON wholesale_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_wholesale_items_profile  ON wholesale_order_items(profile_id);

CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_listing_id);

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_buyer    ON wholesale_orders(buyer_account_id, status);

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_status   ON wholesale_orders(status);

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_supplier ON wholesale_orders(supplier_account_id, status);

CREATE INDEX IF NOT EXISTS idx_wisdom_relations_node
  ON wisdom_relations(node_type, node_id, review_status);

CREATE INDEX IF NOT EXISTS idx_wisdom_relations_target
  ON wisdom_relations(target_type, target_id, review_status);

CREATE INDEX IF NOT EXISTS idx_wisdom_verifications_account_entry
  ON wisdom_entry_verifications(account_id, entry_kind, entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_account_members_user_account
  ON account_members(user_id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributor_accounts_host
  ON contributor_accounts(account_id)
  WHERE is_host = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributors_face_of_account
  ON contributors(face_of_account_id)
  WHERE face_of_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributors_linked_user
  ON contributors(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_id_account
  ON customers(id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_attendees_id_event_account
  ON event_attendees(id, event_id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_party_members_primary
  ON event_party_members(participation_id)
  WHERE is_primary = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_tasting_note_history_original
  ON event_tasting_note_history(original_note_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_tasting_notes_attendee_menu
  ON event_tasting_notes(attendee_id, tea_menu_id)
  WHERE tea_menu_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_tasting_notes_attendee_null_menu
  ON event_tasting_notes(attendee_id)
  WHERE tea_menu_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_id_account
  ON events(id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wisdom_relations_identity
  ON wisdom_relations(ifnull(account_id, '__global__'), node_type, node_id, target_type, target_id, ifnull(target_subtype, ''), relationship_kind);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;

