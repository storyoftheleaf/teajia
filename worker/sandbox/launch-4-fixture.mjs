// Launch 4: what the browser journey (tests/launch-4.spec.ts) needs to find
// already in the offline fixture shop. Fabricated data only.
//
// Builds on the first table (mei / mei, Bali's teas, its published article)
// and the few hosts fixture (ana / ana, an approved host who has hosted).
//   - mei has a saved tasting of "Old tree white, test" that she has not
//     shared, so the journey can put it on the Tea Table from her journal.
//   - jun / jun has a published family page and a tasting of "Mountain red,
//     test" already on the Tea Table, for the platform owner to hide.
//   - A published network recap in Bali, "Autumn oolongs, a test recap"
//     (event l4-recap), whose lead host is the sandbox operator, not yet on the
//     Tea Table: the operator puts it on and holds it from its Manage page.
//   - lin / lin is a tea master with a published page (/people/l4-lin), for
//     top teas.
//   - "Garden House, test" (l4-house) is a public tea house with one public
//     tea, for Visit and for the operator's portfolio words.
//   - ana keeps one place, "Ana's courtyard", for "Add your table".
// Every Launch 4 route stays closed unless the worker starts with its switch on.
import { createHash } from 'node:crypto';

const BALI = 'acc_teajia_bali';
const sha = value => createHash('sha256').update(value).digest('hex');

export const launch4 = {
  mei: { id: 'ft-user-mei', email: 'mei@sandbox.test', journal: 'l4-journal-mei', tea: 'ft-tea-white', teaName: 'Old tree white, test' },
  jun: { id: 'l4-user-jun', username: 'jun', password: 'jun', email: 'jun@sandbox.test', name: 'Jun Taster', page: 'l4-jun',
    journal: 'l4-journal-jun', tea: 'ft-tea-red', teaName: 'Mountain red, test' },
  lin: { id: 'l4-user-lin', username: 'lin', password: 'lin', email: 'lin@sandbox.test', name: 'Lin Pourer', page: 'l4-lin' },
  recap: { id: 'l4-recap', slug: 'l4-autumn-oolongs', title: 'Autumn oolongs, a test recap' },
  house: { id: 'l4-house', slug: 'l4-garden-house', name: 'Garden House, test', tea: 'l4-house-tea' },
  place: { id: 'l4-place-ana', name: 'Ana’s courtyard' },
};

const l = launch4;
const sittings = (id, note, at) => JSON.stringify([{ id, createdAt: at, tasting: { notes: [note] } }]);

export const launch4Statements = [
  // mei's saved tasting, private for now.
  `INSERT INTO customer_tasting_journal (id, user_id, product_id, product_name, product_type, tastings, created_at)
   VALUES ('${l.mei.journal}', '${l.mei.email}', '${l.mei.tea}', '${l.mei.teaName}', 'White',
     '${sittings('l4-sit-mei', 'Honey on the lid, then hay', '2026-11-20T08:00:00Z')}', datetime('now', '-2 days'))`,
  // jun, with a family page and a tasting already on the Tea Table.
  `INSERT INTO users (id, email, name, password_hash, role, username, session_version, email_verified_at, created_at)
   VALUES ('${l.jun.id}', '${l.jun.email}', '${l.jun.name}', '${sha(l.jun.password)}', 'user', '${l.jun.username}', 0,
     datetime('now'), datetime('now'))`,
  `INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
   VALUES ('${l.jun.page}', '${BALI}', '${l.jun.id}', '${l.jun.name}', 1, 'family', '[]')`,
  `INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('${l.jun.page}', '${BALI}')`,
  `INSERT INTO customer_tasting_journal (id, user_id, product_id, product_name, product_type, tastings, created_at)
   VALUES ('${l.jun.journal}', '${l.jun.email}', '${l.jun.tea}', '${l.jun.teaName}', 'Red',
     '${sittings('l4-sit-jun', 'Malt and a little smoke', '2026-11-18T08:00:00Z')}', datetime('now', '-5 days'))`,
  `INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at,
     updated_at, tea_table_at, tea_table_sittings)
   VALUES ('${l.jun.journal}', '${BALI}', '${l.jun.tea}', '${l.jun.id}', 'page', datetime('now', '-4 days'),
     datetime('now', '-4 days'), datetime('now', '-4 days'), '["l4-sit-jun"]')`,
  // A published network recap, hosted by the sandbox operator through the first table's host page (ft-host).
  `INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, total_capacity, timezone,
     public_visibility, recap_status, network_discovery)
   VALUES ('${l.recap.id}', '${BALI}', '${l.recap.slug}', '${l.recap.title}', date('now', '-6 days'), 'closed', 'completed',
     8, 'Asia/Makassar', 'public', 'published', 1)`,
  `INSERT INTO event_post_session (id, account_id, event_id, session_notes)
   VALUES ('l4-recap-post', '${BALI}', '${l.recap.id}', 'Three autumn oolongs, the last one roasted twice.')`,
  `INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
   VALUES ('l4-recap-host', '${BALI}', '${l.recap.id}', 'ft-host', 'lead_host', 0)`,
  // lin, a tea master with a published page.
  `INSERT INTO users (id, email, name, password_hash, role, username, session_version, email_verified_at, created_at)
   VALUES ('${l.lin.id}', '${l.lin.email}', '${l.lin.name}', '${sha(l.lin.password)}', 'user', '${l.lin.username}', 0,
     datetime('now'), datetime('now'))`,
  `INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links, portrait_url)
   VALUES ('${l.lin.page}', '${BALI}', '${l.lin.id}', '${l.lin.name}', 1, 'master', '[]', NULL)`,
  `INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('${l.lin.page}', '${BALI}')`,
  // A public tea house with one public tea.
  `INSERT INTO accounts (id, slug, name, kind, status, public_enabled, location_city, location_country, invoice_prefix)
   VALUES ('${l.house.id}', '${l.house.slug}', '${l.house.name}', 'location', 'active', 1, 'Ubud', 'Indonesia', 'GDN')`,
  `INSERT INTO products (id, account_id, slug, type, product_name, status, is_public, shown_in_shop, catalog_visible,
     stock_grams, cost_amount, cost_currency, fixed_retail_price_usd)
   VALUES ('${l.house.tea}', '${l.house.id}', 'l4-garden-green', 'Green', 'Garden green, test', 'Active', 1, 1, 1,
     200, 60, 'Yuan', 0.3)`,
  // ana's one kept place.
  `INSERT INTO saved_locations (id, name, address, map_link, account_id)
   VALUES ('${l.place.id}', '${l.place.name}', 'Jalan Courtyard 4, Ubud', NULL, 'fh-account-ana')`,
];
