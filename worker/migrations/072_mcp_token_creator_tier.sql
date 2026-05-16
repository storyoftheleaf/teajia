-- Migration 072 — MCP token creator_tier column.
--
-- Records the tier of the user who minted the token at mint time. Used by the
-- MCP dispatcher to gate owner-tier scopes (catalog:write, customers:write,
-- admin:write) without a DB lookup on every tool call.
--
-- Possible values: 'platform_owner' | 'account_owner' | 'staff' | 'viewer'
-- (matches the effective role hierarchy used in requireOwnerTier).
--
-- Existing tokens default to 'account_owner' — they were already gated behind
-- requireOwnerTier at mint time, so this is always true for pre-migration rows.

ALTER TABLE mcp_tokens ADD COLUMN creator_tier TEXT NOT NULL DEFAULT 'account_owner';
