// The first table: one finished session every Launch 1 worker reuses.
// (todo/plans/guests-and-tea-masters-launch-1-run.md, "Stand up a test table".)
//
// Fabricated data only, for the offline fixture shop. In the Bali sandbox shop:
//   - a completed session "First table, a test sit" (slug first-table-test) with
//     three teas on its menu: a public tea for sale, a public tea not for sale
//     (no stock), and a plain name with no record; a playlist link; a host note.
//   - two confirmed guests marked attended. "Mei Guest" is linked to a signed-in
//     user (mei / mei); "Sol Walker" has no account.
//   - each guest has a fixed after-sit link (below), valid for a year.
//   - one paid website order for mei: 50 g of the tea for sale and one teapot.
//   - one published article to pick as the session's reading, and one draft.
// The after-sit links are sandbox secrets printed here on purpose; open
// http://127.0.0.1:7777/after-sit#<credential>.
import { createHash } from 'node:crypto';

const BALI = 'acc_teajia_bali';
const sha = value => createHash('sha256').update(value).digest('hex');

export const firstTable = {
  eventId: 'ft-event',
  eventSlug: 'first-table-test',
  guestUser: { id: 'ft-user-mei', username: 'mei', password: 'mei', email: 'mei@sandbox.test' },
  // 64 hex characters each, the after-sit credential format.
  links: {
    mei: 'f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5',
    sol: '5015015015015015015015015015015015015015015015015015015015015015',
  },
  teas: { forSale: 'ft-menu-1', notForSale: 'ft-menu-2', plainName: 'ft-menu-3' },
  products: { forSale: 'ft-tea-white', notForSale: 'ft-tea-red', teapot: 'ft-teapot' },
  invoiceId: 'ft-invoice-1',
  lines: { tea: 'ft-line-tea', teapot: 'ft-line-teapot' },
  articles: { published: 'ft-article-live', draft: 'ft-article-draft' },
};

const t = firstTable;

export const firstTableStatements = [
  `UPDATE accounts SET public_enabled = 1 WHERE id = '${BALI}'`,
  // The guest who has an account.
  `INSERT INTO users (id, email, name, password_hash, role, username, session_version, email_verified_at, created_at)
   VALUES ('${t.guestUser.id}', '${t.guestUser.email}', 'Mei Guest', '${sha(t.guestUser.password)}', 'user',
     '${t.guestUser.username}', 0, datetime('now'), datetime('now'))`,
  // Three teas: one for sale, one public but not for sale, plus the teapot sold on the order.
  // Money columns named: cost in yuan; a fixed retail price in USD (per gram for tea, per piece for ware).
  `INSERT INTO products (id, account_id, slug, type, product_name, year, origin_country, origin_region,
     status, is_public, shown_in_shop, catalog_visible, stock_grams, quantity_units,
     cost_amount, cost_currency, fixed_retail_price_usd)
   VALUES
   ('${t.products.forSale}', '${BALI}', 'ft-old-tree-white', 'White', 'Old tree white, test', '2019', 'China', 'Fuding',
     'Active', 1, 1, 1, 500, NULL, 120, 'Yuan', 0.5),
   ('${t.products.notForSale}', '${BALI}', 'ft-mountain-red', 'Red', 'Mountain red, test', '2022', 'Taiwan', 'Nantou',
     'Active', 1, 1, 1, 0, NULL, 80, 'Yuan', 0.4),
   ('${t.products.teapot}', '${BALI}', 'ft-small-teapot', 'Teaware', 'Small clay teapot, test', NULL, NULL, NULL,
     'Active', 1, 1, 1, NULL, 3, 200, 'Yuan', 60)`,
  // The session, finished.
  `INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, total_capacity, timezone, playlist_url)
   VALUES ('${t.eventId}', '${BALI}', '${t.eventSlug}', 'First table, a test sit', date('now', '-2 days'),
     'closed', 'completed', 8, 'Asia/Makassar', 'https://music.sandbox.test/first-table')`,
  `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
     ('${t.teas.forSale}', '${BALI}', '${t.eventId}', '${t.products.forSale}', NULL, 1),
     ('${t.teas.notForSale}', '${BALI}', '${t.eventId}', '${t.products.notForSale}', NULL, 2),
     ('${t.teas.plainName}', '${BALI}', '${t.eventId}', NULL, 'Grandmother''s roasted oolong', 3)`,
  `INSERT INTO event_attendee_recaps (event_id, account_id, session_notes)
   VALUES ('${t.eventId}', '${BALI}', 'Thank you for sitting with us. The white opened slowly; the red was the surprise.')`,
  `INSERT INTO event_post_session (id, event_id, account_id, playlist_url, session_notes)
   VALUES ('ft-post', '${t.eventId}', '${BALI}', 'https://music.sandbox.test/first-table', 'A test sit for Launch 1.')`,
  `INSERT INTO event_attendees (id, account_id, event_id, full_name, email, phone_number, magic_token, status, attended, user_id) VALUES
     ('ft-seat-mei', '${BALI}', '${t.eventId}', 'Mei Guest', '${t.guestUser.email}', NULL, 'ft-magic-mei', 'confirmed', 1, '${t.guestUser.id}'),
     ('ft-seat-sol', '${BALI}', '${t.eventId}', 'Sol Walker', 'sol@sandbox.test', NULL, 'ft-magic-sol', 'confirmed', 1, NULL)`,
  `INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at) VALUES
     ('ft-seat-mei', '${t.eventId}', '${BALI}', '${sha(t.links.mei)}', unixepoch() + 365 * 86400),
     ('ft-seat-sol', '${t.eventId}', '${BALI}', '${sha(t.links.sol)}', unixepoch() + 365 * 86400)`,
  // A reading to pick, and a draft that must not be offered.
  `INSERT INTO articles (id, account_id, title, slug, status, published_at) VALUES
     ('${t.articles.published}', '${BALI}', 'Before a white tea', 'ft-before-a-white-tea', 'published', datetime('now')),
     ('${t.articles.draft}', '${BALI}', 'A draft not to offer', 'ft-draft', 'draft', NULL)`,
  // Mei's paid website order: 50 g of the white, one teapot.
  `INSERT INTO customers (id, account_id, name, email, user_id)
   VALUES ('ft-customer-mei', '${BALI}', 'Mei Guest', '${t.guestUser.email}', '${t.guestUser.id}')`,
  `INSERT INTO invoices (id, account_id, invoice_number, customer_id, status, payment_status, payment_date, display_currency, shipping_cost_usd, created_at)
   VALUES ('${t.invoiceId}', '${BALI}', 'FT-0001', 'ft-customer-mei', 'Paid', 'paid', datetime('now', '-1 day'), 'USD', 0, datetime('now', '-1 day'))`,
  `INSERT INTO invoice_line_items (id, invoice_id, account_id, product_id, quantity, quantity_unit, price_at_sale) VALUES
     ('${t.lines.tea}', '${t.invoiceId}', '${BALI}', '${t.products.forSale}', 50, 'g', 0.5),
     ('${t.lines.teapot}', '${t.invoiceId}', '${BALI}', '${t.products.teapot}', 1, 'unit', 60)`,
  `INSERT INTO invoice_payments (id, invoice_id, account_id, amount_usd, currency, status, claimed_by, confirmed_by_user_id, confirmed_at)
   VALUES ('ft-payment-1', '${t.invoiceId}', '${BALI}', 85, 'USD', 'confirmed', 'operator', 'sandbox-operator', datetime('now', '-1 day'))`,
];
