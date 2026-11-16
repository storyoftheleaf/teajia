import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { resolveShopFreightDefault, shippingPerGramUsd } from '../src/shippingRate';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-shipping-fx';
const databases: SqliteD1[] = [];
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external calls in shipping fixtures'); })); });
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });
const rate = (currency: string) => ({ USD: 1, Yuan: 7.1 } as Record<string, number>)[currency];

describe('required freight conversion stays unknown when FX is unavailable', () => {
  for (const missing of [undefined, null, 0, -1, NaN, Infinity]) {
    it(`declines an unavailable/nonpositive/nonfinite shop rate (${String(missing)})`, () => {
      expect(resolveShopFreightDefault(null, () => missing).perKgUsd).toBeNull();
    });
  }
  it('does not convert an amount with another currency rate', () => {
    expect(resolveShopFreightDefault({ default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'MISSING' }, rate).perKgUsd).toBeNull();
  });
  it('retains exact valid conversion and NULL account inheritance', () => {
    expect(resolveShopFreightDefault(null, rate).perKgUsd).toBe(85 / 7.1);
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd: 85 / 7.1 })).toBe(85 / 7.1 / 1000);
  });
  it('retains zero and teaware before asking for FX', () => {
    expect(resolveShopFreightDefault({ default_shipping_rate_per_kg: 0 }, () => undefined).perKgUsd).toBe(0);
    expect(shippingPerGramUsd({ storedRatePerKg: 0, rateToUsd: 0, isTeaware: false, shopDefaultPerKgUsd: null })).toBe(0);
    expect(shippingPerGramUsd({ storedRatePerKg: 85, rateToUsd: 0, isTeaware: true, shopDefaultPerKgUsd: null })).toBe(0);
  });
  it('uses a valid own rate without an unrelated shop conversion and declines a missing own rate', () => {
    expect(shippingPerGramUsd({ storedRatePerKg: 30, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd: null })).toBe(.03);
    expect(shippingPerGramUsd({ storedRatePerKg: 85, rateToUsd: 0, isTeaware: false, shopDefaultPerKgUsd: 12 })).toBeNull();
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd: null })).toBeNull();
  });
});

