import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { orderNoticeRecipient } from '../src/orderNoticeRecipient';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  databases.splice(0).forEach(db => db.close());
});

// The shop in this fixture is a personal seller's own Tea Chest store.
function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'seller', accountId: 'chest', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE users SET email = 'mei@seller.test' WHERE id = 'seller';
    UPDATE accounts SET personal_inventory_user_id = 'seller', owner_user_id = 'seller', contact_email = NULL,
      personal_seller_approved_at = '2026-11-24T00:00:00Z',
      default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD' WHERE id = 'chest';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
    VALUES ('tea', 'chest', 'Oolong', 'Spring Mountain oolong', 'Loose', 20, 'USD', 300, 1000);
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
    VALUES ('mei', 'chest', 'seller', 'Mei Lin', 1);
    INSERT INTO payment_methods (id, contributor_id, method_type, label, recipient_name, position, is_published)
    VALUES ('method', 'mei', 'bank_transfer', 'Bank', 'Mei Lin', 0, 1);
  `);
  return db;
}

function order(db: SqliteD1) {
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'website', store_slug: 'chest', tracking_token: 'sellernoticetrackingtoken0000000000001', ref_number: 'TJ-SELLER',
      customer_name: 'Buyer Name', customer_contact: 'buyer@example.com', customer_location: 'Ubud, Indonesia',
      currency: 'USD', total_estimate_usd: 14,
      items: [{ id: 'tea', name: 'Spring Mountain oolong', category: 'tea', storeSlug: 'chest', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14 }],
    }),
  }), {
    DB: db, JWT_SECRET: 'notice-test', INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
    SENDER_EMAIL: 'teajia@example.com', RESEND_API_KEY: 'test-key',
  } as never, {} as never);
}

const recipients = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.map(call => JSON.parse(String((call as any)[1].body)) as { to: string; html: string });

describe('a personal seller hears about their own orders', () => {
  it('sends the buyer’s details to the seller’s sign-in email, never to Teajia’s inbox', async () => {
    const db = seed();
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect((await order(db)).status).toBe(201);
    const sent = recipients(fetch);
    const notice = sent.find(mail => mail.html.includes('Buyer Name') && mail.to !== 'buyer@example.com');
    expect(notice?.to).toBe('mei@seller.test');
    expect(sent.map(mail => mail.to)).not.toContain('teajia@example.com');
  });

  it('records a problem instead of sending when the seller has no address', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE users SET email = '' WHERE id = 'seller'");
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect((await order(db)).status).toBe(201);
    expect(recipients(fetch).map(mail => mail.to)).toEqual(['buyer@example.com']);
    expect(db.sqlite.prepare("SELECT error_code FROM incident_ledger WHERE error_code = 'personal_seller_no_order_address'").get())
      .toEqual({ error_code: 'personal_seller_no_order_address' });
  });

  it('keeps a shop’s notice on its contact address, then Teajia’s inbox', () => {
    expect(orderNoticeRecipient({ contact_email: 'shop@x.test' }, 'teajia@x.test')).toBe('shop@x.test');
    expect(orderNoticeRecipient({ contact_email: null }, 'teajia@x.test')).toBe('teajia@x.test');
    expect(orderNoticeRecipient({ personal_inventory_user_id: 'u', owner_email: ' ' }, 'teajia@x.test')).toBeNull();
  });
});
