-- Migration 072 - MCP token creator_tier column.
--
-- Older tokens behave as account-owner tokens. Newer code writes
-- platform_owner only for true platform-owner users, so cross-account MCP tools
-- can distinguish platform owners from platform admins and account owners.

ALTER TABLE mcp_tokens ADD COLUMN creator_tier TEXT NOT NULL DEFAULT 'account_owner';
