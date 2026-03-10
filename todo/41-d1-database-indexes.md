# TODO 41: Add D1 Database Indexes for Frequently Queried Columns

**Priority:** P0 — CRITICAL
**Impact:** Query latency reduction across every endpoint (estimated 2-10x on filtered queries)
**Effort:** Low (1 hour to write, deploy via wrangler d1 execute)

## Problem

The D1 database has **zero indexes** beyond primary keys. Every filtered query does a full table scan. With 139+ products, growing invoices, customers, events, and attendees, this is the single biggest source of backend latency.

### Affected Queries (every request hits at least one)

| Query Pattern | Endpoint | Scan Type |
|---|---|---|
| `WHERE is_public = 1 AND status = 'Active'` | `/api/products/public` | Full table scan on products |
| `WHERE customer_id = ?` | invoices, customer orders | Full table scan on invoices |
| `WHERE invoice_id = ?` | invoice line items | Full table scan on line items |
| `WHERE slug = ? AND status = 'active'` | `/api/events/:slug/public` | Full table scan on events |
| `WHERE event_id = ? AND status = 'confirmed'` | RSVP capacity checks | Full table scan on attendees |
| `WHERE magic_token = ?` | `/api/rsvp/:token` | Full table scan on attendees |
| `WHERE event_id = ? AND phone_number = ?` | duplicate RSVP check | Full table scan on attendees |
| `WHERE phone = ? OR whatsapp = ?` | golden tier detection | Full table scan on customers |
| `WHERE email = ?` | login, signup | Full table scan on users |
| `WHERE vendor_id = ?` | vendor products | Full table scan on products |

## Solution

Add targeted indexes for every hot query path. Run via `wrangler d1 execute`.

```sql
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
```

## Deployment

```bash
# Save the above SQL to a file, then:
wrangler d1 execute teajia-db --file=./migrations/add-indexes.sql
```

## Verification

After deploying, check with:
```sql
SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name;
```

## Notes

- SQLite indexes are lightweight — they speed up reads with minimal write overhead
- The product table is the highest-traffic: indexed `is_public + status` filter eliminates full scans on every public page load
- `magic_token` index is critical — every RSVP page view currently scans the entire attendees table
- D1 doesn't support `EXPLAIN QUERY PLAN` via wrangler yet, but you can verify locally with `sqlite3`
