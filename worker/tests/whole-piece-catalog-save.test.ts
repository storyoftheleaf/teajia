import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
const secret = 'whole-piece-catalog-regression';
afterEach(() => { databases.splice(0).forEach(db => db.close()); });

async function fixture() {
  const db = new SqliteD1(); databases.push(db);
  seedIdentity(db, { accountId: 'piece-shop', userId: 'piece-owner', bundles: ['catalog', 'stock', 'publish'] });
  db.exec(`INSERT INTO products
    (id, account_id, product_name, type, form, status, is_public, shown_in_shop,
     stock_grams, cost_amount, cost_currency, quantity_purchased, piece_weight_g, sold_in_whole_units)
    VALUES ('piece-tea', 'piece-shop', 'Sample of a cake', 'Oolong', 'Loose', 'Active', 1, 1,
      43, 35, 'Yuan', 50, NULL, 0);
    INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, form)
    VALUES ('prof_piece-tea', 'sample-cake', 'piece-shop', 'piece-shop', 'Sample of a cake', 'Loose');
    INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, stock_grams)
    VALUES ('list_piece-tea', 'piece-shop', 'prof_piece-tea', 'piece-tea', 43);
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('Yuan', 7), ('USD', 1);`);
  const sql: string[] = [];
  const statementSql = new Map<object, string>();
  // Run the real schema for writes and reads. Public product reads batch SELECTs;
  // catalog writes batch product/profile mutations in the same transaction.
  const DB = {
    prepare(query: string) {
      sql.push(query);
      const statement = db.prepare(query);
      statementSql.set(statement, query);
      return statement;
    },
    batch(statements: Array<ReturnType<SqliteD1['prepare']>>) {
      return statements.every(statement => /^\s*SELECT\b/i.test(statementSql.get(statement) || ''))
        ? statements.map(statement => statement.all())
        : db.batch(statements);
    },
  };
  const token = await signedToken(secret, { sub: 'piece-owner', email: 'piece-owner@test.dev', role: 'owner', active_account_id: 'piece-shop' });
  const call = (path: string, body?: Record<string, unknown>) => worker.fetch(new Request(`https://worker.test${path}`, {
    method: body ? 'PUT' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'piece-shop', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), { DB, JWT_SECRET: secret } as any);
  return { db, call, sql };
}

describe('whole-piece metadata belongs to the physical product', () => {
  it('saves form, piece weight and whole-only together without writing nonexistent listing columns or changing stock', async () => {
    const { db, call, sql } = await fixture();
    const listingColumns = db.sqlite.prepare('PRAGMA table_info(product_listings)').all().map(row => row.name);
    expect(listingColumns).not.toContain('piece_weight_g');
    expect(listingColumns).not.toContain('sold_in_whole_units');

    const response = await call('/api/products/piece-tea/catalog', { form: 'Cake', piece_weight_g: 357, sold_in_whole_units: true });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(db.sqlite.prepare('SELECT form, piece_weight_g, sold_in_whole_units, stock_grams, cost_amount, quantity_purchased FROM products WHERE id = ?').get('piece-tea')).toMatchObject({
      form: 'Cake', piece_weight_g: 357, sold_in_whole_units: 1, stock_grams: 43, cost_amount: 35, quantity_purchased: 50,
    });
    expect(db.sqlite.prepare('SELECT form FROM tea_profiles WHERE id = ?').get('prof_piece-tea')).toMatchObject({ form: 'Cake' });
    expect(db.sqlite.prepare('SELECT stock_grams FROM product_listings WHERE id = ?').get('list_piece-tea')).toMatchObject({ stock_grams: 43 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toMatchObject({ count: 0 });
    expect(sql.filter(query => /UPDATE\s+product_listings/i.test(query))).toEqual([]);

    const publicResponse = await call('/api/s/piece-shop/products');
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toEqual(expect.arrayContaining([expect.objectContaining({
      id: 'piece-tea', form: 'Cake', piece_weight_g: 357, sold_in_whole_units: 1, stock_grams: 43,
    })]));

    const cleared = await call('/api/products/piece-tea/catalog', { piece_weight_g: null, sold_in_whole_units: false });
    expect(cleared.status, await cleared.clone().text()).toBe(200);
    expect(db.sqlite.prepare('SELECT piece_weight_g, sold_in_whole_units, stock_grams FROM products WHERE id = ?').get('piece-tea')).toMatchObject({
      piece_weight_g: null, sold_in_whole_units: 0, stock_grams: 43,
    });
  });
});
