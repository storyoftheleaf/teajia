-- Quote revisions are counters, not copied shipping prices or payment policy.
ALTER TABLE invoices ADD COLUMN shipping_quote_revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS order_shipping_notification_targets (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
 channel TEXT CHECK(channel IS NULL OR channel IN ('email','whatsapp')),
 recipient TEXT,
 consent_at TEXT,
 tracking_token_sealed TEXT,
 unavailable_code TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(account_id,inquiry_id)
);
CREATE TABLE IF NOT EXISTS shipping_payment_notifications (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 invoice_id TEXT NOT NULL REFERENCES invoices(id),
 quote_revision INTEGER NOT NULL,
 quote_usd REAL NOT NULL CHECK(quote_usd > 0),
 balance_usd REAL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','accepted','retry_scheduled','config_required','review_required','suppressed','needs_contact')),
 attempts INTEGER NOT NULL DEFAULT 0,
 first_attempt_at TEXT,
 next_attempt_at TEXT,
 lease_token TEXT,
 lease_expires_at TEXT,
 provider_message_id TEXT,
 accepted_at TEXT,
 code TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(account_id,invoice_id,quote_revision)
);
CREATE INDEX IF NOT EXISTS idx_shipping_payment_notifications_pending
 ON shipping_payment_notifications(state,next_attempt_at,created_at);
