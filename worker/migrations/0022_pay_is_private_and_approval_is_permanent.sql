-- Pay is private, and approval is permanent.
--
-- A tea master's transfer details used to sit behind a public URL: anyone who
-- pressed Pay on /people/:slug saw the bank account. Adrian's rule, 2026-09-19:
-- pressing Pay never shows a bank detail to the public. Details go to two kinds
-- of people only, and both are recorded here.
--
-- 1. payment_access_grants: an ACCOUNT the contributor has approved. A visitor
--    asks from the gate sheet (granted_via 'request', status 'pending'); the
--    contributor approves at Your Table; from then on that account opens the
--    pay sheet from the profile. There is no revoke and no expiry, on purpose:
--    the relationship is "has bought tea from me", which does not lapse.
--    Opening a share link while signed in also records an approval
--    (granted_via 'link'), so the person never has to ask afterwards.
--    UNIQUE(contributor_id, grantee_user_id): one row per relationship, so a
--    second ask cannot shadow an approval and an approval cannot be duplicated.
--
-- 2. payment_share_links: a LINK the contributor hands out. Minted from an
--    invoice in the admin (one per invoice, so the same order always shares
--    the same link and the amount shown is the balance still owed, read live)
--    or from Your Table with no invoice (one per contributor). The token is
--    the capability: a URL that simply opens the pay sheet. It is stored as
--    typed, not hashed, because the invoice list has to print the same link
--    on every read, and the details it unlocks are the ones the contributor
--    chose to publish in payment_methods, which a database leak exposes
--    directly anyway. No "I have a link" step exists: a link is a URL.
--
-- Both tables carry account_id like every table here, with no default: a row
-- that does not say whose shop it belongs to is refused, not guessed.
-- status defaults to 'pending' because a request genuinely starts there; it
-- is a state, not an answer to a question nobody asked.

CREATE TABLE IF NOT EXISTS payment_access_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  grantee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_via TEXT NOT NULL CHECK (granted_via IN ('request', 'link')),
  invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contributor_id, grantee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_access_grants_contributor
  ON payment_access_grants(contributor_id, status, requested_at);
CREATE INDEX IF NOT EXISTS idx_payment_access_grants_grantee
  ON payment_access_grants(grantee_user_id, contributor_id);

CREATE TABLE IF NOT EXISTS payment_share_links (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  invoice_id TEXT,
  token TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT,
  open_count INTEGER NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  last_opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- One link per invoice, and one open link per contributor. Two rows for the
-- same door would be two tokens that mean the same thing, which is the shape
-- that gave this shop four freight rates at once.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_share_links_invoice
  ON payment_share_links(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_share_links_contributor_open
  ON payment_share_links(contributor_id) WHERE invoice_id IS NULL;
