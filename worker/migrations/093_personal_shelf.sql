-- Migration 093: Standalone public shelf (stock spine step 5)
--
-- The top of the spine: a person NOT on any location's team makes their own
-- personal cellar (step 4) public at their own link (/u/<slug>), with Adrian's
-- permission. Private-by-default still holds — public requires a platform-owner
-- grant. The buyer deals with the seller directly over WhatsApp; Teajia never
-- takes the order or holds the money (no platform checkout, no payout, no split).
--
-- SHELF-FIRST (locked): a clean shelf — the seller's tea + a direct WhatsApp
-- order — and nothing else. A bio/profile is a later polish, out of scope.
--
-- Grant + identity live on users:
--   shelf_enabled  — platform-owner grant; 0 by default (private-by-default)
--   shelf_slug     — the public URL segment (/u/<slug>), unique where present
--   shelf_title    — optional heading for the shelf (the seller sets it)
--   shelf_whatsapp — the seller's own WhatsApp number for direct orders
-- Which ITEMS appear is personal_cellar_items.shelf_published (added in 092).

ALTER TABLE users ADD COLUMN shelf_enabled  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN shelf_slug     TEXT;
ALTER TABLE users ADD COLUMN shelf_title    TEXT;
ALTER TABLE users ADD COLUMN shelf_whatsapp TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shelf_slug ON users(shelf_slug) WHERE shelf_slug IS NOT NULL;
