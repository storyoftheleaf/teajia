import { describe, expect, it } from 'vitest';
import worker from '../src/index';

class Statement {
  values: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  all() { return { results: [] }; }
  first() { return null; }
  run() { return { meta: { changes: 0 } }; }
}

class XrefDb {
  prepare(sql: string) { return new Statement(sql); }
  batch(statements: Statement[]) {
    const productQuery = statements[1];
    const tenancyCorrect = /join articles/i.test(productQuery.sql)
      && /p\.account_id\s*=\s*(?:a|source)\.account_id/i.test(productQuery.sql)
      && productQuery.values.length === 1;
    return [
      { results: [{ currency: 'USD', rate_to_usd: 1 }] },
      { results: tenancyCorrect ? [{
        id: 'other-tea', type: 'Oolong', given_name: 'Other Tea', product_name: 'Other Tea',
        stock_grams: 100, status: 'Active', is_public: 1, shown_in_shop: 1,
        tasting_notes: '[]', additional_images: '[]', tasting: '{}', cost_currency: 'USD',
        account_slug: 'other-store', public_path: '/shop/product/other-tea?store=other-store',
      }] : [] },
    ];
  }
}

describe('public article product xref tenancy', () => {
  it('resolves products in the published article account instead of the Bali account constant', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/api/public/xref/articles/article-other/products'),
      { DB: new XrefDb() } as any,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{
      id: 'other-tea', public_path: '/shop/product/other-tea?store=other-store', account_slug: 'other-store',
    }]);
  });
});
