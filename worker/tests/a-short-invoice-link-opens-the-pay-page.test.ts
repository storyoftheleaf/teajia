import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The short invoice link (Adrian, 2026-11-27): teajia.com/i/TJB-00007-<12 of
// the token> stands for the long pay link, worked out from the invoice when it
// is opened. The admin's share link hands out the short one.

const SECRET = 'a-short-invoice-link';
const TOKEN = 'c6c1e92016bf417aa9a221275cf63268';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

async function call(db: SqliteD1, path: string, method = 'GET', userId: string | null = null) {
  const headers = new Headers({ 'X-Teajia-Account': 'acc-one' });
  if (userId) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, {
      sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: 'acc-one', platform_role: null,
    })}`);
  }
  if (method !== 'GET') headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers, body: method === 'GET' ? undefined : '{}' }), env(db));
}

function seed() {
  const db = new SqliteD1('schema');
  databases.push(db);
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  db.sqlite.prepare(`UPDATE accounts SET slug = 'teajia-bali', public_enabled = 1, status = 'active' WHERE id = 'acc-one'`).run();
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, business_name, is_published, links)
    VALUES ('kenji-tanaka', 'acc-one', 'kenji-user', 'Kenji Tanaka', 'Tanaka Tea House', 1, '[]')`).run();
  db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('kenji-tanaka', 'acc-one')`).run();
  db.sqlite.prepare(`INSERT INTO payment_methods (id, contributor_id, account_id, method_type, label, recipient_name, account_identifier, position, is_published)
    VALUES ('pm-1', 'kenji-tanaka', NULL, 'bank_transfer', 'BCA', 'Kenji Tanaka', '123456', 0, 1)`).run();
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_name, sold_by_user_id, display_currency)
    VALUES ('inv-1', 'acc-one', 'TJB-00007', 'Draft', 'unpaid', 'Tia', 'kenji-user', 'USD')`).run();
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
    VALUES ('line-1', 'acc-one', 'inv-1', 'Liu Bao', 1, 291.5)`).run();
  db.sqlite.prepare(`INSERT INTO payment_share_links (id, account_id, contributor_id, invoice_id, token)
    VALUES ('link-1', 'acc-one', 'kenji-tanaka', 'inv-1', ?)`).run(TOKEN);
  return db;
}

describe('the short invoice link', () => {
  it('answers with the long pay link, amount worked out from the invoice', async () => {
    const db = seed();
    const response = await call(db, '/api/public/invoice-links/TJB-00007-c6c1e92016bf');
    expect(response.status).toBe(200);
    const { path } = await response.json() as { path: string };
    const url = new URL(path, 'https://teajia.com');
    expect(url.pathname).toBe('/people/kenji-tanaka/pay');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      account: 'teajia-bali', amount: '291.50', currency: 'USD', reference: 'TJB-00007', t: TOKEN,
    });
  });

  it('still opens the invoice once it is paid, without an amount to send', async () => {
    const db = seed();
    db.sqlite.prepare(`UPDATE invoices SET payment_status = 'paid' WHERE id = 'inv-1'`).run();
    const response = await call(db, '/api/public/invoice-links/TJB-00007-c6c1e92016bf');
    expect(response.status).toBe(200);
    const url = new URL((await response.json() as { path: string }).path, 'https://teajia.com');
    expect(url.searchParams.get('t')).toBe(TOKEN);
    expect(url.searchParams.get('reference')).toBe('TJB-00007');
  });

  it('needs both halves to match', async () => {
    const db = seed();
    expect((await call(db, '/api/public/invoice-links/TJB-00007-c6c1e92016be')).status).toBe(404);
    expect((await call(db, '/api/public/invoice-links/TJB-00008-c6c1e92016bf')).status).toBe(404);
    expect((await call(db, '/api/public/invoice-links/TJB-00007-c6c1')).status).toBe(404);
  });

  it('is the link the admin share button hands out', async () => {
    const db = seed();
    const response = await call(db, '/api/invoices/inv-1/pay-link', 'POST', 'kenji-user');
    expect(response.status).toBe(200);
    expect((await response.json() as { url: string }).url).toBe('https://teajia.com/i/TJB-00007-c6c1e92016bf');
  });
});
