-- 049_profile_suggestions.sql
-- Step 3 (Suggestions / card-as-editor) of the Network Rollout.
-- Per docs/NETWORK_UI_BRIEF.md Surface 6.
--
-- The editorial governance model: partners propose canonical changes by
-- editing a tea card directly. The card UI bundles changes from multiple
-- fields into one suggestion (the partner's "letter"). The curator reviews
-- per-field — accepting some, rejecting others — and the accepted changes
-- write to canonical immediately.
--
-- Decision 3 (Option C in the rollout plan): "Bundle suggestions with
-- per-field accept/reject." So there are TWO tables: the bundle envelope
-- and the per-field rows.
--
-- No rationale field on the bundle (Decision 25 in NETWORK_ROLLOUT_PLAN.md):
-- "When a partner proposes a canonical change, the change itself is
-- self-explanatory." Adrian sees current vs proposed and decides.
--
-- This migration is ADDITIVE ONLY. Two new tables, no changes to existing schema.

-- ── 1. profile_suggestions — the bundle envelope ────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_suggestions_profile  ON profile_suggestions(profile_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status   ON profile_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_account  ON profile_suggestions(suggested_by_account_id);

-- ── 2. profile_suggestion_fields — per-field changes within a bundle ────────
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

CREATE INDEX IF NOT EXISTS idx_suggestion_fields_suggestion ON profile_suggestion_fields(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_fields_status     ON profile_suggestion_fields(status);
