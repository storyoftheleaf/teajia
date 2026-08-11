-- Global Tea Master identity across account associations, durable public
-- favorites, and published external payment destinations.

ALTER TABLE contributors ADD COLUMN languages TEXT NOT NULL DEFAULT '[]';
ALTER TABLE contributors ADD COLUMN unpublished_at TEXT;

-- The legacy mirror accidentally made a contributor unique across accounts,
-- which prevents one global person from hosting more than one store. The new
-- contributor_accounts index below owns the correct invariant: one host per
-- account, while one person may host several accounts.
DROP INDEX IF EXISTS idx_accounts_host_contributor;
CREATE INDEX IF NOT EXISTS idx_accounts_host_contributor
  ON accounts(host_contributor_id) WHERE host_contributor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS contributor_user_link_conflicts (
  contributor_id TEXT PRIMARY KEY REFERENCES contributors(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  kept_contributor_id TEXT NOT NULL REFERENCES contributors(id),
  discovered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY is_published DESC, updated_at ASC, id ASC
         ) AS link_rank,
         FIRST_VALUE(id) OVER (
           PARTITION BY user_id
           ORDER BY is_published DESC, updated_at ASC, id ASC
         ) AS kept_id
    FROM contributors
   WHERE user_id IS NOT NULL
)
INSERT OR IGNORE INTO contributor_user_link_conflicts (contributor_id, user_id, kept_contributor_id)
SELECT id, user_id, kept_id FROM ranked WHERE link_rank > 1;

UPDATE contributors
   SET user_id = NULL, updated_at = datetime('now')
 WHERE id IN (SELECT contributor_id FROM contributor_user_link_conflicts);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributors_linked_user
  ON contributors(user_id)
  WHERE user_id IS NOT NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contributor_accounts_host
  ON contributor_accounts(account_id)
  WHERE is_host = 1;
CREATE INDEX IF NOT EXISTS idx_contributor_accounts_account
  ON contributor_accounts(account_id, display_order, contributor_id);

INSERT OR IGNORE INTO contributor_accounts (
  contributor_id, account_id, public_role, is_host, display_order
)
SELECT id, account_id, role, 0, 0
  FROM contributors;

-- Preserve a legacy face relationship even when it points outside the
-- contributor's editorial-steward account.
INSERT OR IGNORE INTO contributor_accounts (
  contributor_id, account_id, public_role, is_host, display_order
)
SELECT id, face_of_account_id, role, 0, 0
  FROM contributors
 WHERE face_of_account_id IS NOT NULL;

-- Preserve the accounts-side mirror as another deterministic source.
INSERT OR IGNORE INTO contributor_accounts (
  contributor_id, account_id, public_role, is_host, display_order
)
SELECT a.host_contributor_id, a.id, c.role, 0, 0
  FROM accounts a
  JOIN contributors c ON c.id = a.host_contributor_id
 WHERE a.host_contributor_id IS NOT NULL;

-- Reconcile conflicting mirrors. accounts.host_contributor_id wins when it
-- references a real contributor; otherwise the oldest published legacy face
-- wins deterministically. The partial unique index enforces one host/account.
UPDATE contributor_accounts
   SET is_host = CASE WHEN contributor_id = COALESCE(
     (SELECT a.host_contributor_id
        FROM accounts a JOIN contributors hc ON hc.id = a.host_contributor_id
       WHERE a.id = contributor_accounts.account_id),
     (SELECT fc.id FROM contributors fc
       WHERE fc.face_of_account_id = contributor_accounts.account_id
       ORDER BY fc.is_published DESC, fc.updated_at ASC, fc.id ASC LIMIT 1)
   ) THEN 1 ELSE 0 END,
       updated_at = datetime('now');

UPDATE accounts
   SET host_contributor_id = (
     SELECT ca.contributor_id FROM contributor_accounts ca
      WHERE ca.account_id = accounts.id AND ca.is_host = 1
   )
 WHERE EXISTS (
   SELECT 1 FROM contributor_accounts ca
    WHERE ca.account_id = accounts.id AND ca.is_host = 1
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
);

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

CREATE INDEX IF NOT EXISTS idx_profile_favorites_public
  ON profile_favorites(contributor_id, is_public, position);

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

CREATE INDEX IF NOT EXISTS idx_payment_methods_contributor
  ON payment_methods(contributor_id, account_id, is_published, position);
