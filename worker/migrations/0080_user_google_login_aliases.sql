-- An explicitly linked, existing Google subject can use one canonical profile.
-- Provisioned by a trusted operation. No public registration path writes here.
CREATE TABLE IF NOT EXISTS user_google_login_aliases (
    google_subject TEXT PRIMARY KEY NOT NULL,
    source_user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
    profile_user_id TEXT NOT NULL REFERENCES users(id),
    CHECK (source_user_id <> profile_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_google_login_aliases_profile ON user_google_login_aliases(profile_user_id);
