-- Migration 087: MCP token expiry (audit H4)
--
-- Adds an optional expiry to MCP bearer tokens. Before this, tokens lived
-- forever until explicitly revoked, so a leaked token had unbounded blast
-- radius. The worker (authenticateMcp in worker/src/mcp.ts) now rejects a token
-- whose expires_at is set and in the past; mcpAdminMintToken and the OAuth mint
-- set expires_at = now + 365 days on newly minted tokens.
--
-- expires_at is unix SECONDS. Existing rows stay NULL (= legacy non-expiring)
-- so this migration does NOT invalidate any token already in use. Rotate old
-- tokens to pick up an expiry.
--
-- WARNING: SQLite ADD COLUMN has no IF NOT EXISTS. Re-running this errors with
-- "duplicate column name". Apply exactly once (see worker/MIGRATIONS.md).

ALTER TABLE mcp_tokens ADD COLUMN expires_at INTEGER;
