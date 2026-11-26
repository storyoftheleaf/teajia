import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import worker from '../src/index';
import { holdHostCreditSpend, readOwnHostCredit, settleHostCredit } from '../src/hostCreditLedger';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

let db: SqliteD1;
const secret = 'credit-audit-local';
const env = () => ({ DB: db as unknown as D1Database, HOST_CREDIT_OPEN: 'true', JWT_SECRET: secret });
beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'owner', accountId: 'shop' });
  seedIdentity(db, { userId: 'host', accountId: 'personal' });
  db.sqlite.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date)
      VALUES ('event','shop','event','Evening tea','2026-11-01');
    INSERT INTO customers (id, account_id, name, user_id) VALUES ('buyer','shop','Host','host');
    INSERT INTO products (id, account_id, product_name, type, cost_amount, cost_currency, markup_multiplier, shipping_rate_per_kg)
      VALUES ('tea','shop','Oolong','Oolong',1,'USD',NULL,NULL);
    INSERT INTO inquiries (id, account_id, name, email, items, converted_invoice_id)
      VALUES ('source','shop','Guest','guest@example.test','[]','sale');
    INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
      VALUES ('source','shop','event','host');
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, status, payment_status)
      VALUES ('sale','shop','S1','Guest',NULL,'Filled','paid'),
             ('redemption','shop','R1','Host','buyer','Pending','unpaid');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('sold','shop','sale','tea',50,2), ('ordered','shop','redemption','tea',10,1);
  `);
});
afterEach(() => db.close());

async function reserve() {
  expect(await settleHostCredit(env(), 'sale')).toMatchObject({ pending: 1, earned: 1 });
  const request = await holdHostCreditSpend(env(), {
    accountId: 'shop', hostUserId: 'host', invoiceId: 'redemption', amount: 10,
  });
  if (!('id' in request)) throw new Error(request.error);
  return request.id;
}

async function approve(requestId: string, userId = 'owner') {
  const token = await signedToken(secret, { sub: userId, active_account_id: 'shop' });
  const background: Promise<unknown>[] = [];
  const response = await worker.fetch(new Request(`https://test.invalid/api/host-credit/spend-requests/${requestId}/approve`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' },
  }), env() as Parameters<typeof worker.fetch>[1], { waitUntil: task => background.push(task) } as ExecutionContext);
  await Promise.all(background);
  return response;
}

it('R3 limits the Manage decision to the owner of this shop', async () => {
  seedIdentity(db, { accountId: 'another-shop', userId: 'platform', platformRole: 'platform_owner' });
  seedIdentity(db, { accountId: 'shop', userId: 'staff', role: 'staff' });
  // Missing request isolates the permission check from the financial write.
  expect((await approve('missing', 'staff')).status).toBe(403);
  expect((await approve('missing')).status).toBe(404);
  expect((await approve('missing', 'platform')).status).toBe(403);
});

it('uses actual owner membership for a platform owner deciding a spend', async () => {
  seedIdentity(db, { accountId: 'shop', userId: 'platform', platformRole: 'platform_owner', role: 'staff' });
  const requestId = await reserve();
  expect((await approve(requestId, 'platform')).status).toBe(403);
  db.sqlite.exec("UPDATE account_members SET role = 'owner' WHERE account_id = 'shop' AND user_id = 'platform'");
  expect((await approve(requestId, 'platform')).status).toBe(200);
});

