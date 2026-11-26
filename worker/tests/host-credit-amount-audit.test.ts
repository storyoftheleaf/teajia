import { afterEach, beforeEach, expect, it } from 'vitest';
import worker from '../src/index';
import { holdHostCreditSpend, settleHostCredit } from '../src/hostCreditLedger';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const secret = 'credit-audit-test-key';
const env = () => ({
  DB: db as unknown as D1Database,
  HOST_CREDIT_OPEN: 'true',
  JWT_SECRET: secret,
  APP_URL: 'https://shop.test',
});

async function ownerRequest(path: string, method: string, body: Record<string, unknown>) {
  const token = await signedToken(secret, {
    sub: 'owner', active_account_id: 'shop', email: 'owner@test.dev', name: 'Owner', platform_role: null,
  });
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return worker.fetch(request, env() as Parameters<typeof worker.fetch>[1]);
}

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'owner', accountId: 'shop', role: 'owner' });
  seedIdentity(db, { userId: 'host', accountId: 'host-home' });
  db.sqlite.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date)
      VALUES ('event', 'shop', 'tea', 'Tea', '2026-06-01');
    INSERT INTO inquiries (id, account_id, name, email, items, converted_invoice_id)
      VALUES ('inquiry', 'shop', 'Guest', 'guest@test.dev', '[]', 'sale');
    INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
      VALUES ('inquiry', 'shop', 'event', 'host');
    INSERT INTO products (id, account_id, product_name, type, cost_amount, cost_currency,
      shipping_rate_per_kg, markup_multiplier)
      VALUES ('tea', 'shop', 'Tea', 'Oolong', 1, 'USD', NULL, NULL);
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, display_currency,
      status, payment_status, shipping_cost_usd)
      VALUES ('sale', 'shop', 'TJ-1', 'Guest', 'USD', 'Pending', 'paid', 10);
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('line', 'shop', 'sale', 'tea', 4, 3);
  `);
});
afterEach(() => db.close());

it('R1 calculates both amounts from the stored tea line and shop rate', async () => {
  db.sqlite.exec("UPDATE accounts SET host_credit_percent = 25 WHERE id = 'shop'");
  expect((await settleHostCredit(env(), 'sale')).pending).toBe(1);
  db.sqlite.exec("UPDATE invoice_line_items SET quantity = 5 WHERE id = 'line'");

  const response = await ownerRequest('/api/invoices/sale', 'PUT', {
    status: 'Filled', amount: 900, credit: 777, host_credit_percent: 100, host_user_id: 'owner',
  });
  expect(response.status, await response.text()).toBe(200);
  expect(db.sqlite.prepare(`
    SELECT kind, host_user_id, basis_quantity, basis_amount, amount, currency
    FROM host_credit_entries ORDER BY rowid
  `).all()).toEqual([
    { kind: 'pending', host_user_id: 'host', basis_quantity: 4, basis_amount: 12, amount: 3, currency: 'USD' },
    { kind: 'earned', host_user_id: 'host', basis_quantity: 5, basis_amount: 15, amount: 3.75, currency: 'USD' },
  ]);
});

it('R1 approval copies the stored hold amount despite a different request amount', async () => {
  db.sqlite.exec(`
    UPDATE invoices SET status = 'Filled' WHERE id = 'sale';
    INSERT INTO customers (id, account_id, user_id, name) VALUES ('buyer', 'shop', 'host', 'Host');
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, status)
      VALUES ('redemption', 'shop', 'TJ-2', 'Host', 'buyer', 'Pending');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('redemption-line', 'shop', 'redemption', 'tea', 1, 3);
  `);
  expect((await settleHostCredit(env(), 'sale')).earned).toBe(1);
  const hold = await holdHostCreditSpend(env(), {
    accountId: 'shop', hostUserId: 'host', invoiceId: 'redemption', amount: 0.75,
  });
  if (!('id' in hold)) throw new Error(`Expected a hold, got ${hold.error}`);
  const response = await ownerRequest(`/api/host-credit/spend-requests/${hold.id}/approve`, 'POST', { amount: 1.2 });
  expect(response.status, await response.text()).toBe(200);
  expect(db.sqlite.prepare("SELECT spend_request_id, amount FROM host_credit_entries WHERE kind = 'spent'").all())
    .toEqual([{ spend_request_id: hold.id, amount: 0.75 }]);
});

it('R7 clearing the ceiling releases a large eligible order without earning approval', async () => {
  db.sqlite.exec(`
    UPDATE accounts SET host_credit_order_ceiling_usd = 0 WHERE id = 'shop';
    UPDATE invoice_line_items SET price_at_sale = 25000 WHERE id = 'line';
    UPDATE invoices SET status = 'Filled' WHERE id = 'sale';
  `);
  expect(await settleHostCredit(env(), 'sale')).toMatchObject({ pending: 1, earned: 0, awaiting_approval: true });
  db.sqlite.exec("UPDATE accounts SET host_credit_order_ceiling_usd = NULL WHERE id = 'shop'");
  expect(await settleHostCredit(env(), 'sale')).toMatchObject({ pending: 0, earned: 1, awaiting_approval: false });
  expect(db.sqlite.prepare("SELECT amount, created_by FROM host_credit_entries WHERE kind = 'earned'").all())
    .toEqual([{ amount: 10000, created_by: 'system' }]);
});
