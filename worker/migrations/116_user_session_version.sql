-- Invalidate every outstanding JWT after a password change/reset without
-- maintaining a server-side token list.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