function seed(source: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(source); databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['catalog', 'sell'] });
  db.sqlite.exec(`DELETE FROM exchange_rates;
    INSERT INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1);
    UPDATE accounts SET default_shipping_rate_per_kg=85,default_shipping_rate_currency='Yuan' WHERE id='shop';
    INSERT INTO products(id,account_id,type,product_name,form,cost_amount,cost_currency,quantity_purchased,stock_grams,shipping_rate_per_kg,status,is_public,shown_in_shop)
    VALUES('tea','shop','Red','Synthetic tea','Loose',100,'USD',1000,1000,NULL,'Active',1,1);`);
  return db;
}
async function request(db: SqliteD1, path: string, body?: unknown, authenticated = false) {
  const token = authenticated ? await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', role: 'owner' }) : null;
  return worker.fetch(new Request(`https://fixture.test${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
}
const items = [{ id: 'tea', name: 'Synthetic tea', category: 'tea', storeSlug: 'shop', quantityGrams: 100, packGrams: 100, packs: 1, pricePerGram: 0, totalPrice: 0 }];
const payload = () => ({ source: 'website', store_slug: 'shop', tracking_token: 'synthetic_shipping_freight_token_0001', ref_number: 'FIXTURE', customer_name: 'Guest', customer_contact: 'guest@example.test', customer_location: 'Synthetic destination', currency: 'USD', total_estimate_usd: 0, items });
function effects(db: SqliteD1) {
  return Object.fromEntries(['invoices','invoice_line_items','inquiries','customers','order_whatsapp_outbox'].map(table => [table, (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n]));
}

describe('actual Worker pricing and invoice refusal with synthetic SQLite', () => {
  it('returns null derived pricing through both authenticated and public reads', async () => {
    const db = seed();
    const response = await request(db, '/api/products', undefined, true);
    expect(response.status).toBe(200);
    expect((await response.json() as any[])[0]).toMatchObject({ cost_per_gram_usd: null, retail_price_per_gram_usd: null });
    const publicResponse = await request(db, '/api/s/shop/products');
    expect(publicResponse.status).toBe(200);
    expect((await publicResponse.json() as any[])[0].retail_price_per_gram_usd).toBeNull();
  });
  for (const source of ['schema','migrations'] as const) {
    it(`refuses new order before any invoice/inquiry/customer effect (${source})`, async () => {
      const db = seed(source), before = effects(db);
      const sequence = db.sqlite.prepare("SELECT invoice_seq FROM accounts WHERE id='shop'").get();
      const response = await request(db, '/api/inquiries', payload());
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'Product price is unavailable' });
      expect(effects(db)).toEqual(before);
      expect(db.sqlite.prepare("SELECT invoice_seq FROM accounts WHERE id='shop'").get()).toEqual(sequence);
      expect(fetch).not.toHaveBeenCalled();
    });
  }
  it('refuses converting a saved request before allocating or writing an invoice', async () => {
    const db = seed();
    db.sqlite.prepare(`INSERT INTO inquiries(id,account_id,name,email,items,currency,source,ref_number) VALUES('request','shop','Guest','guest@example.test',?,'USD','website','FIXTURE')`).run(JSON.stringify(items));
    const before = effects(db);
    const response = await request(db, '/api/inquiries/request/convert', {}, true);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Product price is unavailable' });
    expect(effects(db)).toEqual(before);
    expect(db.sqlite.prepare("SELECT converted_invoice_id FROM inquiries WHERE id='request'").get()).toEqual({ converted_invoice_id: null });
  });
  for (const [name, setup] of [
    ['valid shop FX', "INSERT INTO exchange_rates(currency,rate_to_usd) VALUES('Yuan',7.1)"],
    ['CNY alias', "UPDATE accounts SET default_shipping_rate_currency='CNY' WHERE id='shop'; INSERT INTO exchange_rates(currency,rate_to_usd) VALUES('Yuan',7.1)"],
    ['explicit shop zero', "UPDATE accounts SET default_shipping_rate_per_kg=0 WHERE id='shop'"],
    ['explicit product zero', "UPDATE products SET shipping_rate_per_kg=0 WHERE id='tea'"],
    ['valid own USD freight', "UPDATE products SET shipping_rate_per_kg=30 WHERE id='tea'"],
    ['fixed retail override', "UPDATE products SET fixed_retail_price_usd=.5 WHERE id='tea'"],
    ['fixed retail with missing cost FX', "UPDATE products SET cost_currency='MISSING',fixed_retail_price_usd=.5 WHERE id='tea'"],
    ['legacy UNK with zero freight', "UPDATE products SET cost_currency='UNK',shipping_rate_per_kg=0 WHERE id='tea'"],
    ['teaware', "UPDATE products SET type='Teaware' WHERE id='tea'"],
  ]) {
    it(`retains usable pricing and draft persistence for ${name}`, async () => {
      const db = seed(); db.sqlite.exec(setup);
      const response = await request(db, '/api/inquiries', payload());
      expect(response.status).toBe(201);
      const saved = await response.json() as any;
      const line = db.sqlite.prepare('SELECT price_at_sale FROM invoice_line_items WHERE invoice_id=?').get(saved.invoice_id) as { price_at_sale: number };
      expect(Number.isFinite(line.price_at_sale)).toBe(true);
      expect(line.price_at_sale).toBeGreaterThan(0);
      if (name === 'valid shop FX' || name === 'CNY alias') expect(line.price_at_sale).toBe(.36);
      if (name.startsWith('fixed retail')) expect(line.price_at_sale).toBe(.52);
    });
  }
});
