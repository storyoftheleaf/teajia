-- Add dev admin account: login "aaa", password "asdfghjkl", full owner privileges
INSERT OR IGNORE INTO users (id, email, name, password_hash, role)
VALUES (
    'dev-admin-aaa',
    'aaa',
    'Dev Admin',
    '5c80565db6f29da0b01aa12522c37b32f121cbe47a861ef7f006cb22922dffa1',
    'owner'
);
