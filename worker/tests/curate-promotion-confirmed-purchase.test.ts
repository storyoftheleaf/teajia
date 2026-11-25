import { describe, expect, it } from 'vitest';
import { promoteCompassEntry } from '../src/curatePromotion';
import { curatePromotionTools } from '../src/mcpTools/curatePromotion';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const auth = { accountId: 'shop', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token', creatorTier: 'account_owner' };
const moneyFields = (row: Record<string, any>) => ({
  cost_amount: row.cost_amount,
  cost_currency: row.cost_currency,
  quantity_purchased: row.quantity_purchased,
});

function database(values: { status: string; buyTotal: number | null; buyQuantityGrams: number | null }) {
  const db = new SqliteD1();
  seedIdentity(db, { accountId: 'shop', userId: 'owner', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO tea_compass_entries
    (id, account_id, user_id, name, category, type, status, price_amount, price_currency,
     price_per_unit_grams, buy_total, buy_quantity_grams)
    VALUES ('tea', 'shop', 'owner', 'Confirmed tea', 'tea', 'Sheng', ?, 300, 'Yuan', 100, ?, ?)`)
    .run(values.status, values.buyTotal, values.buyQuantityGrams);
  return db;
}

const call = (db: SqliteD1, args: Record<string, unknown>) =>
  curatePromotionTools.handlers.curate_promote_tea({ DB: db } as any, auth, args) as Promise<any>;

describe('Curate promotion carries only a confirmed acquisition into Inventory', () => {
  it.each([
    {
      label: 'confirmed in-stock purchase',
      input: { status: 'in_stock', buyTotal: 750, buyQuantityGrams: 250 },
      expected: { cost_amount: 750, cost_currency: 'Yuan', quantity_purchased: 250 },
    },
    {
      label: 'imported buying row with a populated total',
      input: { status: 'buying', buyTotal: 750, buyQuantityGrams: 250 },
      expected: { cost_amount: null, cost_currency: null, quantity_purchased: null },
    },
    {
      label: 'plain quote',
      input: { status: 'noted', buyTotal: null, buyQuantityGrams: null },
      expected: { cost_amount: null, cost_currency: null, quantity_purchased: null },
    },
  ])('$label: preview exactly matches the persisted private zero-stock draft', async ({ input, expected }) => {
    const db = database(input);
    const preview = await call(db, { tea_id: 'tea' });
    expect(moneyFields(preview.preview.creates)).toEqual(expected);

    const committed = await call(db, { confirm: preview.confirmation_token });
    const product = db.sqlite.prepare('SELECT * FROM products WHERE id = ?').get(committed.id) as Record<string, any>;
    expect(moneyFields(product)).toEqual(expected);
    expect(moneyFields(preview.preview.creates)).toEqual(moneyFields(product));
    expect(product).toMatchObject({ status: 'Draft', is_public: 0, shown_in_shop: 0, stock_grams: 0 });
    expect(product.cost_currency_source).toBe(expected.cost_currency ? 'stated' : null);

    const retry = await promoteCompassEntry(db as any, 'shop', db.sqlite.prepare("SELECT * FROM tea_compass_entries WHERE id='tea'").get() as any);
    expect(retry).toMatchObject({ id: committed.id, alreadyPromoted: true });
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM products').get()).toMatchObject({ count: 1 });
    expect(moneyFields(db.sqlite.prepare('SELECT * FROM products WHERE id = ?').get(committed.id) as any)).toEqual(expected);
  });

  it('keeps an explicitly recorded zero total and its currency provenance', async () => {
    const db = database({ status: 'in_stock', buyTotal: 0, buyQuantityGrams: 250 });
    const expected = { cost_amount: 0, cost_currency: 'Yuan', quantity_purchased: 250 };
    const preview = await call(db, { tea_id: 'tea' });
    expect(moneyFields(preview.preview.creates)).toEqual(expected);
    const committed = await call(db, { confirm: preview.confirmation_token });
    expect(moneyFields(committed.product)).toEqual(expected);
    expect(moneyFields(preview.preview.creates)).toEqual(moneyFields(committed.product));
    expect(committed.product.cost_currency_source).toBe('stated');
  });
});
