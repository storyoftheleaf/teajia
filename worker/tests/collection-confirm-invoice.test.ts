import { describe, expect, it } from 'vitest';
import worker from '../src/index';

type ProductFixture = {
  type: 'Tea' | 'Teaware';
  recommendedQuantity: number;
  recommendedPriceUsd: number;
  pickedQuantity: number;
};

class ConfirmCollectionDb {
  insertedLine: { quantity: number; price_at_sale: number } | null = null;

  constructor(private fixture: ProductFixture) {}

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let bindings: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bindings = values;
        if (normalized.startsWith('insert into invoice_line_items')) {
          this.insertedLine = {
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
              product_status: 'Active',
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
    ['tea', { type: 'Tea', recommendedQuantity: 50, recommendedPriceUsd: 12, pickedQuantity: 100 }, { quantity: 100, price_at_sale: 0.24, total: 24 }],
    ['teaware', { type: 'Teaware', recommendedQuantity: 1, recommendedPriceUsd: 18, pickedQuantity: 2 }, { quantity: 2, price_at_sale: 18, total: 36 }],
  ] as const)('stores the confirmed %s quantity and unit price', async (_label, fixture, expected) => {
    const db = new ConfirmCollectionDb(fixture);
    const response = await worker.fetch(new Request('https://worker.test/api/public/c/test-slug/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `test-${fixture.type}` },
      body: JSON.stringify({ picks: [{ item_id: 'item-1', quantity: fixture.pickedQuantity }] }),
    }), { DB: db } as any);

    expect(response.status).toBe(201);
    expect(db.insertedLine).toMatchObject({ quantity: expected.quantity, price_at_sale: expected.price_at_sale });
    expect(db.insertedLine!.quantity * db.insertedLine!.price_at_sale).toBe(expected.total);
  });
});
