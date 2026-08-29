-- Migration 066 — MCP tokens for voice-driven inventory control.
--
-- One row per minted token. The plaintext secret is shown to the user once at
-- mint time and never stored — only the SHA-256 hash. Account-scoped: every
-- tool call resolves accountId from the token row, not from a header.
--
-- last_used_at is bumped on every successful authentication so a quick admin
-- glance shows whether a token is active or stale.

CREATE TABLE IF NOT EXISTS mcp_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    label TEXT NOT NULL,           -- human-readable, e.g. "Claude desktop on MBP"
    token_hash TEXT NOT NULL,      -- SHA-256 hex of the plaintext secret
    token_prefix TEXT NOT NULL,    -- first 8 chars of the plaintext, shown in the admin UI
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_account ON mcp_tokens(account_id, revoked_at);
