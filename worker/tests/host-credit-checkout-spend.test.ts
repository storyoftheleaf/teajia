import { afterEach, beforeEach, expect, it } from 'vitest';
import worker from '../src/index';
import { readShopHostCredit, settleHostCredit } from '../src/hostCreditLedger';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

// Launch 5, the credit screens: a signed-in host asks at checkout to use their
// tea credit. Only the choice comes from the browser; the order, the host and
// the amount are read from stored rows, and the result is a held request that
// waits for the owner.

let db: SqliteD1;
const secret = 'credit-checkout-test';
let token = 0;

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: 'shop', userId: 'owner' });
  seedIdentity(db, { accountId: 'personal', userId: 'host' });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD' WHERE id = 'shop';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency,
      quantity_purchased, stock_grams) VALUES ('tea', 'shop', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000);
    INSERT INTO events (id, account_id, slug, title, event_date) VALUES ('event', 'shop', 'sit', 'Evening tea', '2026-11-01');
    INSERT INTO inquiries (id, account_id, name, email, items, converted_invoice_id)
      VALUES ('source', 'shop', 'Guest', 'guest@example.test', '[]', 'sale');
    INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id) VALUES ('source', 'shop', 'event', 'host');
    INSERT INTO invoices (id, account_id, invoice_number, customer_name, status, payment_status)
      VALUES ('sale', 'shop', 'S1', 'Guest', 'Filled', 'paid');
    INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('sold', 'shop', 'sale', 'tea', 50, 2);
  `);
});
afterEach(() => db.close());

function env(open = true) {
  return {
    DB: db as unknown as D1Database, JWT_SECRET: secret, HOST_CREDIT_OPEN: open ? 'true' : 'false',
    INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
  };
}

async function call(path: string, init: { method?: string; body?: unknown; as?: string | null; open?: boolean } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.as !== null) headers.Authorization = `Bearer ${await signedToken(secret, { sub: init.as ?? 'host', email: `${init.as ?? 'host'}@test.dev`, active_account_id: 'personal' })}`;
  const tasks: Promise<unknown>[] = [];
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }), env(init.open ?? true) as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
  await Promise.all(tasks);
  return response;
}

function checkout(extra: Record<string, unknown>, as: string | null = 'host', open = true) {
  token += 1;
  return call('/api/inquiries', {
    method: 'POST', as, open,
    body: {
      source: 'website', store_slug: 'shop', tracking_token: `hostcreditcheckouttrackingtoken${String(token).padStart(10, '0')}`,
      ref_number: `CREDIT${token}`, customer_name: 'Host', customer_contact: 'host@example.com',
      customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 14,
      items: [{ id: 'tea', name: 'Red tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50,
        packGrams: 25, packs: 2, pricePerGram: 0.28, totalPrice: 14 }],
      ...extra,
    },
  });
}

const requests = () => db.sqlite.prepare('SELECT host_user_id, amount, status FROM host_credit_spend_requests ORDER BY rowid').all();

it('holds the host\'s available credit against their own order, worked out on the server', async () => {
  expect((await settleHostCredit(env(), 'sale')).earned).toBe(1);
  const before = await (await call('/api/me/tea-credit?store=shop')).json() as { store_available: number };
  expect(before.store_available).toBe(10);

  // An amount sent by the browser is ignored.
  const response = await checkout({ use_tea_credit: true, tea_credit_amount: 999 });
  const saved = await response.json() as { tea_credit?: { status: string; amount?: number }; invoice_id: string };
  expect(response.status, JSON.stringify(saved)).toBe(201);
  expect(saved.tea_credit).toMatchObject({ status: 'held', amount: 10, currency: 'USD' });
  expect(requests()).toEqual([{ host_user_id: 'host', amount: 10, status: 'held' }]);

  const after = await (await call('/api/me/tea-credit?store=shop')).json() as {
    store_available: number; balances: Array<{ held: number; available: number }>;
    spend_requests: Array<{ invoice_id: string; status: string; amount: number }>;
  };
  expect(after.store_available).toBe(0);
  expect(after.balances[0]).toMatchObject({ held: 10, available: 0 });
  expect(after.spend_requests).toEqual([expect.objectContaining({ invoice_id: saved.invoice_id, status: 'held', amount: 10 })]);
  // Nothing was spent: only the owner's approval writes a spent row.
  expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM host_credit_entries WHERE kind = 'spent'").get()).toEqual({ n: 0 });
});

it('asks for nothing unless the host chose it, when signed out, or with no credit', async () => {
  await settleHostCredit(env(), 'sale');
  expect((await (await checkout({})).json() as Record<string, unknown>).tea_credit).toBeUndefined();
  expect((await (await checkout({ use_tea_credit: true }, null)).json() as Record<string, unknown>).tea_credit).toBeUndefined();
  expect(requests()).toEqual([]);

  const owner = await (await checkout({ use_tea_credit: true }, 'owner')).json() as { tea_credit?: { status: string } };
  expect(owner.tea_credit).toEqual({ status: 'not_held', reason: 'nothing_to_use' });
  expect(requests()).toEqual([]);
});

it('with the flag off, checkout asks for nothing and the reads answer 404', async () => {
  await settleHostCredit(env(), 'sale');
  const saved = await (await checkout({ use_tea_credit: true }, 'host', false)).json() as Record<string, unknown>;
  expect(saved.tea_credit).toBeUndefined();
  expect(requests()).toEqual([]);
  expect((await call('/api/me/tea-credit', { open: false })).status).toBe(404);
  expect((await call('/api/host-credit', { as: 'owner', open: false })).status).toBe(404);
});

it('lists an order over the shop\'s ceiling as waiting on a second look', async () => {
  db.sqlite.exec("UPDATE accounts SET host_credit_order_ceiling_usd = 5 WHERE id = 'shop'");
  expect((await settleHostCredit(env(), 'sale')).awaiting_approval).toBe(true);
  const shop = await readShopHostCredit(env().DB, 'shop');
  expect(shop.second_look).toEqual([expect.objectContaining({
    invoice_id: 'sale', invoice_number: 'S1', host_user_id: 'host', event_title: 'Evening tea', credit_amount: 10, ceiling_usd: 5,
  })]);
  db.sqlite.exec("UPDATE accounts SET host_credit_order_ceiling_usd = NULL WHERE id = 'shop'");
  expect((await readShopHostCredit(env().DB, 'shop')).second_look).toEqual([]);
});
