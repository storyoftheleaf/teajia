-- Create users table (replaces admin_users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Migrate existing admin_users data
INSERT OR IGNORE INTO users (id, email, name, password_hash, role, created_at)
SELECT id, email, '', password_hash, 'admin', created_at FROM admin_users;

-- Drop old table
DROP TABLE IF EXISTS admin_users;
