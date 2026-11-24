import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formalSessionCardsFor, formalSessionRecap, placeGuestItems } from '../src/publicSessions';
import { isForSale, type PublicProductReader } from '../src/sessionTeas';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const D1 = () => db as unknown as D1Database;

// Mirrors the shop's public catalogue door: public, shown, Active or Sold Out, in a public store.
const readPublic: PublicProductReader = async (accountId, productId) => db.sqlite.prepare(
  `SELECT p.id, p.slug, p.status, p.stock_grams,
     p.personal_offer_pack_price_usd AS exact_pack_price_usd,
     CASE WHEN p.personal_offer_pack_price_usd IS NULL THEN 0.5 END AS retail_price_per_gram_usd
   FROM products p JOIN accounts a ON a.id = p.account_id AND a.public_enabled = 1 AND a.status = 'active'
   WHERE p.account_id = ? AND p.id = ? AND p.is_public = 1 AND p.shown_in_shop = 1
     AND p.status IN ('Active', 'Sold Out') AND p.personal_offer_withdrawn_at IS NULL`,
).get(accountId, productId) as Record<string, unknown> | null ?? null;

const served = [
  { id: 't-offer', name: 'Spring Mountain oolong', source: 'shop', product_id: 'offer-sku' },
  { id: 't-shop', name: 'San He Liu Bao', source: 'shop', product_id: 'shop-tea' },
  { id: 't-draft', name: 'Roasted oolong', source: 'shop', product_id: 'draft-tea' },
  { id: 't-name', name: 'Spring Shui Xian', source: 'session' },
];

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'mei', accountId: 'shop', accountSlug: 'teajia-bali' });
  seedIdentity(db, { userId: 'mei', accountId: 'chest', accountSlug: 'mei-chest' });
  for (const user of ['ana', 'tomas', 'lee', 'kim']) seedIdentity(db, { userId: user, accountId: 'shop' });
  db.exec(`
    UPDATE accounts SET personal_inventory_user_id = 'mei', owner_user_id = 'mei' WHERE id = 'chest';
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published) VALUES ('mei-lin', 'shop', 'mei', 'Mei Lin', 1);
    INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('mei-lin', 'shop');
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('sit', 'shop', 'courtyard', 'Tea in the courtyard', '2026-11-23', 'completed', 'public', 'published');
    INSERT INTO event_post_session (event_id, account_id, session_notes, tea_ledger)
    VALUES ('sit', 'shop', 'We stayed until the light went.', '${JSON.stringify({ served_teas: served })}');
    INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public)
    VALUES ('credit', 'sit', 'shop', 'mei-lin', 'lead_host', 1);
    INSERT INTO sit_profile_placements (account_id, event_id, contributor_id, role) VALUES ('shop', 'sit', 'mei-lin', 'lead_host');

    INSERT INTO products (id, account_id, type, product_name, year, origin_country, origin_region, is_public, shown_in_shop, status,
      stock_grams, cost_amount, cost_currency, personal_offer_source_id, personal_offer_pack_price_usd)
    VALUES
      ('holding', 'chest', 'Oolong', 'Spring Mountain oolong', 2025, 'Taiwan', NULL, 0, 0, 'Active', 500, 10, 'USD', NULL, NULL),
      ('offer-sku', 'chest', 'Oolong', 'Spring Mountain oolong', 2025, 'Taiwan', NULL, 1, 1, 'Active', 50, 10, 'USD', 'holding', 25),
      ('shop-tea', 'shop', 'Dark', 'San He Liu Bao', 1995, 'China', 'Wuzhou, Guangxi', 1, 1, 'Active', 800, 10, 'USD', NULL, NULL),
      ('draft-tea', 'shop', 'Oolong', 'Roasted oolong', 2019, 'Taiwan', NULL, 0, 0, 'Draft', 300, 10, 'USD', NULL, NULL);

    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, user_id, magic_token, status, attended) VALUES
      ('seat-ana', 'shop', 'sit', 'Ana Ramos', 'ana@test.dev', 'ana', 'tok-ana', 'confirmed', 1),
      ('seat-tomas', 'shop', 'sit', 'Tomas Berg', 'tomas@test.dev', 'tomas', 'tok-tomas', 'confirmed', 1),
      ('seat-lee', 'shop', 'sit', 'Lee Park', 'lee@test.dev', 'lee', 'tok-lee', 'confirmed', 1),
      ('seat-kim', 'shop', 'sit', 'Kim Wu', 'kim@test.dev', 'kim', 'tok-kim', 'confirmed', 1);
    INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at) VALUES
      ('shop', 'ana', 'sit', 'Tea in the courtyard', '2026-11-23', '[]', '2026-11-23'),
      ('shop', 'tomas', 'sit', 'Tea in the courtyard', '2026-11-23', '[]', '2026-11-23');
    INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at) VALUES
      ('shop', 'ana', 'sit', 'ana-photo', 't-shop', 'k/ana.jpg', '2026-11-23'),
      ('shop', 'tomas', 'sit', 'tomas-photo', NULL, 'k/tomas.jpg', '2026-11-23');
    INSERT INTO session_guest_book_photos (id, account_id, event_id, attendee_id, user_id, photo_id, alt_text, status, offered_at) VALUES
      ('g-ana', 'shop', 'sit', 'seat-ana', 'ana', 'ana-photo', 'Photo of San He Liu Bao', 'included', '2026-11-23'),
      ('g-tomas', 'shop', 'sit', 'seat-tomas', 'tomas', 'tomas-photo', 'Photo of the tea setup', 'pending', '2026-11-23');
    INSERT INTO sit_photo_public_permissions (id, account_id, user_id, event_id, photo_id, attendee_id, audience, credit, offered_at) VALUES
      ('perm-ana', 'shop', 'ana', 'sit', 'ana-photo', 'seat-ana', 'public_recap', 'Ana', '2026-11-23'),
      ('perm-tomas', 'shop', 'tomas', 'sit', 'tomas-photo', 'seat-tomas', 'public_recap', 'Tomas', '2026-11-23');
    INSERT INTO session_guest_book (id, account_id, event_id, attendee_id, user_id, note, status, updated_at, tea_id, public_recap) VALUES
      ('n-ana', 'shop', 'sit', 'seat-ana', 'ana', 'The second cup was where it turned.', 'included', '2026-11-23', 't-offer', 1),
      ('n-tomas', 'shop', 'sit', 'seat-tomas', 'tomas', 'Only for the guests.', 'included', '2026-11-23', 't-shop', 0),
      ('n-lee', 'shop', 'sit', 'seat-lee', 'lee', 'Not chosen by the host.', 'passed', '2026-11-23', NULL, 1),
      ('n-kim', 'shop', 'sit', 'seat-kim', 'kim', 'Thank you for the quiet.', 'included', '2026-11-23', 'not-on-this-sit', 1);
  `);
});
afterEach(() => db.close());

