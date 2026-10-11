import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'invoice-create-retry-secret';
const opened: SqliteD1[] = [];
afterEach(() => { while (opened.length) opened.pop()!.close(); });

function setup(source: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(source);
  opened.push(db);
  seedIdentity(db, { accountId: 'shop-a', userId: 'seller-a', role: 'owner' });
  seedIdentity(db, { accountId: 'shop-b', userId: 'seller-b', role: 'owner' });
  return db;
}

async function call(db: SqliteD1, accountId: string, userId: string, method: string, path: string, body?: unknown) {
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: accountId,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

const key = 'invoice-retry-1234567890';
const input = (name = 'Buyer') => ({
  idempotency_key: key,
  invoice: { customer_name: name, display_currency: 'USD', status: 'Draft' },
  lineItems: [{ custom_name: 'Tea service', quantity: 1, price_at_sale: 25 }],
});

describe.each(['schema', 'migrations'] as const)('invoice create retry on %s D1', source => {
  it('replays a lost response, preserving the first ID, number, and single line', async () => {
    const db = setup(source);
    const first = await call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input());
    expect(first.status).toBe(201);
    const original = await first.json() as any;
    const again = await call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input());
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ ...original, idempotent: true });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices WHERE account_id = ?').get('shop-a')).toMatchObject({ count: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoice_line_items WHERE invoice_id = ?').get(original.id)).toMatchObject({ count: 1 });
    const recovered = await call(db, 'shop-a', 'seller-a', 'GET', `/api/invoices/create-requests/${key}`);
    expect(await recovered.json()).toMatchObject(original);
  });

  it('refuses a changed payload and keeps lookup within its account', async () => {
    const db = setup(source);
    const first = await call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input());
    expect(first.status).toBe(201);
    const changed = await call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input('Different buyer'));
    expect(changed.status).toBe(409);
    const otherLookup = await call(db, 'shop-b', 'seller-b', 'GET', `/api/invoices/create-requests/${key}`);
    expect(otherLookup.status).toBe(404);
    const otherCreate = await call(db, 'shop-b', 'seller-b', 'POST', '/api/invoices', input());
    expect(otherCreate.status).toBe(201);
    expect((await otherCreate.json() as any).id).not.toBe((await first.json() as any).id);
  });

  it('commits one invoice when two matching requests arrive together', async () => {
    const db = setup(source);
    const [left, right] = await Promise.all([
      call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input()),
      call(db, 'shop-a', 'seller-a', 'POST', '/api/invoices', input()),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 201]);
    const [first, second] = await Promise.all([left.json(), right.json()]);
    expect(first.id).toBe(second.id);
    expect(first.invoice_number).toBe(second.invoice_number);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices WHERE account_id = ?').get('shop-a')).toMatchObject({ count: 1 });
  });
});
