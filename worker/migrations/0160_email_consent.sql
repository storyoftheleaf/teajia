-- Email about tea (Adrian, 2026-11-28). Schema only: no existing row changes.
--
-- users.email_updates_consent     1 yes, 0 no, NULL never asked: whether
--                                 Teajia may email this person about teas and
--                                 tables. Order emails never read it.
-- users.email_updates_consent_at  when that answer was given.
-- user_email_hosts                host by host, whether that host may email
--                                 them, and when they said so.
-- email_consent_log               every answer as it was given: when, where
--                                 (signup, signup-google, signup-code, account) and which
--                                 version of the words was shown.
ALTER TABLE users ADD COLUMN email_updates_consent INTEGER CHECK (email_updates_consent IN (0, 1));
ALTER TABLE users ADD COLUMN email_updates_consent_at TEXT;
CREATE TABLE IF NOT EXISTS user_email_hosts (
  user_id      TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  allowed      INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  decided_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, host_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_email_hosts_host ON user_email_hosts (host_user_id, allowed);
CREATE TABLE IF NOT EXISTS email_consent_log (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  host_user_id    TEXT,
  consent         INTEGER NOT NULL CHECK (consent IN (0, 1)),
  source          TEXT NOT NULL CHECK (source IN ('signup', 'signup-google', 'signup-code', 'account')),
  wording_version TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_consent_log_user ON email_consent_log (user_id, created_at);
