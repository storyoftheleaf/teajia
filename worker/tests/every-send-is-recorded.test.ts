import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { collectionSendRecord, invoiceSendRecord, listSends, recordLinkSignal } from '../src/sendRecords';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Every invoice and collection link the shop sends is a record of what the
// person did with it (Adrian, 2026-11-28): opened, which teas, saved, tasted,
// ordered, paid. The shop's own looks never count as the friend's.

const SECRET = 'send-record-secret';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`
    INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES ('daniel', 'daniel@test.dev', 'Daniel', 'x', 'user', 0);
    INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES ('tia', 'tia@test.dev', 'Tia', 'x', 'user', 0);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, stock_grams, status)
      VALUES ('liu-bao', 'shop', 'Dark', 'San He Liu Bao', 'Loose', 20, 'USD', 500, 'Active'),
             ('y562', 'shop', 'Shou', 'Y562', 'Loose', 20, 'USD', 500, 'Active');
    INSERT INTO collections (id, account_id, title, status) VALUES ('col', 'shop', 'Daniel''s samples', 'active');
    INSERT INTO collection_items (id, collection_id, product_id, position, recommended_quantity, recommended_price_usd)
      VALUES ('ci1', 'col', 'liu-bao', 1, '10', 0), ('ci2', 'col', 'y562', 2, '10', NULL);
    INSERT INTO collection_publications (id, collection_id, target_type, slug, recipients_json, created_by_user_id, view_count)
      VALUES ('pub', 'col', 'person', 'daniels-samples-ab12', '[{"name":"Daniel"}]', 'owner', 4);
    INSERT INTO customers (id, account_id, name, user_id) VALUES ('cust-tia', 'shop', 'Tia', 'tia');
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, status, payment_status, shipping_cost_usd, created_at)
      VALUES ('inv', 'shop', 'TJB-00007', 'Tia', 'cust-tia', 'Draft', 'unpaid', 0, '2026-11-27 05:00:00');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale, quantity_unit)
      VALUES ('l1', 'shop', 'inv', 'liu-bao', NULL, 100, 1.5, 'g'),
             ('l2', 'shop', 'inv', 'y562', NULL, 100, 1.415, 'g'),
             ('l3', 'shop', 'inv', NULL, 'Discount 10%', 1, -29.15, 'g');
    INSERT INTO invoice_payments (id, invoice_id, account_id, amount_usd, status, claimed_by, method_label)
      VALUES ('pay', 'inv', 'shop', 262.35, 'claimed', 'customer', 'Wise');
    INSERT INTO user_favorites (user_id, account_id, item_id) VALUES ('daniel', 'shop', 'y562'), ('stranger', 'shop', 'y562');
    INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id) VALUES ('j1', 'shop', 'tia', 'liu-bao');
  `);
  return db;
}

