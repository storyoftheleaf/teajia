-- What happens to a link the shop sends (Adrian, 2026-11-28: "Make sure all
-- these invoices and sample sending things are getting saved, monitored and
-- recorded, they're great sources for data").
-- Schema only: no existing row changes.
--
-- The send itself is already recorded: an invoice and its pay link
-- (invoices, payment_share_links), a collection link (collection_publications).
-- What was missing is what the person did with it. One row per moment:
--
--   signal 'opened'      the link was opened.
--   signal 'tea_opened'  a tea on the link was opened (product_id says which).
--
-- viewer_user_id  the signed-in person, when there is one.
-- visitor_key     a short one-way hash that tells visitors on this link apart
--                 when nobody is signed in. It is made per link, so it cannot
--                 follow anyone from one link to another, and the address it
--                 came from is never stored.
-- by_sender       1 when the shop that sent it opened it (a preview), so its
--                 own looks are never counted as the recipient's.
--
-- Saves, tastings, orders and payments are not copied here: they are read
-- from their own tables (user_favorites, customer_tasting_journal, invoices,
-- inquiries, invoice_payments) by worker/src/sendRecords.ts.
CREATE TABLE IF NOT EXISTS link_signals (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  link_kind      TEXT NOT NULL CHECK (link_kind IN ('invoice', 'collection')),
  invoice_id     TEXT,
  publication_id TEXT,
  signal         TEXT NOT NULL CHECK (signal IN ('opened', 'tea_opened')),
  product_id     TEXT,
  viewer_user_id TEXT,
  visitor_key    TEXT NOT NULL,
  by_sender      INTEGER NOT NULL DEFAULT 0 CHECK (by_sender IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((link_kind = 'invoice' AND invoice_id IS NOT NULL) OR (link_kind = 'collection' AND publication_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_link_signals_invoice ON link_signals(invoice_id, created_at) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_signals_publication ON link_signals(publication_id, created_at) WHERE publication_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_signals_account ON link_signals(account_id, created_at);
