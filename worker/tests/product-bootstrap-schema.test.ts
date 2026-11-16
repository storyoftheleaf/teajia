import { describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { tableInfo } from './helpers/migratedSqlite';

const HISTORICAL_COLUMNS = ['year', 'updated_at', 'account_id', 'catalog_visible'];
const MONEY_COLUMNS = ['cost_amount', 'shipping_rate_per_kg', 'markup_multiplier'];

describe('product bootstrap agrees with the committed migration ledger', () => {
  it('keeps the four historical column definitions and money defaults aligned', () => {
    const reference = new SqliteD1('schema');
    const ledger = new SqliteD1('migrations');
    try {
      for (const table of ['products', 'product_listings']) {
        const columns = table === 'products' ? [...HISTORICAL_COLUMNS, ...MONEY_COLUMNS] : MONEY_COLUMNS;
        for (const name of columns) {
          const expected = tableInfo(ledger.sqlite, table).find(column => column.name === name);
          expect(expected, `${table}.${name} exists in the ledger`).toBeDefined();
          // Column position differs after ALTERs; it is not a column contract.
          expect(tableInfo(reference.sqlite, table).find(column => column.name === name), `${table}.${name}`)
            .toMatchObject({ name, type: expected!.type, notnull: expected!.notnull,
              dflt_value: expected!.dflt_value, pk: expected!.pk });
        }
      }
    } finally {
      reference.close();
      ledger.close();
    }
  });

  for (const source of ['schema', 'migrations'] as const) {
    it(`${source}: fresh rows preserve omitted values and SQLite year affinity`, () => {
      const db = new SqliteD1(source);
      try {
        db.sqlite.prepare(`INSERT INTO products (id, type, product_name, year)
          VALUES ('bootstrap-probe', 'Puerh', 'Synthetic tea', '2024')`).run();
        expect(db.sqlite.prepare(`SELECT account_id, updated_at, catalog_visible,
          typeof(year) AS year_type, cost_amount, shipping_rate_per_kg, markup_multiplier
          FROM products WHERE id = 'bootstrap-probe'`).get()).toEqual({
          account_id: null, updated_at: null, catalog_visible: 0, year_type: 'integer',
          cost_amount: null, shipping_rate_per_kg: null, markup_multiplier: null,
        });
        expect(() => db.sqlite.prepare(`INSERT INTO products
          (id, type, product_name, catalog_visible) VALUES ('null-probe', 'Puerh', 'Synthetic tea', NULL)`)
          .run()).toThrow(/NOT NULL constraint failed: products.catalog_visible/);
      } finally {
        db.close();
      }
    });
  }
});
