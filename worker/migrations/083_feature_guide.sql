-- Working Feature Guide — internal, admin-only build tracker.
-- One row per feature (keyed by a stable string id from the seed list). Holds
-- the independent dimensions Adrian marks while ironing out the platform:
-- whether it works, whether he's tested it, whether the visuals need a
-- redesign, what stage it's at, plus freeform notes. Not multi-tenant — this
-- is the platform owner's own workbench, not per-account data.

CREATE TABLE IF NOT EXISTS feature_status (
  feature_id   TEXT PRIMARY KEY,           -- stable id from the seed list, e.g. "admin:stock"

  -- Stage of development. One of: idea | building | needs_testing | solid
  stage        TEXT NOT NULL DEFAULT 'needs_testing',

  -- Does it function correctly? One of: unknown | works | broken
  works        TEXT NOT NULL DEFAULT 'unknown',

  -- Has Adrian personally tested it? 0/1.
  tested       INTEGER NOT NULL DEFAULT 0,

  -- Does the visual design need work? One of: unknown | good | needs_redesign
  visual       TEXT NOT NULL DEFAULT 'unknown',

  -- Freeform notes — what's left to flesh out, bugs seen, ideas.
  notes        TEXT NOT NULL DEFAULT '',

  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
