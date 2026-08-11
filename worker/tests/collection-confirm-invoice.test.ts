import { describe, expect, it } from 'vitest';
import worker from '../src/index';

type ProductFixture = {
  type: string;
  status?: string;
  recommendedQuantity: number;
  recommendedPriceUsd: number;
  pickedQuantity: number;
};

class ConfirmCollectionDb {
  insertedLine: { product_id: string | null; custom_name: string | null; quantity: number; price_at_sale: number } | null = null;

  constructor(private fixture: ProductFixture) {}

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let bindings: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bindings = values;
        if (normalized.startsWith('insert into invoice_line_items')) {
          this.insertedLine = {
            product_id: values[3] == null ? null : String(values[3]),
            custom_name: values[4] == null ? null : String(values[4]),
            quantity: Number(values[5]),
            price_at_sale: Number(values[6]),
          };
        }
        return statement;
      },
      first: async () => {
        if (normalized.includes('from collection_publications where slug = ?')) {
          return { id: 'publication-1', collection_id: 'collection-1', unpublished_at: null, recipients_json: '[]' };
        }
        if (normalized.includes('from collections where id = ?')) {
          return { id: 'collection-1', account_id: 'account-1', title: 'Test collection', status: 'active' };
        }
        if (normalized.startsWith('update accounts set invoice_seq')) {
          return { invoice_seq: 7, invoice_prefix: 'INV' };
        }
        return null;
      },
      all: async () => {
        if (normalized.includes('from collection_items ci')) {
          return {
            results: [{
              id: 'item-1',
              product_id: 'product-1',
              recommended_quantity: this.fixture.recommendedQuantity,
              recommended_price_usd: this.fixture.recommendedPriceUsd,
              product_type: this.fixture.type,
              product_name: 'Test item',
              product_status: this.fixture.status ?? 'Active',
              fixed_retail_price_usd: null,
            }],
          };
        }
        return { results: [] };
      },
      run: async () => ({ success: true, meta: { changes: 1 }, bindings }),
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map(statement => statement.run()));
  }
}

describe('collection confirmation invoice lines', () => {
  it.each([
    ['tea', { type: 'Oolong', recommendedQuantity: 50, recommendedPriceUsd: 12, pickedQuantity: 100 }, { quantity: 100, price_at_sale: 0.24, total: 24, product_id: 'product-1', custom_name: null }],
    ['teaware', { type: 'Teaware', recommendedQuantity: 1, recommendedPriceUsd: 18, pickedQuantity: 2 }, { quantity: 2, price_at_sale: 18, total: 36, product_id: null, custom_name: 'Test item' }],
    ['misc', { type: 'Misc', recommendedQuantity: 1, recommendedPriceUsd: 6, pickedQuantity: 3 }, { quantity: 3, price_at_sale: 6, total: 18, product_id: null, custom_name: 'Test item' }],
    ['unclassified', { type: 'MISSING_TYPE', recommendedQuantity: 10, recommendedPriceUsd: 4, pickedQuantity: 2 }, { quantity: 2, price_at_sale: 0.4, total: 0.8, product_id: null, custom_name: 'Test item' }],
  ] as const)('stores the confirmed %s with safe linkage and pricing', async (_label, fixture, expected) => {
    const db = new ConfirmCollectionDb(fixture);
    const response = await worker.fetch(new Request('https://worker.test/api/public/c/test-slug/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `test-${fixture.type}` },
      body: JSON.stringify({ picks: [{ item_id: 'item-1', quantity: fixture.pickedQuantity }] }),
    }), { DB: db } as any);

    expect(response.status).toBe(201);
    const { total, ...expectedLine } = expected;
    expect(db.insertedLine).toMatchObject(expectedLine);
    expect(db.insertedLine!.quantity * db.insertedLine!.price_at_sale).toBe(total);
  });

  it('rejects a Draft product without creating an invoice line', async () => {
    const db = new ConfirmCollectionDb({
      type: 'Oolong', status: 'Draft', recommendedQuantity: 50, recommendedPriceUsd: 12, pickedQuantity: 50,
    });
    const response = await worker.fetch(new Request('https://worker.test/api/public/c/test-slug/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'test-draft' },
      body: JSON.stringify({ picks: [{ item_id: 'item-1', quantity: 50 }] }),
    }), { DB: db } as any);

    expect(response.status).toBe(400);
    expect(db.insertedLine).toBeNull();
  });
});
