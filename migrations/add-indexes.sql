-- Migration: Add D1 database indexes for frequently queried columns
-- Run with: wrangler d1 execute teajia-db --file=./migrations/add-indexes.sql

-- Products: public listing (the most-hit endpoint)
CREATE INDEX IF NOT EXISTS idx_products_public_active
  ON products (is_public, status, created_at DESC);

-- Products: vendor lookup
CREATE INDEX IF NOT EXISTS idx_products_vendor
  ON products (vendor_id);

-- Exchange rates: looked up on every product request
-- (small table, but ensures the JOIN is indexed)
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency
  ON exchange_rates (currency);

-- Invoices: customer orders
CREATE INDEX IF NOT EXISTS idx_invoices_customer
  ON invoices (customer_id, created_at DESC);

-- Invoices: status filter (for non-void aggregation)
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices (status);

-- Invoice line items: by invoice
CREATE INDEX IF NOT EXISTS idx_line_items_invoice
  ON invoice_line_items (invoice_id);

-- Invoice line items: by product (for customer tea history)
CREATE INDEX IF NOT EXISTS idx_line_items_product
  ON invoice_line_items (product_id);

-- Events: slug lookup (public endpoint)
CREATE INDEX IF NOT EXISTS idx_events_slug_status
  ON events (slug, status);

-- Events: date-based queries (cron job)
CREATE INDEX IF NOT EXISTS idx_events_date
  ON events (event_date);

-- Event attendees: by event + status (capacity checks, attendee lists)
CREATE INDEX IF NOT EXISTS idx_attendees_event_status
  ON event_attendees (event_id, status);

-- Event attendees: magic token lookup (RSVP pages)
CREATE INDEX IF NOT EXISTS idx_attendees_magic_token
  ON event_attendees (magic_token);

-- Event attendees: duplicate check
CREATE INDEX IF NOT EXISTS idx_attendees_event_phone
  ON event_attendees (event_id, phone_number);

-- Event attendees: waitlist ordering
CREATE INDEX IF NOT EXISTS idx_attendees_waitlist
  ON event_attendees (event_id, status, waitlist_position ASC);

-- Customers: phone/WhatsApp lookup (golden tier detection)
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp
  ON customers (whatsapp);

-- Users: email lookup (login)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

-- Activity logs: recent-first listing
CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON activity_logs (created_at DESC);

-- Event notifications: by event
CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON event_notifications (event_id);

-- Event tea menu: by event + order
CREATE INDEX IF NOT EXISTS idx_tea_menu_event
  ON event_tea_menu (event_id, brew_order ASC);

-- Event tasting notes: by event
CREATE INDEX IF NOT EXISTS idx_tasting_notes_event
  ON event_tasting_notes (event_id);

-- Event post session: by event
CREATE INDEX IF NOT EXISTS idx_post_session_event
  ON event_post_session (event_id);
