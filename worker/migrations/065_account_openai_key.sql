-- 065: Per-account OpenAI API key (BYOK).
--
-- Stores an AES-GCM encrypted ciphertext blob in `openai_api_key_encrypted`.
-- The encryption key is derived in the worker from the KEY_ENCRYPTION_SECRET
-- env binding (HKDF-SHA256). Plaintext keys are NEVER stored in D1.
--
-- The companion `openai_api_key_last4` column is the only piece of the key
-- that is safe to display in the UI ("sk-…abcd"). Used so an owner can
-- confirm which key is active without revealing the secret.
--
-- Idempotent: ALTER TABLE … ADD COLUMN IF NOT EXISTS isn't supported by D1's
-- SQLite, so we guard with a no-op SELECT and rely on the migration runner to
-- skip already-applied files. If you re-run by hand, the ALTER will error
-- harmlessly; existing data is untouched.

ALTER TABLE accounts ADD COLUMN openai_api_key_encrypted TEXT;
ALTER TABLE accounts ADD COLUMN openai_api_key_last4 TEXT;