describe('poured teas as records', () => {
  it('carries a price only for a tea its owner marked for sale', async () => {
    const recap = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    const [offer, shop, draft] = recap.teas;
    expect(offer).toMatchObject({ kind: 'tea', name: 'Spring Mountain oolong', year: '2025', type: 'Oolong', place: 'Taiwan',
      href: '/shop/product/offer-sku?store=mei-chest', offer: { store: 'mei-chest', count: 'pack' } });
    expect(shop).toMatchObject({ kind: 'tea', year: '1995', place: 'Wuzhou, Guangxi, China', offer: { count: 'weigh', store: 'teajia-bali' } });
    // Not for sale: the same record, with no price field at all and no page.
    expect(draft).toEqual({ kind: 'tea', id: 't-draft', name: 'Roasted oolong', href: null, year: '2019', type: 'Oolong', place: 'Taiwan', items: [] });
    expect(JSON.stringify(draft)).not.toMatch(/price|offer/);

    // A withdrawn personal offer and a sold-out shop tea stop carrying a price.
    db.exec("UPDATE products SET personal_offer_withdrawn_at = '2026-11-24' WHERE id = 'offer-sku'");
    db.exec("UPDATE products SET stock_grams = 0, status = 'Sold Out' WHERE id = 'shop-tea'");
    const later = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    expect(later.teas[0]).not.toHaveProperty('offer');
    expect(later.teas[1]).not.toHaveProperty('offer');
    expect(later.teas[1]).toMatchObject({ href: '/shop/product/shop-tea?store=teajia-bali' });
  });

  it('keeps a typed name as the name only, aligned with the rest', async () => {
    const recap = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    expect(recap.teas[3]).toEqual({ kind: 'name', id: 't-name', name: 'Spring Shui Xian', items: [] });
  });

  it('never resolves a product from an unrelated account', async () => {
    seedIdentity(db, { userId: 'stranger', accountId: 'other-shop' });
    db.exec(`INSERT INTO products (id, account_id, type, product_name, is_public, shown_in_shop, status, stock_grams, cost_amount, cost_currency)
      VALUES ('foreign', 'other-shop', 'Red', 'Someone else', 1, 1, 'Active', 100, 1, 'USD')`);
    db.exec(`UPDATE event_post_session SET tea_ledger = '${JSON.stringify({ served_teas: [{ id: 'x', name: 'Borrowed', source: 'shop', product_id: 'foreign' }] })}'`);
    const recap = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    expect(recap.teas).toEqual([{ kind: 'name', id: 'x', name: 'Borrowed', items: [] }]);
  });

  it('does not treat a stale or unpriced listing as for sale', () => {
    expect(isForSale({ status: 'Active', stock_grams: 50, retail_price_per_gram_usd: 0.4 })).toBe(true);
    expect(isForSale({ status: 'Active', stock_grams: 50, orders_paused: true, retail_price_per_gram_usd: 0.4 })).toBe(false);
    expect(isForSale({ status: 'Active', stock_grams: 50 })).toBe(false);
    expect(isForSale(null)).toBe(false);
  });
});

