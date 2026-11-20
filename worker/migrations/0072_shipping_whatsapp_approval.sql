-- Cached provider evidence only. No existing messages, contacts or settings are changed.
CREATE TABLE IF NOT EXISTS shipping_whatsapp_approval (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 template_name TEXT NOT NULL,
 language TEXT NOT NULL,
 business_account_id TEXT NOT NULL,
 transport TEXT NOT NULL CHECK(transport IN ('kapso','meta')),
 graph_version TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('approved','pending','rejected','unavailable','config_required')),
 code TEXT,
 checked_at TEXT NOT NULL,
 last_approved_at TEXT,
 PRIMARY KEY(account_id,template_name,language)
);
