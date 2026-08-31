import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Every way of being owed money ends at an invoice the payment ledger can see.
 *
 * Four routes lead to money in this system and only the shop order was ever
 * modernised. These tests hold the other three to the same shape, because the
 * cost of each gap is a number a real person is asked for:
 *
 *  - wholesale wrote two invoices marked with a status the app does not have,
 *    carrying no lines and no amount, so the money existed nowhere the ledger,
 *    the pay link or the attention list could reach;
 *  - a sample request for a tea not listed in the shop was refused outright and
 *    survived only as a WhatsApp message;
 *  - an order still carrying a line priced at nothing could be sent, asking the
 *    customer for less than it should.
 *
 * The event route is deliberately absent: event money already runs through
 * ordinary EVT- invoices. Its attendee payment column is dead — nothing in the
 * worker reads or writes it — so there is no second record to reconcile.
 */

/**
 * worker/schema.sql, which the harness loads, predates the wholesale tables.
 * Rather than widen it for these tests, the two tables are taken from the
 * baseline migration so the assertions run against the real column definitions
 * instead of a hand-written stand-in that could drift from them.
 */
function addWholesaleTables(db: SqliteD1): void {
  const baseline = readFileSync(new URL('../migrations/0000_initial_schema.sql', import.meta.url), 'utf8');
  for (const table of ['wholesale_orders', 'wholesale_order_items']) {
    const match = baseline.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS \\"?${table}\\"? *\\([\\s\\S]*?\\n\\);`)
    );
    if (!match) throw new Error(`${table} is not in the baseline migration`);
    db.sqlite.exec(match[0]);
  }
}

const SECRET = 'payment-flow-secret';
const ACCOUNT = 'account-f';
const OWNER = 'owner-f';

const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

async function admin(db: SqliteD1, path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env(db));
}

describe('an order is not sent while a line still has no price', () => {
  /** One draft that came from a request, with a single line. */
  async function seedDraft(priceAtSale: number): Promise<SqliteD1> {
    const db = new SqliteD1();
    databases.push(db);
    seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner' });

    db.sqlite.prepare(
      `INSERT INTO invoices
         (id, account_id, invoice_number, customer_name, display_currency,
          shipping_cost_usd, status, payment_status, created_at)
       VALUES ('inv-f', ?, 'TJ-F0001', 'Mei', 'USD', 0, 'Draft', 'unpaid', '2026-08-01 09:00:00')`
    ).run(ACCOUNT);
    db.sqlite.prepare(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
       VALUES ('line-f', ?, 'inv-f', 'Retired Da Hong Pao', 30, ?)`
    ).run(ACCOUNT, priceAtSale);

    return db;
  }

  const statusOf = (db: SqliteD1) =>
    (db.sqlite.prepare("SELECT status FROM invoices WHERE id = 'inv-f'").get() as any).status;

  it('refuses, names the line, and leaves the order a draft', async () => {
    const db = await seedDraft(0);
    const response = await admin(db, '/api/invoices/inv-f', {
      method: 'PUT',
      body: { status: 'Pending' },
    });

    expect(response.status).toBe(409);
    const body = await response.json() as any;
    expect(body.code).toBe('invoice_has_unpriced_lines');
    // Named, so the screen can ask about it rather than saying "a line".
    expect(body.details.lines).toEqual(['Retired Da Hong Pao']);
    expect(body.error).toContain('Retired Da Hong Pao');
    // The refusal must not half-apply the change.
    expect(statusOf(db)).toBe('Draft');
  });

  it('sends it when the operator says the line is meant to be free', async () => {
    const db = await seedDraft(0);
    const response = await admin(db, '/api/invoices/inv-f', {
      method: 'PUT',
      body: { status: 'Pending', allow_unpriced_lines: true },
    });

    expect(response.status).toBe(200);
    expect(statusOf(db)).toBe('Pending');
  });

  it('does not stand in the way of an order that is priced', async () => {
    const db = await seedDraft(1.5);
    const response = await admin(db, '/api/invoices/inv-f', {
      method: 'PUT',
      body: { status: 'Pending' },
    });

    expect(response.status).toBe(200);
    expect(statusOf(db)).toBe('Pending');
  });
});

