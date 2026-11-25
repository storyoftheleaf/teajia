import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const BALI = 'acc_teajia_bali';
// A repair lot: the reviewed wording replaces whatever the product row still holds.
const REPAIRED_LOT = 'e5e7c9ec-d66b-48de-9197-272ffdb638e0';
const REVIEWED = 'Xiniu Tang (犀牛塘) means “Rhinoceros Pond.” This tea is a ripe pu’er pressed into a cake.';
const OLD_WORDING = 'OLD description that the review replaced';
const ORDINARY_LOT = 'ordinary-lot';

function seed() {
  const db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: BALI, accountSlug: 'teajia-bali' });
  const add = db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, type, fixed_retail_price_usd, stock_grams, is_public, shown_in_shop, status, description)
    VALUES (?, ?, ?, 'Dark', 2, 600, 1, 1, 'Active', ?)`);
  add.run(REPAIRED_LOT, BALI, 'Xiniu Tang Gushu', OLD_WORDING);
  add.run(ORDINARY_LOT, BALI, 'Ordinary', 'Stored wording stays');
  db.sqlite.prepare(`INSERT INTO articles (id, account_id, title, slug, status) VALUES ('art-1', ?, 'A story', 'a-story', 'published')`).run(BALI);
  db.sqlite.prepare('INSERT INTO article_products (article_id, product_id) VALUES (?, ?), (?, ?)')
    .run('art-1', REPAIRED_LOT, 'art-1', ORDINARY_LOT);
  return db;
}

describe('reviewed wording reaches every public door', () => {
  it('serves it from /mcp/public get_tea', async () => {
    const db = seed();
    try {
      const limiter = { limit: async () => ({ success: true }) };
      const call = async (id: string) => {
        const response = await worker.fetch(new Request('https://api.test/mcp/public?account=teajia-bali', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.90' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_tea', arguments: { id } } }),
        }), { DB: db, PUBLIC_MCP_LIMITER: limiter } as never, {} as never);
        expect(response.status).toBe(200);
        const body = await response.json() as { result: { content: { text: string }[] } };
        return JSON.parse(body.result.content[0].text);
      };
      expect((await call(REPAIRED_LOT)).description).toBe(REVIEWED);
      expect((await call(ORDINARY_LOT)).description).toBe('Stored wording stays');
    } finally { db.close(); }
  });

  it('serves it from the public article xref', async () => {
    const db = seed();
    try {
      const response = await worker.fetch(
        new Request('https://api.test/api/public/xref/articles/art-1/products'),
        { DB: db } as never, {} as never,
      );
      expect(response.status).toBe(200);
      const rows = await response.json() as { id: string; description: string | null }[];
      expect(rows.find(row => row.id === REPAIRED_LOT)?.description).toBe(REVIEWED);
      expect(rows.find(row => row.id === ORDINARY_LOT)?.description).toBe('Stored wording stays');
    } finally { db.close(); }
  });

  it('still serves it from the public product route that was already covered', async () => {
    const db = seed();
    try {
      const response = await worker.fetch(
        new Request(`https://api.test/api/products/public/${REPAIRED_LOT}`),
        { DB: db } as never, {} as never,
      );
      expect(response.status).toBe(200);
      expect(JSON.stringify(await response.json())).toContain('Rhinoceros Pond');
    } finally { db.close(); }
  });
});
