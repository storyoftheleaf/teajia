import { describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { priceLinkTools } from '../src/mcpTools/priceLinks';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';

/**
 * The two agent doors for "show a friend what these teas cost": an invoice
 * that leaves stock alone, and a private collection link that never reaches
 * the public shop.
 */
const A = 'acct-a';
const auth = (accountId = A): ToolAuth => ({ accountId, userId: 'u1', userEmail: 'u1@example.invalid', tokenId: 't1', creatorTier: 'account_owner' });

function setup() {
  const db = new SqliteD1('migrations');
  db.exec(`INSERT INTO accounts (id, slug, name) VALUES ('${A}', 'shop-a', 'Shop A'), ('acct-b', 'shop-b', 'Shop B')`);
  db.exec("INSERT INTO users (id, name, email, password_hash) VALUES ('u1', 'Owner', 'u1@example.invalid', 'x')");
  db.exec(`INSERT INTO products (id, account_id, type, product_name, given_name, status, stock_grams) VALUES
    ('cake', '${A}', 'Shou Puer', '1980s Guogai Bing', NULL, 'Active', 400),
    ('brick', '${A}', 'Shou Puer', '1990s Brick', NULL, 'Active', 600),
    ('theirs', 'acct-b', 'Shou Puer', 'Not yours', NULL, 'Active', 100)`);
  const payUrls: string[] = [];
  const env = {
    DB: db as unknown as D1Database,
    APP_URL: 'https://shop.example',
    invoicePayLinks: { payUrl: async (_a: string, id: string) => { payUrls.push(id); return `https://shop.example/pay/x?invoice=${id}`; } },
  } as ToolEnv;
  return { db, env, payUrls };
}
const call = (env: ToolEnv, name: string, args: Record<string, unknown>, who = auth()) =>
  priceLinkTools.handlers[name](env, who, args) as Promise<Record<string, any>>;

const lines = [
  { product_id: 'cake', grams: 150, price_per_gram_usd: 1.21 },
  { product_id: 'brick', grams: 10, price_per_gram_usd: 0 },
];

describe('draft_invoice', () => {
  it('previews, then writes an unfulfilled invoice with its pay link and leaves stock alone', async () => {
    const { db, env, payUrls } = setup();
    const preview = await call(env, 'draft_invoice', { customer_name: 'Tia', lines });
    expect(preview.preview.total_usd).toBe(181.5);
    expect(preview.preview.lines[0].product.name).toBe('1980s Guogai Bing');
    expect(await db.prepare('SELECT count(*) AS n FROM invoices').first()).toEqual({ n: 0 });

    const done = await call(env, 'draft_invoice', { customer_name: 'Tia', lines, confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, total_usd: 181.5 });
    expect(done.pay_url).toContain(done.invoice_id);
    expect(payUrls).toEqual([done.invoice_id]);
    expect(await db.prepare('SELECT status, inventory_deducted, payment_status, sold_by_user_id FROM invoices WHERE id = ?').bind(done.invoice_id).first())
      .toEqual({ status: 'Draft', inventory_deducted: 0, payment_status: 'unpaid', sold_by_user_id: 'u1' });
    const items = await db.prepare('SELECT product_id, quantity, price_at_sale, quantity_unit FROM invoice_line_items WHERE invoice_id = ? ORDER BY product_id').bind(done.invoice_id).all();
    expect(items.results).toEqual([
      { product_id: 'brick', quantity: 10, price_at_sale: 0, quantity_unit: 'g' },
      { product_id: 'cake', quantity: 150, price_at_sale: 1.21, quantity_unit: 'g' },
    ]);
    expect(await db.prepare("SELECT stock_grams FROM products WHERE id = 'cake'").first()).toEqual({ stock_grams: 400 });
    expect(await db.prepare('SELECT count(*) AS n FROM stock_ledger').first()).toEqual({ n: 0 });
  });

  it('refuses a line with no price, another shop\'s tea, and changed lines at confirm', async () => {
    const { env } = setup();
    expect(await call(env, 'draft_invoice', { customer_name: 'Tia', lines: [{ product_id: 'cake', grams: 10 }] }))
      .toMatchObject({ error: 'price_per_gram_usd_required' });
    expect(await call(env, 'draft_invoice', { customer_name: 'Tia', lines: [{ product_id: 'theirs', grams: 10, price_per_gram_usd: 1 }] }))
      .toMatchObject({ error: 'product_not_found' });
    const preview = await call(env, 'draft_invoice', { customer_name: 'Tia', lines });
    const changed = [{ ...lines[0], grams: 1500 }, lines[1]];
    expect(await call(env, 'draft_invoice', { customer_name: 'Tia', lines: changed, confirm: preview.confirmation_token }))
      .toEqual({ error: 'invalid_or_expired_confirmation_token' });
  });
});

describe('share_collection_link', () => {
  it('opens a private link and never publishes to the shop', async () => {
    const { db, env } = setup();
    db.exec(`INSERT INTO collections (id, account_id, title, status) VALUES ('col-1', '${A}', 'Daniel''s samples', 'draft')`);
    db.exec(`INSERT INTO collection_items (id, collection_id, product_id, position) VALUES ('ci-1', 'col-1', 'cake', 1)`);
    const preview = await call(env, 'share_collection_link', { collection_id: 'col-1', recipient_name: 'Daniel' });
    expect(preview.preview.collection.teas).toBe(1);
    const done = await call(env, 'share_collection_link', { collection_id: 'col-1', recipient_name: 'Daniel', confirm: preview.confirmation_token });
    expect(done.url).toMatch(/^https:\/\/shop\.example\/c\/daniel-s-samples-[0-9a-f]{4}$/);
    const pub = await db.prepare('SELECT target_type, recipients_json FROM collection_publications WHERE slug = ?').bind(done.slug).first<any>();
    expect(pub.target_type).toBe('person');
    expect(JSON.parse(pub.recipients_json)).toEqual([{ name: 'Daniel' }]);
    expect(await db.prepare("SELECT count(*) AS n FROM collection_publications WHERE target_type = 'shop'").first()).toEqual({ n: 0 });
    expect(await db.prepare("SELECT status FROM collections WHERE id = 'col-1'").first()).toEqual({ status: 'active' });
  });

  it('refuses an empty collection and another shop\'s', async () => {
    const { db, env } = setup();
    db.exec(`INSERT INTO collections (id, account_id, title, status) VALUES ('empty', '${A}', 'Empty', 'draft'), ('foreign', 'acct-b', 'Theirs', 'active')`);
    expect(await call(env, 'share_collection_link', { collection_id: 'empty' })).toEqual({ error: 'collection_is_empty' });
    expect(await call(env, 'share_collection_link', { collection_id: 'foreign' })).toEqual({ error: 'collection_not_found' });
  });
});
