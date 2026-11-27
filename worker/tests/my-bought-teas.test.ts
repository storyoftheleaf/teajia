import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The shop says how much a person bought on each tea they bought (Adrian,
// 2026-11-27), read from their own orders only.

const SECRET = 'my-bought-teas';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function get(db: SqliteD1, userId: string | null) {
  const headers = new Headers();
  if (userId) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, {
      sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: null, platform_role: null,
    })}`);
  }
  return worker.fetch(new Request('https://worker.test/api/me/bought-teas', { headers }),
    { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any);
}

function seed() {
  const db = new SqliteD1('schema');
  databases.push(db);
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  for (const id of ['tia-user', 'sam-user']) {
    db.sqlite.prepare(`INSERT OR IGNORE INTO users (id, email, name, password_hash, role, session_version)
      VALUES (?, ?, ?, 'test', 'user', 0)`).run(id, `${id}@test.dev`, id);
  }
  db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, user_id) VALUES ('cust-tia', 'acc-one', 'Tia', 'tia-user')`).run();
  for (const [id, name, type] of [['p-guogai', 'Guogai Bing', 'Shou'], ['p-menghai', 'Menghai Palace', 'Shou'], ['p-other', 'Other', 'Green']]) {
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type, description) VALUES (?, 'acc-one', ?, ?, 'A story.')`).run(id, name, type);
  }
  const invoice = db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_id, created_at)
    VALUES (?, 'acc-one', ?, ?, 'unpaid', ?, ?)`);
  invoice.run('inv-1', 'TJB-1', 'Paid', 'cust-tia', '2026-11-01 10:00:00');
  invoice.run('inv-2', 'TJB-2', 'Draft', 'cust-tia', '2026-11-27 10:00:00');
  invoice.run('inv-void', 'TJB-3', 'Void', 'cust-tia', '2026-11-20 10:00:00');
  invoice.run('inv-sam', 'TJB-4', 'Paid', null, '2026-11-20 10:00:00');
  const line = db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, 'acc-one', ?, ?, ?, 1)`);
  line.run('l1', 'inv-1', 'p-guogai', 50);
  line.run('l2', 'inv-2', 'p-guogai', 150);
  line.run('l3', 'inv-2', 'p-menghai', 100);
  line.run('l4', 'inv-2', 'p-menghai', 100);
  line.run('l5', 'inv-void', 'p-other', 25);
  line.run('l6', 'inv-sam', 'p-other', 25);
  return db;
}

describe('GET /api/me/bought-teas', () => {
  it('needs an account', async () => {
    expect((await get(seed(), null)).status).toBe(401);
  });

  it('adds up each tea over her own invoices, newest first, leaving out a voided one', async () => {
    const body = await (await get(seed(), 'tia-user')).json() as any;
    const byId = Object.fromEntries(body.teas.map((t: any) => [t.product_id, t]));
    expect(Object.keys(byId).sort()).toEqual(['p-guogai', 'p-menghai']);
    expect(byId['p-guogai']).toMatchObject({ quantity: 200, unit: 'g', last_bought_at: '2026-11-27 10:00:00', invoice_numbers: ['TJB-2', 'TJB-1'] });
    expect(byId['p-menghai']).toMatchObject({ quantity: 200, invoice_numbers: ['TJB-2'] });
    expect(byId['p-guogai'].tea).toMatchObject({ name: 'Guogai Bing', description: 'A story.' });
  });

  it('shows nobody else what she bought', async () => {
    const body = await (await get(seed(), 'sam-user')).json() as any;
    expect(body.teas).toEqual([]);
  });
});
