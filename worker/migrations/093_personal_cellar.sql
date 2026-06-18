-- Migration 093: Personal cellar — location-less, person-owned stock (stock spine step 4)
--
-- A personal collection is the SAME person-owned stock as everything else, just
-- placed at NO location (docs/MULTI_STORE_PLAN.md, todo/plans/stock-spine.md).
-- The model is one spine, person-anchored. The IMPLEMENTATION here is a dedicated
-- table — the deliberate fallback the plan blesses — because the worker scopes
-- ~310 queries by `account_id = ?` and migration 017 backfilled every products
-- row to an account; a NULL-account row in `products` is one missed audit away
-- from leaking into a shop or the step-3 master view. A dedicated table keeps
-- these rows entirely out of those account-scoped paths while preserving the
-- model: owner_user_id is the anchor, and the row can be PLACED at a location
-- later (the move) — a human-approved request, never a silent write.
--
-- Private by default. Nothing here appears in any shop, storefront, or master
-- view until it is placed at a location (owner-curated) or published via step 5.

CREATE TABLE IF NOT EXISTS personal_cellar_items (
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

CREATE INDEX IF NOT EXISTS idx_cellar_owner ON personal_cellar_items(owner_user_id);
-- Owner-tier review of pending placement requests targeting a location.
CREATE INDEX IF NOT EXISTS idx_cellar_placement ON personal_cellar_items(placement_account_id, placement_status);
