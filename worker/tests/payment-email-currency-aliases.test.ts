import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
const SHARE = 'a'.repeat(32);
afterEach(() => {
  vi.unstubAllGlobals();
  databases.splice(0).forEach(db => db.close());
});

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg=0, default_shipping_rate_currency='USD' WHERE id='shop';
    DELETE FROM exchange_rates;
    INSERT INTO exchange_rates (currency, rate_to_usd, last_updated) VALUES
      ('USD', 1, '2026-08-30 06:00:00'), ('Yuan', 7.25, '2026-08-30 06:00:00'), ('NT', 32, '2026-08-30 06:00:00');
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
      VALUES ('tea', 'shop', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000);
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('recipient', 'shop', 'owner', 'Tea house', 1);
    INSERT INTO payment_methods (id, contributor_id, method_type, label, recipient_name, position, is_published)
      VALUES ('method', 'recipient', 'bank_transfer', 'Bank', 'Tea house', 0, 1);
  `);
  db.sqlite.prepare(`INSERT INTO payment_share_links (id, account_id, contributor_id, token) VALUES ('share', 'shop', 'recipient', ?)`).run(SHARE);
  return db;
}

async function pay(db: SqliteD1, currency: string, amount: string | null = '35.00', share = true) {
  const url = new URL('https://worker.test/api/public/people/recipient/payment-methods');
  url.searchParams.set('display', currency);
  url.searchParams.set('currency', 'USD');
  if (amount !== null) url.searchParams.set('amount', amount);
  if (share) url.searchParams.set('t', SHARE);
  return worker.fetch(new Request(url), { DB: db, JWT_SECRET: 'test' } as never);
}

async function email(db: SqliteD1, currency: string) {
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response('{}', { status: 200 });
  }));
  const response = await worker.fetch(new Request('https://worker.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'cart', store_slug: 'shop', tracking_token: crypto.randomUUID().replaceAll('-', ''),
      ref_number: 'TJ-ALIAS', customer_name: 'Guest', customer_contact: 'guest@example.com',
      customer_location: 'Ubud', currency, total_estimate_usd: 14,
      items: [{ id: 'tea', name: 'Red tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14 }],
    }),
  }), { DB: db, JWT_SECRET: 'test', SENDER_EMAIL: 'store@example.com', RESEND_API_KEY: 'test-key',
    INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
  expect(response.status).toBe(201);
  expect(sent).toHaveLength(2);
  return sent;
}

const families = [
  { aliases: ['CNY', 'Yuan', 'RMB', ' cNy '], iso: 'CNY', rate: 7.25, amount: '253.75' },
  { aliases: ['TWD', 'NT', 'NT$', ' twd '], iso: 'TWD', rate: 32, amount: '1120.00' },
];

describe('payment display aliases use the recorded shop rate', () => {
  for (const family of families) for (const alias of family.aliases) {
    it(`quotes ${alias} with ISO units and the recorded date`, async () => {
      const db = seed();
      const response = await pay(db, alias);
      expect(response.status).toBe(200);
      expect((await response.json() as any).context).toMatchObject({
        currency: 'USD', amount: '35.00', display_only: true,
        local: { currency: family.iso, amount: family.amount, rate: family.rate, as_of: '2026-08-30T06:00:00Z' },
      });
    });
  }
  it('still gates a stranger even when the currency and amount are valid', async () => {
    const response = await pay(seed(), 'CNY', '35.00', false);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'pay_private' });
  });
  it('keeps missing, zero, negative and placeholder rates unavailable', async () => {
    const db = seed();
    for (const rate of [0, -1, 1]) {
      db.sqlite.prepare("UPDATE exchange_rates SET rate_to_usd=? WHERE currency='Yuan'").run(rate);
      expect((await (await pay(db, 'CNY')).json() as any).context.local).toBeNull();
    }
    db.sqlite.exec("DELETE FROM exchange_rates WHERE currency='Yuan'");
    expect((await (await pay(db, 'CNY')).json() as any).context.local).toBeNull();
  });
  it('keeps USD, unknown tokens and absent or zero amounts without a local figure', async () => {
    const db = seed();
    for (const token of ['USD', 'us$', 'UNK', 'ZZZ', 'constructor', '__proto__']) {
      db.sqlite.prepare('INSERT OR REPLACE INTO exchange_rates(currency, rate_to_usd) VALUES (?, 9)').run(token);
      expect((await (await pay(db, token)).json() as any).context.local).toBeNull();
    }
    for (const amount of [null, '0']) expect((await (await pay(db, 'CNY', amount)).json() as any).context.local).toBeNull();
  });
});

describe('order email currency aliases', () => {
  for (const family of families) for (const alias of family.aliases) {
    it(`formats ${alias} as the same local total in both emails`, async () => {
      const sent = await email(seed(), alias);
      const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: family.iso, maximumFractionDigits: 2 }).format(14 * family.rate);
      expect(sent[0].subject).toContain(total);
      for (const message of sent) {
        expect(message.html).toContain(total);
        expect(message.html).not.toContain('Yuan ');
        expect(message.html).not.toContain('NT ');
      }
    });
  }
  it('preserves supported ISO currencies whose rate key is already ISO', async () => {
    const db = seed();
    db.sqlite.exec("INSERT INTO exchange_rates(currency, rate_to_usd, last_updated) VALUES ('EUR', 0.9, '2026-08-30 06:00:00')");
    expect((await (await pay(db, 'EUR')).json() as any).context.local).toMatchObject({ currency: 'EUR', amount: '31.50', rate: 0.9 });
    expect((await email(db, 'EUR'))[0].subject).toContain('€12.60');
  });
  it('keeps the actual USD amount for unknown currencies, even with an injected rate row', async () => {
    const db = seed();
    for (const currency of ['USD', 'ZZZ']) {
      db.sqlite.prepare('INSERT OR REPLACE INTO exchange_rates(currency, rate_to_usd) VALUES (?, 9)').run(currency);
      expect((await email(db, currency))[0].subject).toContain('$14.00');
    }
  });
  it('keeps a missing or placeholder non-USD rate as a USD display', async () => {
    const db = seed();
    db.sqlite.exec("DELETE FROM exchange_rates WHERE currency='Yuan'");
    expect((await email(db, 'CNY'))[0].subject).toContain('$14.00');
    for (const rate of [0, -1, 1]) {
      db.sqlite.prepare("INSERT OR REPLACE INTO exchange_rates(currency, rate_to_usd) VALUES ('Yuan', ?)").run(rate);
      expect((await email(db, 'Yuan'))[0].subject).toContain('$14.00');
    }
  });
});
