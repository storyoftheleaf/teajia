-- 082: Tea Discovery profiles — the onboarding quiz result, per person.
--
-- One row per member, keyed by `user_id` (the member's email, matching
-- customer_tasting_journal.user_id) so it is a property of the PERSON, not a
-- store. account_id is context only (nullable) — the table is not account-scoped
-- because plain members/customers need not belong to any store account.
--
-- A tea master surfaces a customer's disposition by joining on the customer's
-- email (see handleGetCustomerJourney + find_customer MCP). disposition_name is
-- denormalized from the client's catalog so the worker/MCP can return a
-- human-readable label without duplicating the disposition copy server-side.

CREATE TABLE IF NOT EXISTS customer_tea_discovery (
  user_id          TEXT PRIMARY KEY,          -- member email (matches tasting journal keying)
  account_id       TEXT,                       -- context only, nullable
  answers          TEXT NOT NULL DEFAULT '{}', -- JSON: question id -> option id | option id[]
  level            TEXT,                       -- 'curious' | 'practicing' | 'devoted'
  disposition_id   TEXT,
  disposition_name TEXT,
  completed_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_tea_discovery_account
  ON customer_tea_discovery(account_id);
