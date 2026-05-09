-- Migration 067 — OAuth 2.1 + dynamic client registration for MCP.
--
-- The MCP spec (and Claude desktop/mobile's connector flow) requires OAuth
-- 2.1 with PKCE rather than static bearer tokens. Once a client completes
-- the OAuth flow, the access_token it gets back IS an mcp_token row — we
-- just reuse the existing table so all auth + audit machinery is shared.
--
-- This migration adds two tables:
--   oauth_clients          — one row per dynamically-registered client
--   oauth_codes            — short-lived authorization codes (5 min TTL)

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
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);