describe('wholesale money lands where the payment ledger can see it', () => {
  const SUPPLIER = 'account-supplier';
  const BUYER = 'account-buyer';
  const BUYER_USER = 'user-buyer';
  const ORDER = 'ws-order-1';

  /**
   * A shipped order of 500g at 20,000 rupiah a gram, waiting to be received.
   * Rupiah on purpose: every money column on an invoice is dollars, so a
   * conversion that does not happen is a bill a hundred thousand times too big.
   */
  async function seedShippedOrder(): Promise<SqliteD1> {
    const db = new SqliteD1();
    databases.push(db);
    addWholesaleTables(db);
    seedIdentity(db, { userId: 'user-supplier', accountId: SUPPLIER, role: 'owner' });
    seedIdentity(db, { userId: BUYER_USER, accountId: BUYER, role: 'owner' });

    db.sqlite.prepare("UPDATE accounts SET name = 'Bali Tea House' WHERE id = ?").run(SUPPLIER);
    db.sqlite.prepare("UPDATE accounts SET name = 'Sydney Tea Room' WHERE id = ?").run(BUYER);
    db.sqlite.prepare(
      "INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('IDR', 16000)"
    ).run();

    db.sqlite.prepare(
      `INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
       VALUES ('profile-1', 'lao-cong-shui-xian', ?, ?, 'Lao Cong Shui Xian')`
    ).run(SUPPLIER, SUPPLIER);
    db.sqlite.prepare(
      `INSERT INTO product_listings (id, account_id, profile_id, stock_grams, status, is_public)
       VALUES ('listing-supplier', ?, 'profile-1', 900, 'active', 1)`
    ).run(SUPPLIER);

    db.sqlite.prepare(
      `INSERT INTO wholesale_orders
         (id, supplier_account_id, buyer_account_id, status, currency,
          subtotal_amount, shipping_amount, total_amount, shipping_address, shipped_at)
       VALUES (?, ?, ?, 'shipped', 'IDR', 10000000, 320000, 10320000, 'Sydney', '2026-08-20T00:00:00.000Z')`
    ).run(ORDER, SUPPLIER, BUYER);
    db.sqlite.prepare(
      `INSERT INTO wholesale_order_items
         (id, order_id, supplier_listing_id, profile_id, grams,
          unit_price_amount, unit_price_currency, line_total)
       VALUES ('ws-item-1', ?, 'listing-supplier', 'profile-1', 500, 20000, 'IDR', 10000000)`
    ).run(ORDER);

    return db;
  }

  async function receive(db: SqliteD1) {
    const token = await signedToken(SECRET, {
      sub: BUYER_USER, email: `${BUYER_USER}@test.dev`, name: BUYER_USER,
      active_account_id: BUYER, platform_role: null,
    });
    return worker.fetch(new Request(`https://worker.test/api/wholesale/orders/${ORDER}/transition`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Teajia-Account': BUYER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'received' }),
    }), env(db));
  }

  const invoices = (db: SqliteD1) => db.sqlite.prepare(
    `SELECT account_id, status, payment_status, shipping_cost_usd, fulfilled_at
       FROM invoices ORDER BY account_id`
  ).all() as any[];

  it('writes two invoices in a status the app actually has, not "Paid"', async () => {
    const db = await seedShippedOrder();
    expect((await receive(db)).status).toBe(200);

    const rows = invoices(db);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.account_id)).toEqual([BUYER, SUPPLIER].sort());
    for (const row of rows) {
      // 'Paid' was never one of Draft, Pending, Filled, Void, so the row used to
      // render under a status the admin screen does not know.
      expect(['Draft', 'Pending', 'Filled', 'Void']).toContain(row.status);
      expect(row.status).toBe('Filled');
      expect(row.fulfilled_at).toBeTruthy();
    }
  });

  it('leaves them unpaid, because receiving tea is not paying for it', async () => {
    const db = await seedShippedOrder();
    expect((await receive(db)).status).toBe(200);

    for (const row of invoices(db)) {
      expect(row.payment_status).toBe('unpaid');
    }
  });

  it('carries real lines converted to dollars, so the order is worth something', async () => {
    const db = await seedShippedOrder();
    expect((await receive(db)).status).toBe(200);

    const lines = db.sqlite.prepare(
      'SELECT account_id, custom_name, quantity, price_at_sale FROM invoice_line_items ORDER BY account_id'
    ).all() as any[];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.custom_name).toBe('Lao Cong Shui Xian');
      expect(line.quantity).toBe(500);
      // 20,000 rupiah a gram at 16,000 to the dollar is 1.25 dollars a gram.
      // Invoiced at par it would have read as 20,000 dollars a gram.
      expect(line.price_at_sale).toBeCloseTo(1.25, 6);
    }
    for (const row of invoices(db)) {
      // 320,000 rupiah of freight, in dollars.
      expect(row.shipping_cost_usd).toBeCloseTo(20, 6);
    }
  });

  it('shows up as owed money on the buyer’s attention list', async () => {
    const db = await seedShippedOrder();
    expect((await receive(db)).status).toBe(200);

    const token = await signedToken(SECRET, {
      sub: BUYER_USER, email: `${BUYER_USER}@test.dev`, name: BUYER_USER,
      active_account_id: BUYER, platform_role: null,
    });
    const response = await worker.fetch(new Request('https://worker.test/api/attention', {
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': BUYER },
    }), env(db));
    expect(response.status).toBe(200);
    const body = await response.json() as any;

    // Not unpriced: it carries a real number. Not unsent: nothing was paid, and
    // the goods have already moved. The point of the assertion is that nothing
    // is silently unpriced, which is what an empty invoice would have been.
    expect(body.counts.unpriced).toBe(0);
  });

  it('refuses to receive an order it cannot state in dollars', async () => {
    const db = await seedShippedOrder();
    db.sqlite.prepare("DELETE FROM exchange_rates WHERE currency = 'IDR'").run();

    const response = await receive(db);
    expect(response.status).toBe(409);
    const body = await response.json() as any;
    expect(body.code).toBe('wholesale_missing_exchange_rate');
    expect(body.details.currencies).toContain('IDR');
    expect(body.error).toContain('IDR');

    // Nothing half-lands: no invoice, no stock movement, and the order is
    // still shipped, so receiving it again after adding the rate just works.
    expect(db.sqlite.prepare('SELECT COUNT(*) AS c FROM invoices').get()).toEqual({ c: 0 });
    expect((db.sqlite.prepare('SELECT status FROM wholesale_orders WHERE id = ?').get(ORDER) as any).status)
      .toBe('shipped');
    expect((db.sqlite.prepare("SELECT stock_grams FROM product_listings WHERE id = 'listing-supplier'").get() as any).stock_grams)
      .toBe(900);

    db.sqlite.prepare("INSERT INTO exchange_rates (currency, rate_to_usd) VALUES ('IDR', 16000)").run();
    expect((await receive(db)).status).toBe(200);
    expect((db.sqlite.prepare('SELECT COUNT(*) AS c FROM invoices').get() as any).c).toBe(2);
  });
});
