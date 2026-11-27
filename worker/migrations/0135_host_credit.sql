-- Launch 5, M1: tea credit for hosts
-- (todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 1, and
-- "Credit is held securely"). Columns and new tables only. No existing row is
-- changed, and order_session_sources is left exactly as Launch 1 made it.

-- The two terms of the rule, per shop. NULL means follow the defaults in
-- src/lib/hostCredit.ts; a number, zero included, is obeyed. Read when used,
-- never copied into the ledger. The ceiling is in US dollars.
ALTER TABLE accounts ADD COLUMN host_credit_percent REAL;
ALTER TABLE accounts ADD COLUMN host_credit_order_ceiling_usd REAL;

-- The credit ledger. Rows are only ever added. A balance is never stored: it
-- is earned less reversed less spent, per host, shop and currency, less what
-- open spend requests hold.
--
-- 'pending':  written when an order that began from a host's thank-you comes
--             in, one per eligible tea line. Not part of any balance.
-- 'earned':   written only once the order is Filled (by hand) and fully paid,
--             one per line, worked out again from the stored line. An order
--             over the shop's ceiling stays pending until the owner approves.
-- 'reversed': one per earned line, when the order is made Void.
-- 'spent':    one per approved spend request, written only by the owner's
--             approval, in one guarded statement.
-- amount is always positive; kind says which way it moves.
CREATE TABLE IF NOT EXISTS host_credit_entries (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL,
  host_user_id      TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('pending','earned','reversed','spent')),
  amount            REAL NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL CHECK (length(currency) = 3 AND currency != 'UNK'),
  source_inquiry_id TEXT,
  event_id          TEXT,
  invoice_id        TEXT,
  invoice_line_id   TEXT,
  product_id        TEXT,
  basis_quantity    REAL,
  basis_unit_price  REAL,
  basis_amount      REAL,
  basis_currency    TEXT,
  reverses_entry_id TEXT REFERENCES host_credit_entries(id),
  spend_request_id  TEXT,
  reason            TEXT,
  created_by        TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (kind NOT IN ('pending','earned') OR (source_inquiry_id IS NOT NULL AND event_id IS NOT NULL
    AND invoice_id IS NOT NULL AND invoice_line_id IS NOT NULL
    AND basis_amount > 0 AND basis_currency IS NOT NULL AND basis_currency = currency)),
  CHECK (kind != 'reversed' OR (reverses_entry_id IS NOT NULL AND invoice_line_id IS NOT NULL AND reason IS NOT NULL)),
  CHECK (kind != 'spent' OR (spend_request_id IS NOT NULL AND invoice_id IS NOT NULL))
);
-- One order line earns once: a unique key on line and kind.
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_credit_line_kind
  ON host_credit_entries(invoice_line_id, kind) WHERE kind IN ('pending','earned','reversed');
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_credit_reversed_once
  ON host_credit_entries(reverses_entry_id) WHERE kind = 'reversed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_credit_spent_once
  ON host_credit_entries(spend_request_id) WHERE kind = 'spent';
CREATE INDEX IF NOT EXISTS idx_host_credit_host ON host_credit_entries(host_user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_host_credit_account ON host_credit_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_host_credit_invoice ON host_credit_entries(invoice_id);

-- A host's request to use credit on an order to the shop. While 'held' it
-- holds its amount out of the balance; it leaves the balance only when the
-- owner approves it in Manage, which writes the 'spent' ledger row.
CREATE TABLE IF NOT EXISTS host_credit_spend_requests (
  id                 TEXT PRIMARY KEY,
  account_id         TEXT NOT NULL,
  host_user_id       TEXT NOT NULL,
  invoice_id         TEXT NOT NULL,
  amount             REAL NOT NULL CHECK (amount > 0),
  currency           TEXT NOT NULL CHECK (length(currency) = 3 AND currency != 'UNK'),
  status             TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','approved','declined')),
  requested_at       TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by_user_id TEXT,
  decided_at         TEXT,
  over_ceiling       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_host_credit_requests_host
  ON host_credit_spend_requests(host_user_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_host_credit_requests_account
  ON host_credit_spend_requests(account_id, status, requested_at);
