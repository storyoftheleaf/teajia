-- Migration 082 — robust OAuth authorize-request passing + scoped grants.
--
-- Two problems this fixes:
--
-- 1) Claude mobile's in-app browser dropped the OAuth query string on the 302
--    from /oauth/authorize to the consent page, leaving it with no params (see
--    docs/MCP_MOBILE_OAUTH_TODO.md). We now persist the request here and pass a
--    single opaque id in the redirect PATH (which survives the hop), then the
--    consent page fetches the params back by id.
--
-- 2) OAuth-minted tokens were hardcoded to the default scope set + account_owner
--    tier, so an OAuth-connected client could never use owner-tier tools even
--    when the owner wanted it. oauth_codes now carries the consented scopes and
--    the approver's tier so /oauth/token mints faithfully.

CREATE TABLE IF NOT EXISTS oauth_authorize_requests (
  id TEXT PRIMARY KEY,                    -- opaque id passed in the consent URL path
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  response_type TEXT,
  code_challenge TEXT NOT NULL,           -- PKCE S256 challenge
  code_challenge_method TEXT NOT NULL,
  state TEXT,
  scope TEXT,
  expires_at INTEGER NOT NULL,            -- unix ms; 15 min TTL
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_oauth_authorize_requests_expires
  ON oauth_authorize_requests(expires_at);

-- Carry the consented scopes + approver tier onto the auth code so token mint
-- honours them. Both nullable so codes minted before this migration still work
-- (they fall back to the default scope set / account_owner tier in code).
ALTER TABLE oauth_codes ADD COLUMN scopes TEXT;
ALTER TABLE oauth_codes ADD COLUMN creator_tier TEXT;
