import { afterEach, beforeEach, expect, it } from 'vitest';
import worker from '../src/index';
import { settleHostCredit } from '../src/hostCreditLedger';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const via = 'aaaaaaaaaaaaaaaaaa';

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: 'shop', userId: 'host' });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD'
      WHERE id = 'shop';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency,
      quantity_purchased, stock_grams) VALUES ('tea', 'shop', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000);
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, thanks_ref)
      VALUES ('event', 'shop', 'sit', 'Tea', '2026-01-10', 'completed', '${via}');
    -- The lead host the public page names (Launch 2, sessionHost.ts): shown and published.
    INSERT INTO contributors (id, account_id, display_name, user_id, is_published)
      VALUES ('contributor', 'shop', 'Host', 'host', 1);
    INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('contributor', 'shop');
    INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
      VALUES ('lead', 'shop', 'event', 'contributor', 'lead_host', 1);
  `);
});
afterEach(() => db.close());

function env() {
  return {
    DB: db as unknown as D1Database, JWT_SECRET: 'credit-lifecycle-test',
    HOST_CREDIT_OPEN: 'true', FIRST_TABLE_OPEN: 'true',
    INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
  };
}

async function checkout() {
  const tasks: Promise<unknown>[] = [];
  const response = await worker.fetch(new Request('https://worker.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'website', via, store_slug: 'shop', tracking_token: 'hostcreditlifecycletrackingtoken000000001',
      ref_number: 'LIFECYCLE', customer_name: 'Buyer', customer_contact: 'buyer@example.com',
      customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 14,
      items: [{ id: 'tea', name: 'Red tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50,
        packGrams: 25, packs: 2, pricePerGram: 0.28, totalPrice: 14 }],
    }),
  }), env() as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
  await Promise.all(tasks);
  const saved = await response.json() as { invoice_id: string };
  expect(response.status, JSON.stringify(saved)).toBe(201);
  expect(saved.invoice_id).toBeTruthy();
  return saved.invoice_id;
}

function kinds(invoice: string) {
  return db.sqlite.prepare('SELECT kind FROM host_credit_entries WHERE invoice_id = ? ORDER BY rowid')
    .all(invoice).map(row => row.kind);
}

it('checkout holds credit, full payment and Fill earn once, and serial Void retries reverse once', async () => {
  const invoice = await checkout();
  expect(kinds(invoice)).toEqual(['pending']);
  const setState = db.sqlite.prepare('UPDATE invoices SET status = ?, payment_status = ? WHERE id = ?');
  for (const [status, payment] of [['Pending', 'paid'], ['Filled', 'unpaid']]) {
    setState.run(status, payment, invoice);
    await settleHostCredit(env(), invoice);
    expect(kinds(invoice)).toEqual(['pending']);
  }
  setState.run('Filled', 'paid', invoice);
  await settleHostCredit(env(), invoice);
  await settleHostCredit(env(), invoice);
  expect(kinds(invoice)).toEqual(['pending', 'earned']);
  setState.run('Void', 'paid', invoice);
  await settleHostCredit(env(), invoice);
  await settleHostCredit(env(), invoice);
  expect(kinds(invoice)).toEqual(['pending', 'earned', 'reversed']);
  expect(db.sqlite.prepare(`SELECT r.amount = e.amount AND r.currency = e.currency AS matches
    FROM host_credit_entries r JOIN host_credit_entries e ON e.id = r.reverses_entry_id
    WHERE e.invoice_id = ? AND e.kind = 'earned' AND r.kind = 'reversed'`).get(invoice)).toEqual({ matches: 1 });
});

it('a Void overlapping a Fill settlement leaves no unreversed earnings', async () => {
  const invoice = await checkout();
  expect(kinds(invoice)).toEqual(['pending']);
  db.sqlite.prepare("UPDATE invoices SET status = 'Filled', payment_status = 'paid' WHERE id = ?").run(invoice);
  // SqliteD1.first() reads synchronously. The first await in settleHostCredit
  // therefore yields after the Filled status was read and before any award.
  const fillSettlement = settleHostCredit(env(), invoice);
  db.sqlite.prepare("UPDATE invoices SET status = 'Void' WHERE id = ?").run(invoice);
  await Promise.all([fillSettlement, settleHostCredit(env(), invoice)]);
  expect(db.sqlite.prepare('SELECT status FROM invoices WHERE id = ?').get(invoice)).toEqual({ status: 'Void' });
  expect(db.sqlite.prepare(`SELECT e.kind, e.amount FROM host_credit_entries e
    WHERE e.invoice_id = ? AND e.kind = 'earned' AND NOT EXISTS
      (SELECT 1 FROM host_credit_entries r WHERE r.kind = 'reversed' AND r.reverses_entry_id = e.id)`)
    .all(invoice)).toEqual([]);
});