const env = (db: SqliteD1) => ({ DB: db, JWT_SECRET: SECRET }) as never;
async function post(db: SqliteD1, path: string, body: unknown, userId?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' };
  if (userId) headers.Authorization = `Bearer ${await signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, role: 'user' })}`;
  return worker.fetch(new Request(`https://app.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), env(db), {} as never);
}

describe('a collection link is recorded', () => {
  it('records the friend opening it and a tea, keeps the shop apart, and joins their save', async () => {
    const db = seed();
    expect((await post(db, '/api/public/c/daniels-samples-ab12/view', {}, 'daniel')).status).toBe(200);
    expect((await post(db, '/api/public/c/daniels-samples-ab12/view', {}, 'owner')).status).toBe(200);
    await post(db, '/api/public/link-tea-opened', { kind: 'collection', slug: 'daniels-samples-ab12', tea: 'y562' }, 'daniel');
    // Opening it again at once counts once; a tea not on the link is not recorded.
    await post(db, '/api/public/link-tea-opened', { kind: 'collection', slug: 'daniels-samples-ab12', tea: 'y562' }, 'daniel');
    await post(db, '/api/public/link-tea-opened', { kind: 'collection', slug: 'daniels-samples-ab12', tea: 'not-on-it' }, 'daniel');

    const record = await collectionSendRecord({ DB: db } as never, 'shop', 'pub');
    expect(record).toMatchObject({ title: "Daniel's samples", to: 'Daniel', live: true });
    expect(record!.opens).toMatchObject({ times: 1, signed_in: ['Daniel'], by_you: 1, counted_before: { times: 6 } });
    const y562 = record!.teas.find(t => t.product_id === 'y562')!;
    expect(y562).toMatchObject({ times_opened: 1, saved_by: ['Daniel'], price_usd: null });
    expect(record!.teas.find(t => t.product_id === 'liu-bao')).toMatchObject({ times_opened: 0, price_usd: 0 });
  });

  it('counts an order whose cart came from the link', async () => {
    const db = seed();
    db.sqlite.exec(`
      INSERT INTO invoices (id, account_id, invoice_number, customer_name, status, payment_status) VALUES ('ord', 'shop', 'TJB-00009', 'Daniel', 'Draft', 'unpaid');
      INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('o1', 'shop', 'ord', 'liu-bao', 50, 0.4);
      INSERT INTO inquiries (id, account_id, items, converted_invoice_id) VALUES ('q', 'shop', '[{"id":"liu-bao","collectionSlug":"daniels-samples-ab12"}]', 'ord');
    `);
    const record = await collectionSendRecord({ DB: db } as never, 'shop', 'pub');
    expect(record!.orders).toEqual([expect.objectContaining({ invoice_number: 'TJB-00009', total_usd: 20 })]);
    expect(record!.teas.find(t => t.product_id === 'liu-bao')!.ordered).toBe(true);
  });
});

describe('an invoice is recorded', () => {
  it('carries its teas, discount and payments, and the buyer tasting', async () => {
    const db = seed();
    await recordLinkSignal({ DB: db } as never, { accountId: 'shop', link: { kind: 'invoice', invoiceId: 'inv' }, signal: 'opened', viewerUserId: null, visitorKey: 'a:1', bySender: false });
    await recordLinkSignal({ DB: db } as never, { accountId: 'shop', link: { kind: 'invoice', invoiceId: 'inv' }, signal: 'tea_opened', productId: 'liu-bao', viewerUserId: null, visitorKey: 'a:1', bySender: false });
    const record = await invoiceSendRecord({ DB: db } as never, 'shop', 'inv');
    expect(record).toMatchObject({ title: 'TJB-00007', to: 'Tia', kept_by: [{ name: 'Tia' }] });
    expect(record!.money).toMatchObject({ subtotal_usd: 291.5, discount_percent: 10, discount_usd: 29.15, total_usd: 262.35, claimed_usd: 262.35, paid_usd: 0 });
    expect(record!.teas).toHaveLength(2);
    expect(record!.teas[0]).toMatchObject({ name: 'San He Liu Bao', amount: '100g', times_opened: 1, tasted_by: [expect.objectContaining({ name: 'Tia' })] });
    expect(record!.opens.times).toBe(1);
  });

  it('lists every send, newest first, with past sends included', async () => {
    const db = seed();
    const sends = await listSends({ DB: db } as never, 'shop');
    expect(sends.map(s => s.title).sort()).toEqual(["Daniel's samples", 'TJB-00007']);
    expect(sends.find(s => s.kind === 'collection')).toMatchObject({ to: 'Daniel', counted_before: 4, teas: 2 });
    expect(sends.find(s => s.kind === 'invoice')).toMatchObject({ to: 'Tia', total_usd: 262.35 });
  });

  it('is read by the shop only', async () => {
    const db = seed();
    const get = async (userId: string) => worker.fetch(new Request('https://app.test/api/admin/sends/invoice/inv', {
      headers: { Authorization: `Bearer ${await signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, role: 'user' })}`, 'X-Teajia-Account': 'shop' },
    }), env(db), {} as never);
    expect((await get('owner')).status).toBe(200);
    expect((await get('daniel')).status).not.toBe(200);
  });
});
