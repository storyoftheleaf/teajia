-- 059_contributors.sql
-- Contributor profiles + the integration columns that connect contributors
-- to articles, products, accounts, and the seasonal calendar.
--
-- See docs/ARCHITECTURE.md for the contributor/account boundary.
--
-- Already applied to both local and remote D1 on 2026-05-02. This file
-- captures the canonical SQL on disk so future deploys (and any ground-up
-- restore) stay in sync.
--
-- Mental model:
--   contributors    = canonical editorial identity for any person who appears
--                     publicly on Teajia (writer, tea master, host, maker).
--                     The profile page at /people/:slug renders from this row.
--
--   user_id         = optional link to a Teajia login. Most contributors
--                     will not have one. Public-facing-ness is editorial,
--                     not a registration side effect.
--
--   face_of_account_id  = optional link to an account this contributor
--                         is the public host of. Mirrored on the accounts
--                         side as accounts.host_contributor_id. The pair
--                         must be kept in sync at write time.
--
-- Migration is ADDITIVE ONLY. No existing table is restructured. All new
-- columns on existing tables are nullable so existing rows keep working.
--
-- Seed: every distinct articles.author_id becomes an unpublished contributor
-- row, so existing article bylines have a target to link to as soon as
-- the public route ships. display_name placeholder = hyphens replaced with
-- spaces; Adrian writes the real fields through the admin editor before
-- flipping is_published.

-- ── 1. contributors — the canonical editorial identity ────────────────────

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
);

CREATE INDEX IF NOT EXISTS idx_contributors_account
  ON contributors(account_id);

CREATE INDEX IF NOT EXISTS idx_contributors_published
  ON contributors(is_published, account_id);

CREATE INDEX IF NOT EXISTS idx_contributors_user
  ON contributors(user_id);

CREATE INDEX IF NOT EXISTS idx_contributors_face_of_account
  ON contributors(face_of_account_id);

-- Enforce one-to-at-most-one: no two contributors can be the face of the
-- same account. (NULLs are allowed; SQLite treats NULLs as distinct in
-- unique indexes.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributors_face_of_account
  ON contributors(face_of_account_id)
  WHERE face_of_account_id IS NOT NULL;

-- ── 2. articles — pull-quote and subject linkage ──────────────────────────
-- subject_ids: JSON array of contributor slugs the article is *about*
-- (interviews, profiles). Distinct from author_id (the writer).
--
-- pull_quote / pull_quote_subject: a single ~30-word line that surfaces
-- on the subject's contributor profile. The contributor profile queries
-- WHERE pull_quote_subject = :slug — this is the woven-voice mechanism.

ALTER TABLE articles ADD COLUMN subject_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN pull_quote TEXT;
ALTER TABLE articles ADD COLUMN pull_quote_subject TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_pull_quote_subject
  ON articles(pull_quote_subject)
  WHERE pull_quote_subject IS NOT NULL;

-- ── 3. products — contributor attribution ─────────────────────────────────
-- Powers the Hands on section. Each tea can carry up to three named
-- contributions: who sourced it, who roasted it, who stands behind it.

ALTER TABLE products ADD COLUMN sourced_by TEXT;
ALTER TABLE products ADD COLUMN roasted_by TEXT;
ALTER TABLE products ADD COLUMN vouched_by TEXT;

CREATE INDEX IF NOT EXISTS idx_products_sourced_by
  ON products(sourced_by) WHERE sourced_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_roasted_by
  ON products(roasted_by) WHERE roasted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_vouched_by
  ON products(vouched_by) WHERE vouched_by IS NOT NULL;

-- ── 4. accounts — designate the human face ────────────────────────────────
-- Mirror of contributors.face_of_account_id. The storefront's host card
-- reads this and links to /people/:slug. Kept in sync at write time
-- through a single helper in the worker (see CONTRIBUTOR_PROFILES_PLAN.md).

ALTER TABLE accounts ADD COLUMN host_contributor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_host_contributor
  ON accounts(host_contributor_id) WHERE host_contributor_id IS NOT NULL;

-- ── 5. seasonal_calendar — region-keyed factual lines for the masthead ────
-- Adrian writes these by hand. The contributor profile renders the entry
-- whose region matches the contributor and whose date range covers today.

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

CREATE INDEX IF NOT EXISTS idx_seasonal_calendar_region
  ON seasonal_calendar(region, account_id);

-- ── 6. Seed contributors from existing article bylines ────────────────────
-- For every distinct articles.author_id, create an unpublished contributor
-- row. display_name is a hyphen-replaced placeholder; Adrian fills the real
-- fields through the admin editor when publishing.
--
-- This statement is idempotent (INSERT OR IGNORE) — re-applying the
-- migration is safe.

INSERT OR IGNORE INTO contributors (
  id,
  account_id,
  display_name,
  is_published,
  created_at,
  updated_at
)
SELECT
  a.author_id AS id,
  a.account_id,
  REPLACE(a.author_id, '-', ' ') AS display_name,
  0 AS is_published,
  datetime('now') AS created_at,
  datetime('now') AS updated_at
FROM (
  SELECT DISTINCT author_id, account_id
  FROM articles
  WHERE author_id IS NOT NULL
    AND author_id != ''
) a;
