-- Migration 068 — MCP token scopes.
--
-- Existing MCP tokens remain broad account-scope tokens. The scopes column makes
-- that explicit and gives the admin/API a future path to read-only or
-- domain-specific tokens without changing the bearer token format.

ALTER TABLE mcp_tokens ADD COLUMN scopes TEXT NOT NULL DEFAULT '["inventory:read","stock:write","customers:read","sales:write"]';