it('R3 confines explicit spending to the Manage decision handler', () => {
  const source = 'worker/src';
  const files = readdirSync(source, { recursive: true, withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.ts'))
    .map(file => join(file.parentPath, file.name));
  const spendCallers: string[] = [];
  const ledgerWriters: string[] = [];
  for (const path of files) {
    const code = readFileSync(path, 'utf8');
    if (/\bapproveHostCreditSpend\s*\(/.test(code)) spendCallers.push(relative(source, path));
    if (/\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+host_credit_entries\b/i.test(code)) {
      ledgerWriters.push(relative(source, path));
    }
  }
  expect(spendCallers.sort()).toEqual(['hostCreditLedger.ts', 'index.ts']);
  expect(ledgerWriters).toEqual(['hostCreditLedger.ts']);
  const index = readFileSync(join(source, 'index.ts'), 'utf8');
  expect(index.match(/\bapproveHostCreditSpend\s*\(/g)).toHaveLength(1);
  const handler = index.match(/const handleDecideHostCreditSpend[^]*?\n};/)?.[0];
  expect(handler).toMatch(/requireHostCreditOwner\(request, env\)[^]*?approveHostCreditSpend\(env,/);
});

it('R4 concurrent approvals of one hold append exactly one spend', async () => {
  const requestId = await reserve();
  const before = db.sqlite.prepare('SELECT * FROM host_credit_entries ORDER BY id').all();
  expect((await readOwnHostCredit(env().DB, 'host')).balances[0]).toMatchObject({ earned: 10, held: 10, spent: 0 });
  const decisions = await Promise.all([approve(requestId), approve(requestId)]);
  expect(decisions.map(response => response.status)).toEqual([200, 200]);
  expect(db.sqlite.prepare("SELECT * FROM host_credit_entries WHERE kind != 'spent' ORDER BY id").all()).toEqual(before);
  expect(db.sqlite.prepare("SELECT spend_request_id, amount, created_by FROM host_credit_entries WHERE kind = 'spent'").all())
    .toEqual([{ spend_request_id: requestId, amount: 10, created_by: 'owner' }]);
});

it('R4 keeps the balance nonnegative when a redeemed earning is voided', async () => {
  const requestId = await reserve();
  expect((await approve(requestId)).status).toBe(200);
  expect((await readOwnHostCredit(env().DB, 'host')).balances[0]).toMatchObject({ available: 0, spent: 10, held: 0 });
  db.sqlite.exec("UPDATE invoices SET status = 'Void' WHERE id = 'sale'");
  expect((await settleHostCredit(env(), 'sale')).reversed).toBe(1);
  const balance = (await readOwnHostCredit(env().DB, 'host')).balances[0];
  expect(balance).toMatchObject({ earned: 10, spent: 10, reversed: 10, held: 0 });
  expect(balance.available).toBeGreaterThanOrEqual(0);
});

it('R4 protects posted rows against update and delete in the migrated database', async () => {
  expect((await settleHostCredit(env(), 'sale')).earned).toBe(1);
  expect.soft(() => db.sqlite.exec("UPDATE host_credit_entries SET reason = 'amended' WHERE kind = 'earned'")).toThrow();
  expect.soft(() => db.sqlite.exec("DELETE FROM host_credit_entries WHERE kind = 'earned'")).toThrow();
});

it('repays debt from later earnings before making credit available to spend', async () => {
  const requestId = await reserve();
  expect((await approve(requestId)).status).toBe(200);
  db.sqlite.exec(`
    UPDATE invoices SET status = 'Void' WHERE id = 'sale';
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, status, payment_status)
      VALUES ('partial','shop','S2','Guest','Filled','paid'), ('surplus','shop','S3','Guest','Filled','paid');
    INSERT INTO inquiries (id, account_id, name, email, items, converted_invoice_id)
      VALUES ('second','shop','Guest','guest@example.test','[]','partial'),
             ('third','shop','Guest','guest@example.test','[]','surplus');
    INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
      VALUES ('second','shop','event','host'), ('third','shop','event','host');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('partial-tea','shop','partial','tea',60,1), ('surplus-tea','shop','surplus','tea',70,1);
    -- A second order of the host's own: the first one's tea lines are already paid in full by credit.
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, status, payment_status)
      VALUES ('redemption-2','shop','R2','Host','buyer','Pending','unpaid');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('ordered-2','shop','redemption-2','tea',10,1);
  `);
  await settleHostCredit(env(), 'sale');
  const balance = async () => (await readOwnHostCredit(env().DB, 'host')).balances[0];
  const hold = (amount: number) => holdHostCreditSpend(env(), {
    accountId: 'shop', hostUserId: 'host', invoiceId: 'redemption-2', amount,
  });
  expect(await balance()).toMatchObject({ debt: 10, available: 0 });
  await settleHostCredit(env(), 'partial');
  expect(await balance()).toMatchObject({ debt: 4, available: 0 });
  expect(await hold(1)).toEqual({ error: 'not_covered' });
  await settleHostCredit(env(), 'surplus');
  await settleHostCredit(env(), 'sale');
  expect(await balance()).toMatchObject({ debt: 0, available: 3 });
  expect(await hold(4)).toEqual({ error: 'not_covered' });
  expect(await hold(3)).toHaveProperty('id');
});
