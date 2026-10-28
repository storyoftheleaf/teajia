import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const secret = 'local-curate-through-sale-test';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

describe.each(['schema', 'migrations'] as const)('Curate through completed sale (%s)', source => {
  it('retains captured facts, receives once, publishes deliberately, sells and ships once', async () => {
    const db = new SqliteD1(source); databases.push(db);
    seedIdentity(db, { userId: 'flow-owner', accountId: 'flow-shop', bundles: ['catalog', 'stock', 'publish', 'sell'] });
    seedIdentity(db, { userId: 'flow-customer', accountId: 'customer-home' });
    db.sqlite.exec("UPDATE users SET email_verified_at=datetime('now') WHERE id='flow-customer'; UPDATE accounts SET default_shipping_rate_per_kg=85,default_shipping_rate_currency='Yuan' WHERE id='flow-shop'; INSERT OR REPLACE INTO exchange_rates(currency,rate_to_usd) VALUES('Yuan',7.2),('USD',1);");
    const owner = await signedToken(secret, { sub: 'flow-owner', email: 'flow-owner@test.dev', active_account_id: 'flow-shop', role: 'owner' });
    const customer = await signedToken(secret, { sub: 'flow-customer', email: 'flow-customer@test.dev', active_account_id: 'customer-home', role: 'owner' });
    const env = { DB: db, JWT_SECRET: secret, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } };
    async function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', token = owner) {
      const background: Promise<unknown>[] = [];
      const response = await worker.fetch(new Request(`https://app.test${path}`, { method, headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(token === owner ? { 'X-Teajia-Account': 'flow-shop' } : {}),
      }, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, { waitUntil: (task: Promise<unknown>) => background.push(task) } as never);
      await Promise.all(background);
      const data = await response.json() as any;
      expect(response.status, `${method} ${path}: ${JSON.stringify(data)}`).toBeLessThan(300);
      return data;
    }
    const capture = { id: 'flow-capture', name: 'Flow red tea', category: 'tea', type: 'Red',
      origin_country: 'China', origin_region: 'Yunnan', vendor_name: 'Flow farm', year: '2025', form: 'Loose',
      price_amount: 100, price_currency: 'CNY', price_per_unit_grams: 100, buy_total: 500, buy_quantity_grams: 500,
      notes: 'Original sourcing note', tasting: { flavor: ['orchid'] }, photos: ['https://example.test/tea.jpg'] };
    await request('/api/compass/sync', { entries: [capture] });
    const sourceRows = await request('/api/compass/entries');
    expect(sourceRows.entries.find((row: any) => row.id === capture.id)).toMatchObject({ origin_country: 'China', price_amount: 100, price_per_unit_grams: 100 });
    const proposal = await request(`/api/compass/entries/${capture.id}/receipt-proposals`, {
      purpose: 'working', quantity: 500, unit: 'g', acquisition_kind: 'purchase', idempotency_key: 'flow-first-receipt',
    });
    const received = await request(`/api/curate/receipt-proposals/${proposal.id}/accept`, {});
    const replay = await request(`/api/curate/receipt-proposals/${proposal.id}/accept`, {});
    expect(replay).toMatchObject({ product_id: received.product_id, ledger_id: received.ledger_id, alreadyAccepted: true });
    const productId = received.product_id;
    const product = () => db.sqlite.prepare('SELECT * FROM products WHERE id=?').get(productId) as any;
    expect(product()).toMatchObject({ stock_grams: 500, is_public: 0, shown_in_shop: 0, origin_country: 'China', origin_region: 'Yunnan', source_compass_entry_id: capture.id });
    expect(Number(product().cost_amount) / Number(product().quantity_purchased)).toBeCloseTo(1);
    expect(product().shipping_rate_per_kg).toBeNull();
    expect((await request('/api/s/flow-shop/products', undefined, 'GET', '')).some((row: any) => row.id === productId)).toBe(false);
    await request(`/api/products/${productId}/publication`, { status: 'Active' }, 'PUT');
    await request(`/api/products/${productId}/publication`, { is_public: true }, 'PUT');
    await request(`/api/products/${productId}/shown`, { shown_in_shop: true }, 'PUT');
    const shelf = await request('/api/s/flow-shop/products', undefined, 'GET', '');
    expect(shelf.find((row: any) => row.id === productId)).toBeTruthy();
    const tracking = 'localcuratetosaleprivatetrackingtoken123456789';
    const payload = { source: 'website', store_slug: 'flow-shop', tracking_token: tracking, ref_number: 'FLOW-SALE',
      customer_name: 'Flow customer', customer_contact: 'flow-customer@test.dev', customer_location: 'Ubud', currency: 'USD', total_estimate_usd: 0.01,
      items: [{ id: productId, name: 'Flow red tea', category: 'tea', storeSlug: 'flow-shop', quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0.0002, totalPrice: 0.01 }] };
    const sale = await request('/api/inquiries', payload, 'POST', customer);
    const repeated = await request('/api/inquiries', payload, 'POST', customer);
    expect(repeated.invoice_id).toBe(sale.invoice_id);
    expect(sale.total_estimate_usd).toBeGreaterThan(20);
    expect(sale.invoice_items[0]).toMatchObject({ product_id: productId, quantity: 50, quantity_unit: 'g' });
    expect(product().stock_grams).toBe(500);
    const invoiceId = sale.invoice_id;
    expect((await request('/api/me/orders', undefined, 'GET', customer)).orders.find((row: any) => row.id === invoiceId)?.status).toBe('Draft');
    await request(`/api/invoices/${invoiceId}`, { status: 'Pending', shipping_cost_usd: 3 }, 'PUT');
    const payment = { amount_usd: sale.total_estimate_usd + 3, method_label: 'Cash', request_id: 'flow-payment-once' };
    await request(`/api/invoices/${invoiceId}/payments`, payment);
    await request(`/api/invoices/${invoiceId}/payments`, payment);
    expect(product().stock_grams).toBe(450);
    const shipping = { invoice_id: invoiceId, tracking_number: 'LOCAL-TRACKING' };
    await request('/api/rpc/ship-invoice', shipping);
    await request('/api/rpc/ship-invoice', shipping);
    expect(product().stock_grams).toBe(450);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id=? AND reason='PAYMENT_CONFIRMED'").get(invoiceId)).toEqual({ n: 1 });
    const history = await request(`/api/me/orders/${invoiceId}`, undefined, 'GET', customer);
    expect(history).toMatchObject({ status: 'Filled', tracking_number: 'LOCAL-TRACKING' });
    expect(history.items[0]).toMatchObject({ quantity: 50, quantity_unit: 'g' });
    const tracked = await request(`/api/inquiries/${tracking}`, undefined, 'GET', '');
    expect(tracked.order).toMatchObject({ status: 'Filled', tracking_number: 'LOCAL-TRACKING' });
    expect(tracked.invoice_items[0]).toMatchObject({ product_id: productId, quantity: 50, quantity_unit: 'g' });
    expect(db.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  }, 30_000);
});
