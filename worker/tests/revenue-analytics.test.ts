import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'revenue-analytics-test-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner-a', accountId: 'account-a' });
  seedIdentity(db, { userId: 'owner-b', accountId: 'account-b' });
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function getRevenue(db: SqliteD1, accountId = 'account-a', userId = 'owner-a') {
  const token = await signedToken(SECRET, {
    sub: userId,
    email: `${userId}@test.dev`,
    name: userId,
    active_account_id: accountId,
  });
  return worker.fetch(new Request('https://worker.test/api/analytics/revenue', {
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId },
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function invoice(db: SqliteD1, id: string, accountId: string, status: string, age: string, lines: Array<[number, number]>) {
  db.sqlite.prepare(`INSERT INTO invoices
    (id, account_id, invoice_number, status, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))`).run(id, accountId, id, status, age);
  for (const [index, [quantity, price]] of lines.entries()) {
    db.sqlite.prepare(`INSERT INTO invoice_line_items
      (id, account_id, invoice_id, quantity, price_at_sale)
      VALUES (?, ?, ?, ?, ?)`).run(`${id}-line-${index}`, accountId, id, quantity, price);
  }
}

describe('GET /api/analytics/revenue', () => {
  it('returns only recent filled revenue for the requested account', async () => {
    const db = database();
    invoice(db, 'recent-filled', 'account-a', 'Filled', '-7 days', [[2, 20], [3, 15]]);
    invoice(db, 'old-filled', 'account-a', 'Filled', '-190 days', [[1, 900]]);
    invoice(db, 'recent-draft', 'account-a', 'Draft', '-2 days', [[1, 700]]);
    invoice(db, 'other-account', 'account-b', 'Filled', '-1 day', [[1, 800]]);

    const response = await getRevenue(db);
    expect(response.status).toBe(200);
    const body = await response.json() as { weekly_revenue: Array<{ week: string; revenue: number; order_count: number }>; inventory_age_alerts: unknown[] };
    const expectedWeek = db.sqlite.prepare(`SELECT strftime('%Y-%W', datetime('now', '-7 days')) AS week`).get() as { week: string };
    expect(body.weekly_revenue).toEqual([{ week: expectedWeek.week, revenue: 85, order_count: 1 }]);
    expect(body.inventory_age_alerts).toEqual([]);
  });

  it('returns empty arrays when the account has no invoices or products', async () => {
    const db = database();
    const response = await getRevenue(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ weekly_revenue: [], inventory_age_alerts: [] });
  });
});
