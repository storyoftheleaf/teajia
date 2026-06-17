-- Migration 088: Bind MCP confirmation tickets to the issuing token (audit H5)
--
-- Two-step mutation tickets carried only kind + payload + account_id, so any
-- *other* token on the same account with the same scope could confirm a ticket
-- a different token previewed, and per-token auditability was lost. This adds
-- token_id so the worker can verify the confirming token is the one that
-- created the ticket (worker/src/mcp.ts consume/confirm path).
--
-- Nullable: tickets created before this migration (and any in flight at deploy
-- time) keep token_id = NULL and remain confirmable for backward-compat. The
-- worker only rejects a confirm when token_id is set AND does not match.
--
-- WARNING: SQLite ADD COLUMN has no IF NOT EXISTS — apply exactly once.

ALTER TABLE mcp_confirmation_tickets ADD COLUMN token_id TEXT;