describe('who sees what on the public recap', () => {
  it('shows only items the host included and the guest agreed to make public', async () => {
    const recap = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    const everything = JSON.stringify(recap);
    expect(everything).toContain('The second cup was where it turned.');
    expect(everything).toContain('Thank you for the quiet.');
    expect(everything).not.toContain('Only for the guests.'); // included, but no public yes
    expect(everything).not.toContain('Not chosen by the host.'); // passed
    expect(everything).not.toContain('tomas-photo'); // pending photo
    expect(everything).not.toContain('perm-tomas');
    expect(everything).not.toContain('Ramos'); // guests sign with their first name
  });

  it('places a guest note and photograph under the tea they name, and the rest at the table', async () => {
    const recap = (await formalSessionRecap(D1(), readPublic, 'courtyard'))!;
    expect(recap.teas[0].items).toEqual([{ kind: 'note', text: 'The second cup was where it turned.', by: { name: 'Ana', part: 'guest' } }]);
    expect(recap.teas[1].items).toEqual([{ kind: 'photo', src: '/api/public/sit-recaps/courtyard/photos/perm-ana',
      alt: 'Photo of San He Liu Bao', by: { name: 'Ana', part: 'guest' } }]);
    expect(recap.guestBook).toEqual([{ text: 'Thank you for the quiet.', by: { name: 'Kim', part: 'guest' } }]);
    expect(placeGuestItems([], [], [{ teaMenuId: 't-x', note: { text: 'n', by: { name: 'A', part: 'guest' } } }]).guestBook).toHaveLength(1);
  });

  it('gives the profile card the person’s part, the host, and poured teas', async () => {
    const [card] = await formalSessionCardsFor(D1(), readPublic, 'mei-lin');
    expect(card).toMatchObject({ slug: 'courtyard', role: 'lead_host', people: [{ slug: 'mei-lin', name: 'Mei Lin', role: 'lead_host' }],
      note: { text: 'We stayed until the light went.', by: { name: 'Mei Lin', part: 'host', slug: 'mei-lin' } } });
    expect(card.teas.map(tea => tea.kind)).toEqual(['tea', 'tea', 'tea', 'name']);
    expect(card.photos).toEqual({ small: [expect.objectContaining({ src: '/api/public/sit-recaps/courtyard/photos/perm-ana' })], more: 0 });
    db.exec("UPDATE events SET recap_status = 'draft' WHERE id = 'sit'");
    expect(await formalSessionCardsFor(D1(), readPublic, 'mei-lin')).toEqual([]);
  });
});
