-- Teajia D1 reconstructed baseline (production-faithful 098 + migrations 099-132 that applied)
CREATE TABLE account_features (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,  -- e.g. 'ai_wisdom_generation'
  enabled     INTEGER NOT NULL DEFAULT 0,
  enabled_by  TEXT REFERENCES users(id),
  enabled_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, feature)
);
CREATE TABLE account_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,               -- owner | staff | viewer
    permissions TEXT NOT NULL DEFAULT '{}', -- JSON: per-member feature flags e.g. '{"ai_wisdom": true}'
    invited_by_user_id TEXT,
    invited_at TEXT,
    joined_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'active',
    UNIQUE(account_id, user_id)
);
CREATE TABLE accounts (
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
    -- BYOK: per-account OpenAI API key. Encrypted with AES-GCM in the worker
    -- via KEY_ENCRYPTION_SECRET (see migration 065). Plaintext is never stored.
    openai_api_key_encrypted TEXT,
    openai_api_key_last4 TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE activity_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_email TEXT,
    action TEXT,
    details TEXT,
    entity_type TEXT,             -- product, invoice, customer, etc.
    entity_id TEXT,               -- ID of affected entity
    account_id TEXT,              -- tenant scope (added for multi-account)
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE article_external_sources (
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
CREATE TABLE article_products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  article_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE batches (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id  TEXT NOT NULL,
    label       TEXT NOT NULL,
    intake_date TEXT,                 -- real-world acquisition date the operator asserts (nullable)
    vendor      TEXT,
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE collection_items (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    item_note TEXT,
    recommended_quantity TEXT,   -- grams (loose-leaf) or unit count (cake/teaware), as a string; null = no suggestion
    recommended_price_usd REAL,  -- total USD price for the recommended quantity; null = use catalog price
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (collection_id, product_id)
);
CREATE TABLE collection_publications (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL DEFAULT 'person' CHECK (target_type IN ('person','store','event','shop','tag')),
    target_id TEXT,
    slug TEXT NOT NULL UNIQUE,
    recipients_json TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    unpublished_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT
);
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT,
    hero_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
    created_by_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE compass_shares (
  id TEXT PRIMARY KEY,
  source_entry_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  source_user_name TEXT,
  source_account_name TEXT,
  tea_key TEXT,
  shared_metadata TEXT,             -- JSON snapshot of the entry
  target_account_id TEXT,           -- set for direct pushes
  invite_token TEXT UNIQUE,         -- set for invite links
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE contact_private_notes (
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
CREATE TABLE contact_relationships (
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
CREATE TABLE curate_import_batches (
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
CREATE TABLE curate_import_items (
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
CREATE TABLE curate_import_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  vendor_group_id TEXT NOT NULL REFERENCES curate_import_vendor_groups(id) ON DELETE RESTRICT,
  inventory_receipt_id TEXT NOT NULL REFERENCES inventory_receipts(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, vendor_group_id),
  UNIQUE (account_id, inventory_receipt_id)
);
CREATE TABLE curate_import_sources (
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
CREATE TABLE curate_import_vendor_groups (
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
CREATE TABLE curate_journeys (
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
CREATE TABLE curate_receipt_proposals (
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
CREATE TABLE curate_visits (
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
CREATE TABLE customer_tasting_journal (
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
, session_id TEXT, session_title TEXT);
CREATE TABLE customers (
    account_id TEXT NOT NULL,
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
, business_card_photo TEXT, storefront_photo TEXT, latitude REAL, longitude REAL, line TEXT);
CREATE TABLE exchange_rates (
    currency TEXT PRIMARY KEY,
    rate_to_usd REAL NOT NULL,
    last_updated TEXT DEFAULT (datetime('now'))
);
CREATE TABLE incident_ledger (
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
CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  total_usd REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, ref_number TEXT, source TEXT NOT NULL DEFAULT 'cart', tracking_token_hash TEXT, request_fingerprint TEXT);
CREATE TABLE interest_signups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  account_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
, converted_at TEXT);
CREATE TABLE inventory_receipt_lines (
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
CREATE TABLE inventory_receipts (
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
CREATE TABLE invoice_line_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id TEXT,
    invoice_id TEXT REFERENCES invoices(id),
    product_id TEXT REFERENCES products(id),
    custom_name TEXT,
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL
);
CREATE TABLE invoice_line_repairs (
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
CREATE TABLE invoices (
    account_id TEXT NOT NULL,
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
    source_collection_id TEXT,               -- FK to collections table (draft created from a collection share)
    source_publication_id TEXT,              -- FK to collection_publications table (the specific share link)
    payment_status TEXT DEFAULT 'unpaid',    -- unpaid | partial | paid
    payment_date TEXT,
    payment_method TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, fulfilled_at TEXT, fulfillment_claim_token TEXT, fulfillment_claimed_at TEXT);
CREATE TABLE mcp_confirmation_tickets (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  token_id TEXT,                          -- issuing mcp_tokens.id (migration 088); NULL = legacy ticket
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE TABLE mcp_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    label TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '["inventory:read","stock:write","customers:read","sales:write"]',
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT,
    expires_at INTEGER,                  -- unix seconds (migration 087); NULL = legacy non-expiring
    creator_tier TEXT NOT NULL DEFAULT 'account_owner'
);
CREATE TABLE migration_129_tasting_note_validation (
  violation TEXT NOT NULL CHECK(violation = 'valid')
);
CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE note_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  title TEXT,
  session_date TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  tea_key TEXT,
  compass_entry_id TEXT,
  session_id TEXT REFERENCES note_sessions(id),
  text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  tasting_id TEXT,
  tasting_snapshot TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, deleted INTEGER DEFAULT 0);
CREATE TABLE oauth_authorize_requests (
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
CREATE TABLE oauth_clients (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_name TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,
    grant_types TEXT NOT NULL DEFAULT '["authorization_code"]',
    response_types TEXT NOT NULL DEFAULT '["code"]',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE oauth_codes (
    code TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    account_id TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    scopes TEXT,                           -- JSON array of consented MCP scopes (migration 082)
    creator_tier TEXT,                     -- approver tier, gates owner-tier scopes (migration 082)
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE password_reset_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE personal_cellar_items (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL,            -- the anchor (stock spine)
  name              TEXT NOT NULL,
  type              TEXT,                      -- tea type, free-form
  year              INTEGER,
  origin            TEXT,
  notes             TEXT,
  grams             REAL NOT NULL DEFAULT 0,   -- quantity the person owns
  image_url         TEXT,

  -- The move: a cellar item can be PLACED at a location. Private until then.
  --   'private'   — location-less, visible to no one but the owner (default)
  --   'requested' — owner asked to place it at placement_account_id; awaiting approval
  --   'placed'    — a location owner approved; linked_product_id is the created row
  placement_status      TEXT NOT NULL DEFAULT 'private',
  placement_account_id  TEXT,                  -- the location a request targets / landed at
  linked_product_id     TEXT,                  -- the products row created on approval

  -- Step 5 hook: flip a placed-nowhere item onto the owner's public shelf.
  shelf_published   INTEGER NOT NULL DEFAULT 0,

  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE platform_audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action      TEXT NOT NULL,
  actor_id    TEXT,
  actor_email TEXT,
  target_type TEXT,
  target_id   TEXT,
  details     TEXT DEFAULT '{}',
  created_at  TEXT DEFAULT (datetime('now'))
, account_id TEXT, actor_account_id TEXT);
CREATE TABLE private_recordings (
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
CREATE TABLE product_impressions (
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
CREATE TABLE product_listings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  stock_grams INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 100,
  recheck_stock INTEGER DEFAULT 0,
  fixed_retail_price_usd REAL,
  markup_multiplier REAL DEFAULT 2.5,
  vendor TEXT,
  vendor_id TEXT,
  cost_amount REAL DEFAULT 0,
  cost_currency TEXT DEFAULT 'USD',
  shipping_rate_per_kg REAL DEFAULT 0,
  quantity_purchased INTEGER,
  source_compass_entry_id TEXT,
  stock_verified_at TEXT,
  store_note TEXT,
  listing_photos TEXT DEFAULT '[]',
  hide_canonical_photos INTEGER NOT NULL DEFAULT 0,
  is_personal INTEGER DEFAULT 0,
  can_reorder INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_curated INTEGER DEFAULT 0,
  is_sample INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  show_wisdom INTEGER DEFAULT 1,
  is_custom_wisdom INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  archived_at TEXT,
  archived_reason TEXT,
  sold_out_at TEXT,
  tasting TEXT DEFAULT '{}',
  tasting_source TEXT,
  legacy_product_id TEXT,
  owner_user_id TEXT,
  shown_in_shop INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal')), stock_known_at TEXT,
  UNIQUE(account_id, profile_id)
);
CREATE TABLE products (
    account_id TEXT NOT NULL,
    tea_key TEXT,                                 -- Shared fingerprint across accounts
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
    tasting_source TEXT,                          -- 'owner' | 'community' | NULL; NULL falls back to style baseline
    sold_out_at TEXT,                             -- When product auto-archived due to zero stock
    stock_verified_at TEXT,                        -- Last time stock was physically verified
    source_compass_entry_id TEXT,                  -- FK to tea_compass_entries(id) — which field note sourced this product
    owner_user_id TEXT,                          -- NULL = owned by the location; set = owned by a specific member/person (stock spine step 1)
    sourced_by TEXT,
    roasted_by TEXT,
    vouched_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),  -- Tracks admin edits for smart export
    last_synced_at TEXT                         -- Last time markdown sync touched this row
, session_reserve_grams INTEGER, in_transit_grams INTEGER, in_transit_eta TEXT, bag_photo_url TEXT, shown_in_shop INTEGER NOT NULL DEFAULT 1, inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal')), stock_known_at TEXT, stock_movement_guard TEXT, classification TEXT, cultivar TEXT, slug TEXT);
CREATE TABLE stock_ledger (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    product_id TEXT NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL,           -- Change amount (+100, -50, etc.)
    balance_after INTEGER NOT NULL,   -- Stock after the change
    reason TEXT NOT NULL,             -- MANUAL_ADJUST, FULFILLMENT, VOID, MANUAL_INCREMENT
    source_invoice_id TEXT,           -- FK to invoices (if change was from invoice)
    source_invoice_number TEXT,       -- Denormalized for easy display
    user_email TEXT,
    note TEXT,                        -- Human-readable description
    batch_id TEXT,                    -- FK to batches: which intake shipment/session this arrival belonged to
    account_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, movement_unit TEXT CHECK (movement_unit IS NULL OR movement_unit IN ('gram', 'unit')), receipt_proposal_id TEXT REFERENCES curate_receipt_proposals(id) ON DELETE SET NULL, inventory_receipt_line_id TEXT REFERENCES inventory_receipt_lines(id) ON DELETE SET NULL, movement_type TEXT CHECK (movement_type IS NULL OR movement_type IN ('receipt','sale','sample_use','gift','waste','return','recount','transfer')), idempotency_key TEXT, source_compass_entry_id TEXT REFERENCES tea_compass_entries(id) ON DELETE SET NULL, movement_fingerprint TEXT);
CREATE TABLE story_content (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'published',   -- 'published' | 'draft'
  content TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE story_content_versions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE story_photos (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  frame_slot TEXT NOT NULL,
  image_url TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT '{"scale":1,"x":0.5,"y":0.5}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tasting_note_candidates (
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
CREATE TABLE tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(session_id, user_id)
);
CREATE TABLE tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  compass_entry_id TEXT,
  tea_name TEXT,
  tea_key TEXT,
  tea_metadata TEXT,
  position INTEGER NOT NULL DEFAULT 0
, product_id TEXT REFERENCES products(id));
CREATE TABLE tasting_session_verdicts (
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
CREATE TABLE tasting_sessions (
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
CREATE TABLE tea_compass_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'admin',
  account_id TEXT,
  name TEXT,
  chinese_name TEXT,
  type TEXT,
  form TEXT,
  year INTEGER,
  season TEXT,
  storage TEXT,
  origin_region TEXT,
  tea_key TEXT,
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
  source_entry_id TEXT,
  session_id TEXT,
  verdict TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, linked_customer_id TEXT, decision TEXT
  CHECK (decision IS NULL OR decision IN ('considering', 'selected', 'passed_on')), journey_id TEXT, visit_id TEXT, import_item_id TEXT, sample_state TEXT
  CHECK (sample_state IS NULL OR sample_state IN ('requested', 'received', 'tasted')), sample_set_id TEXT REFERENCES tea_sample_sets(id), origin_country TEXT, classification TEXT, description TEXT, cultivar TEXT);
CREATE TABLE tea_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  originated_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  curated_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  chinese_name TEXT,
  type TEXT,
  form TEXT,
  origin_country TEXT,
  origin_region TEXT,
  varietal TEXT,
  harvest_year TEXT,
  description TEXT,
  lore TEXT,
  processing_notes TEXT,
  terroir TEXT,
  mood TEXT,
  experience TEXT,
  tasting_notes TEXT DEFAULT '[]',
  image_url TEXT,
  canonical_photos TEXT DEFAULT '[]',
  flavor_tags TEXT DEFAULT '[]',
  mood_tags TEXT DEFAULT '[]',
  wholesale_margin_pct INTEGER,
  network_visible INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  suggested_for_network_at TEXT,
  suggested_for_network_by_user_id TEXT REFERENCES users(id),
  suggested_for_network_note TEXT,
  adoption_decision TEXT,
  adoption_decided_at TEXT,
  adoption_decided_by_user_id TEXT REFERENCES users(id),
  adoption_decline_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tea_reference_issues (
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
CREATE TABLE tea_reviews (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tea_key TEXT NOT NULL,
    product_id TEXT,
    product_account_id TEXT,
    author_user_id TEXT NOT NULL,
    author_account_id TEXT NOT NULL,
    visibility TEXT DEFAULT 'network',  -- network | private | account
    session_date TEXT,
    rating INTEGER,
    notes TEXT,
    tasting TEXT,
    brew_params TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
, profile_id TEXT REFERENCES tea_profiles(id));
CREATE TABLE tea_sample_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  source_name TEXT,
  purpose TEXT NOT NULL DEFAULT 'sourcing',
  notes TEXT,
  shared_with TEXT DEFAULT '[]',
  account_id TEXT,
  panel_account_ids TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT
);
CREATE TABLE tea_sample_tastings (
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
CREATE TABLE tea_samples (
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
  tea_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  user_id TEXT
);
CREATE TABLE teaware_collection (
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
CREATE TABLE teaware_photos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    teaware_id TEXT NOT NULL REFERENCES teaware_collection(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',  -- legacy: 'owner', 'admin', 'user'
    platform_role TEXT DEFAULT NULL,    -- NULL | 'platform_admin' | 'platform_owner' (one platform_owner max)
    admin_request_status TEXT NOT NULL DEFAULT 'none',  -- 'none', 'pending', 'approved', 'denied'
    admin_requested_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, shelf_enabled INTEGER NOT NULL DEFAULT 0, shelf_slug TEXT, shelf_title TEXT, shelf_whatsapp TEXT, session_version INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT);
CREATE TABLE verification_challenges (
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
CREATE TABLE wisdom_node_overrides (
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
CREATE TABLE wisdom_relations (
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
CREATE INDEX idx_account_members_account ON account_members(account_id);
CREATE INDEX idx_account_members_user ON account_members(user_id);
CREATE INDEX idx_account_members_user_status ON account_members(user_id, status);
CREATE INDEX idx_activity_logs_account_created ON activity_logs(account_id, created_at);
CREATE UNIQUE INDEX idx_article_external_sources_article
  ON article_external_sources(account_id, article_id);
CREATE UNIQUE INDEX idx_article_external_sources_source
  ON article_external_sources(account_id, source_system, source_id);
CREATE INDEX idx_article_products_article ON article_products(article_id);
CREATE INDEX idx_article_products_product ON article_products(product_id);
CREATE UNIQUE INDEX idx_article_products_unique ON article_products(article_id, product_id);
CREATE INDEX idx_cellar_owner ON personal_cellar_items(owner_user_id);
CREATE INDEX idx_cellar_placement ON personal_cellar_items(placement_account_id, placement_status);
CREATE INDEX idx_collection_items_collection ON collection_items(collection_id, position);
CREATE INDEX idx_collection_items_product ON collection_items(product_id);
CREATE INDEX idx_collection_publications_collection ON collection_publications(collection_id);
CREATE INDEX idx_collection_publications_slug ON collection_publications(slug);
CREATE INDEX idx_collections_account_status ON collections(account_id, status);
CREATE INDEX idx_compass_account_decision
  ON tea_compass_entries(account_id, decision);
CREATE INDEX idx_compass_account_sample_set
  ON tea_compass_entries(account_id, sample_set_id);
CREATE INDEX idx_compass_account_sample_state
  ON tea_compass_entries(account_id, sample_state);
CREATE INDEX idx_compass_cultivar ON tea_compass_entries(cultivar);
CREATE INDEX idx_compass_entries_journey ON tea_compass_entries(account_id, journey_id);
CREATE INDEX idx_compass_entries_session ON tea_compass_entries(session_id);
CREATE INDEX idx_compass_entries_source ON tea_compass_entries(source_entry_id);
CREATE INDEX idx_compass_entries_verdict ON tea_compass_entries(verdict);
CREATE INDEX idx_compass_entries_visit ON tea_compass_entries(account_id, visit_id);
CREATE UNIQUE INDEX idx_compass_import_item
  ON tea_compass_entries(account_id, user_id, import_item_id)
  WHERE import_item_id IS NOT NULL;
CREATE INDEX idx_compass_shares_target ON compass_shares(target_account_id, status);
CREATE INDEX idx_compass_shares_token ON compass_shares(invite_token);
CREATE INDEX idx_compass_status ON tea_compass_entries(status);
CREATE INDEX idx_compass_user_id ON tea_compass_entries(user_id);
CREATE INDEX idx_contact_private_notes_customer
  ON contact_private_notes(account_id, customer_id);
CREATE INDEX idx_contact_relationships_account_kind
  ON contact_relationships(account_id, kind);
CREATE INDEX idx_contact_relationships_customer
  ON contact_relationships(account_id, customer_id);
CREATE UNIQUE INDEX idx_curate_import_batch_idempotency
  ON curate_import_batches(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;
CREATE INDEX idx_curate_import_batches_account
  ON curate_import_batches(account_id, updated_at DESC);
CREATE INDEX idx_curate_import_items_batch
  ON curate_import_items(account_id, batch_id, position);
CREATE INDEX idx_curate_import_items_compass
  ON curate_import_items(account_id, compass_entry_id);
CREATE INDEX idx_curate_import_receipts_batch ON curate_import_receipts(account_id, batch_id);
CREATE UNIQUE INDEX idx_curate_import_source_idempotency
  ON curate_import_sources(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;
CREATE INDEX idx_curate_import_sources_batch
  ON curate_import_sources(account_id, batch_id, created_at);
CREATE INDEX idx_curate_import_vendor_groups_batch
  ON curate_import_vendor_groups(account_id, batch_id, position);
CREATE INDEX idx_curate_journeys_account ON curate_journeys(account_id, updated_at DESC);
CREATE INDEX idx_curate_visits_account ON curate_visits(account_id, updated_at DESC);
CREATE INDEX idx_curate_visits_journey ON curate_visits(account_id, journey_id);
CREATE INDEX idx_customers_account_name ON customers(account_id, name);
CREATE INDEX idx_incident_ledger_status_severity_last_seen
  ON incident_ledger(status, severity, last_seen DESC);
CREATE INDEX idx_inquiries_account_ref
  ON inquiries(account_id, ref_number, created_at DESC);
CREATE INDEX idx_inquiries_account_source ON inquiries(account_id, source, created_at DESC);
CREATE INDEX idx_inquiries_ref_number ON inquiries(ref_number);
CREATE UNIQUE INDEX idx_inquiries_tracking_token_hash
  ON inquiries(tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;
CREATE INDEX idx_inventory_receipt_lines_receipt ON inventory_receipt_lines(account_id, receipt_id);
CREATE INDEX idx_inventory_receipts_account_state ON inventory_receipts(account_id, state, created_at);
CREATE INDEX idx_invoice_line_repairs_account_invoice
  ON invoice_line_repairs(account_id, invoice_id);
CREATE INDEX idx_invoices_account_customer ON invoices(account_id, customer_id);
CREATE UNIQUE INDEX idx_invoices_account_invoice_number_active
  ON invoices(account_id, invoice_number)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_account_status ON invoices(account_id, status);
CREATE INDEX idx_invoices_fulfillment_claim
  ON invoices(account_id, fulfillment_claim_token);
CREATE INDEX idx_invoices_source_collection ON invoices(source_collection_id);
CREATE INDEX idx_invoices_source_event ON invoices(source_event_id);
CREATE INDEX idx_invoices_source_publication ON invoices(source_publication_id);
CREATE INDEX idx_listings_account ON product_listings(account_id);
CREATE INDEX idx_listings_account_owner ON product_listings(account_id, owner_user_id);
CREATE INDEX idx_listings_account_status ON product_listings(account_id, status);
CREATE INDEX idx_listings_legacy ON product_listings(legacy_product_id);
CREATE INDEX idx_listings_profile ON product_listings(profile_id);
CREATE INDEX idx_mcp_confirmation_tickets_account_active
  ON mcp_confirmation_tickets(account_id, consumed_at, expires_at);
CREATE INDEX idx_mcp_tokens_account ON mcp_tokens(account_id, revoked_at);
CREATE UNIQUE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);
CREATE INDEX idx_oauth_authorize_requests_expires ON oauth_authorize_requests(expires_at);
CREATE INDEX idx_oauth_codes_expires ON oauth_codes(expires_at);
CREATE INDEX idx_platform_audit_actor   ON platform_audit_log(actor_id);
CREATE INDEX idx_platform_audit_created ON platform_audit_log(created_at DESC);
CREATE INDEX idx_platform_audit_target  ON platform_audit_log(target_id);
CREATE INDEX idx_private_recordings_owner ON private_recordings(account_id, user_id, created_at);
CREATE INDEX idx_product_impressions_account_product_published
  ON product_impressions(account_id, product_id, published_at DESC);
CREATE UNIQUE INDEX idx_products_account_compass_identity
  ON products(account_id, source_compass_entry_id)
  WHERE source_compass_entry_id IS NOT NULL;
CREATE INDEX idx_products_account_owner ON products(account_id, owner_user_id);
CREATE INDEX idx_products_account_shown ON products(account_id, shown_in_shop);
CREATE INDEX idx_products_account_status ON products(account_id, status);
CREATE INDEX idx_products_cultivar ON products(cultivar);
CREATE INDEX idx_products_roasted_by ON products(roasted_by) WHERE roasted_by IS NOT NULL;
CREATE UNIQUE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_sourced_by ON products(sourced_by) WHERE sourced_by IS NOT NULL;
CREATE INDEX idx_products_vouched_by ON products(vouched_by) WHERE vouched_by IS NOT NULL;
CREATE INDEX idx_profiles_adoption_pending
  ON tea_profiles(adoption_decision, suggested_for_network_at)
  WHERE adoption_decision = 'pending';
CREATE INDEX idx_profiles_curated ON tea_profiles(curated_by_account_id);
CREATE INDEX idx_profiles_network ON tea_profiles(network_visible, status);
CREATE INDEX idx_profiles_originated ON tea_profiles(originated_by_account_id);
CREATE INDEX idx_profiles_type ON tea_profiles(type);
CREATE INDEX idx_receipt_proposals_account_status ON curate_receipt_proposals(account_id, status, created_at);
CREATE INDEX idx_reviews_profile ON tea_reviews(profile_id);
CREATE INDEX idx_sample_sets_purpose ON tea_sample_sets(purpose);
CREATE INDEX idx_sample_tastings_sample_id ON tea_sample_tastings(sample_id);
CREATE INDEX idx_samples_set_id ON tea_samples(set_id);
CREATE INDEX idx_samples_source_id ON tea_samples(source_id);
CREATE INDEX idx_samples_status ON tea_samples(status);
CREATE INDEX idx_stock_ledger_account ON stock_ledger(account_id);
CREATE UNIQUE INDEX idx_stock_ledger_account_idempotency
  ON stock_ledger(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_stock_ledger_compass_entry ON stock_ledger(account_id, source_compass_entry_id);
CREATE INDEX idx_stock_ledger_product ON stock_ledger(product_id);
CREATE INDEX idx_stock_ledger_receipt_line ON stock_ledger(inventory_receipt_line_id);
CREATE UNIQUE INDEX idx_stock_ledger_receipt_proposal ON stock_ledger(receipt_proposal_id) WHERE receipt_proposal_id IS NOT NULL;
CREATE INDEX idx_stock_ledger_source_invoice ON stock_ledger(source_invoice_id);
CREATE UNIQUE INDEX idx_story_content_slug_state
  ON story_content(account_id, story_slug, state);
CREATE UNIQUE INDEX idx_story_photos_slug_slot
  ON story_photos(account_id, story_slug, frame_slot);
CREATE INDEX idx_story_versions_slug
  ON story_content_versions(account_id, story_slug, created_at DESC);
CREATE INDEX idx_tasting_note_candidates_account_product
  ON tasting_note_candidates(account_id, product_id);
CREATE INDEX idx_tasting_note_candidates_account_status_created
  ON tasting_note_candidates(account_id, status, created_at DESC);
CREATE INDEX idx_tea_reference_issues_open_account_page
  ON tea_reference_issues(account_id, page_id, section_key, created_at, id)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_tea_reference_issues_open_duplicate
  ON tea_reference_issues(account_id, page_id, section_key, category, normalized_note)
  WHERE status = 'open';
CREATE INDEX idx_tea_reviews_author ON tea_reviews(author_user_id);
CREATE INDEX idx_tea_reviews_key ON tea_reviews(tea_key);
CREATE INDEX idx_tea_reviews_product ON tea_reviews(product_id);
CREATE INDEX idx_tea_samples_tea_key ON tea_samples(tea_key);
CREATE INDEX idx_teaware_collection_category ON teaware_collection(category);
CREATE INDEX idx_teaware_photos_teaware_id ON teaware_photos(teaware_id);
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_verification_challenges_contact_purpose
  ON verification_challenges(contact_normalized, purpose, created_at DESC);
CREATE INDEX idx_wisdom_relations_node
  ON wisdom_relations(node_type, node_id, review_status);
CREATE INDEX idx_wisdom_relations_target
  ON wisdom_relations(target_type, target_id, review_status);
CREATE UNIQUE INDEX uniq_wisdom_relations_identity
  ON wisdom_relations(ifnull(account_id, '__global__'), node_type, node_id, target_type, target_id, ifnull(target_subtype, ''), relationship_kind);
CREATE TRIGGER trg_products_nonnegative_stock
BEFORE UPDATE OF stock_grams ON products
FOR EACH ROW WHEN NEW.stock_grams < 0
BEGIN
  SELECT RAISE(ABORT, 'stock_grams cannot be negative');
END;
