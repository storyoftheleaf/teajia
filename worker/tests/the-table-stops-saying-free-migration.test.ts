import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  columnDefault, foreignKeyChildren, migrationFiles, schemaObjects, seedFromMigrations, splitStatements, tableInfo,
} from './helpers/migratedSqlite';

/**
 * Migration 0018, rehearsed.
 *
 * It removes three column defaults that answer a question nobody asked:
 * `shipping_rate_per_kg` 0 (this tea ships free), `markup_multiplier` 2.5 (the
 * multiplier 0013 cleared off the shelf) and `cost_amount` 0 (a free tea). It
 * must remove them WITHOUT changing a single stored value, because the zeros
 * that are already there include real decisions: teaware whose price has
 * freight inside it, and any tea Adrian deliberately ships free.
 *
 * So every assertion below is about what did NOT change. Row for row, column
 * for column, on both tables, plus every index and trigger sqlite_master holds
 * for them. The only differences allowed are the three defaults and the
 * position the three columns sit at.
 *
 * The shape of the migration is unusual and the reason is in its own header:
 * D1 refuses `PRAGMA foreign_keys = OFF`, so the ordinary create-copy-drop-
 * rename rebuild cascade-deletes `article_products` and `sales_grants` and
 * aborts on `inventory_receipt_lines`. This one alters the columns in place and
 * never drops a table, so the last test here is the one that says so: seed
 * every table that points at these two, run the migration, and find them
 * untouched.
 */

const migration = readFileSync(
  fileURLToPath(new URL('../migrations/0018_the_table_stops_saying_free.sql', import.meta.url)), 'utf8',
);

const THE_THREE = ['shipping_rate_per_kg', 'markup_multiplier', 'cost_amount'] as const;

/**
 * Row shapes worth naming, because each is a different answer that must survive.
 * The first is the one the migration is FOR: nobody entered anything, so the
 * row carries the defaults it was given and has to keep carrying them.
 */
const SHAPES: Array<{ id: string; name: string; rate: number | null; markup: number | null; cost: number | null; note: string }> = [
  { id: 'p-omitted', name: 'Rate omitted', rate: 0, markup: 2.5, cost: 0, note: 'the default landed on it; a free tea shipping free' },
  { id: 'p-free', name: 'Free freight', rate: 0, markup: null, cost: 120, note: 'a deliberate zero, Adrian saying this one ships free' },
  { id: 'p-pinned', name: 'Pinned at 85', rate: 85, markup: null, cost: 120, note: 'a rate somebody entered' },
  { id: 'p-teaware', name: 'A pot', rate: 0, markup: null, cost: 40, note: 'teaware, whose true rate is zero' },
  { id: 'p-old-markup', name: 'Old markup', rate: null, markup: 2.5, cost: 120, note: 'carrying the default multiplier' },
  { id: 'p-set-markup', name: 'Chosen markup', rate: null, markup: 3, cost: 120, note: 'a multiplier somebody chose' },
  { id: 'p-gift', name: 'A gift', rate: null, markup: null, cost: 0, note: 'a typed zero cost, a vendor sample' },
  { id: 'p-follows', name: 'Follows the shop', rate: null, markup: null, cost: 120, note: 'what a tea added after this migration looks like' },
];

/**
 * Every table that points at these two, so the FK hazard is measured not
 * assumed. This used to be a hand-typed list of seven; `PRAGMA
 * foreign_key_list` finds fifteen edges across thirteen tables (six more,
 * all no-action), so the list is now derived at test time from the pragma
 * instead of claimed by hand. See `foreignKeyChildren` in
 * `./helpers/migratedSqlite`.
 */
const PARENTS = ['products', 'product_listings'];

/**
 * The three triggers the LIVE products table carries, verbatim.
 *
 * They are not in the migration ledger. Migration `0000` is a dump of the live
 * schema taken in August 2026 and it captured tables and indexes but no
 * triggers, and `worker/sandbox/refresh.mjs` has to read them back out of
 * live's `sqlite_master` and replay them for the same reason. So a rehearsal
 * seeded from the migrations alone would be testing a products table three
 * triggers lighter than the real one, and `ALTER TABLE ... DROP COLUMN` refuses
 * outright if any trigger body names the column being dropped. Copied here from
 * the sandbox copy of live so that refusal, if it comes, comes here.
 */
const LIVE_TRIGGERS = `
CREATE TRIGGER trg_contact_relationship_product_vendor_insert
AFTER INSERT ON products
WHEN NEW.vendor_id IS NOT NULL AND NEW.vendor_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.vendor_id, 'vendor', 'workflow', 'product', NEW.id);
END;
CREATE TRIGGER trg_contact_relationship_product_vendor_update
AFTER UPDATE OF vendor_id ON products
WHEN NEW.vendor_id IS NOT NULL AND NEW.vendor_id != ''
BEGIN
  INSERT OR IGNORE INTO contact_relationships
    (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
  VALUES (lower(hex(randomblob(16))), NEW.account_id, NEW.vendor_id, 'vendor', 'workflow', 'product', NEW.id);
END;
CREATE TRIGGER trg_products_nonnegative_stock
BEFORE UPDATE OF stock_grams ON products
FOR EACH ROW WHEN NEW.stock_grams < 0
BEGIN
  SELECT RAISE(ABORT, 'stock_grams cannot be negative');
END;
`;

function seeded() {
  const { db } = seedFromMigrations({ through: '0017' });
  db.exec(LIVE_TRIGGERS);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    INSERT INTO accounts (id, slug, name) VALUES ('acc-r', 'rehearsal', 'Rehearsal');
    INSERT INTO users (id, email, name, password_hash, role) VALUES ('user-r', 'r@test.dev', 'R', 'x', 'user');
  `);
  for (const shape of SHAPES) {
    db.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, slug,
        shipping_rate_per_kg, markup_multiplier, cost_amount, cost_currency, stock_grams)
      VALUES (?, 'acc-r', 'Puerh', ?, ?, ?, ?, ?, ?, 'Yuan', 500)`)
      .run(shape.id, shape.name, shape.name, shape.id, shape.rate, shape.markup, shape.cost);
    db.prepare(`INSERT INTO tea_profiles (id, slug, name, originated_by_account_id, curated_by_account_id)
      VALUES (?, ?, ?, 'acc-r', 'acc-r')`).run(`prof_${shape.id}`, `prof-${shape.id}`, shape.name);
    db.prepare(`INSERT INTO product_listings (id, account_id, profile_id,
        shipping_rate_per_kg, markup_multiplier, cost_amount, cost_currency, legacy_product_id)
      VALUES (?, 'acc-r', ?, ?, ?, ?, 'Yuan', ?)`)
      .run(`list_${shape.id}`, `prof_${shape.id}`, shape.rate, shape.markup, shape.cost, shape.id);
  }
  return db;
}

/** Every column of every row, keyed by id, so a comparison misses nothing. */
function snapshot(db: DatabaseSync, table: string) {
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Array<Record<string, unknown>>;
  return new Map(rows.map(r => [String(r.id), r]));
}

function apply(db: DatabaseSync, sql = migration) {
  for (const statement of splitStatements(sql)) db.exec(statement);
}

describe('what the migration is for', () => {
  it('the three defaults are 0, 2.5 and 0 before it, and gone after', () => {
    const db = seeded();
    try {
      for (const table of ['products', 'product_listings']) {
        expect(columnDefault(db, table, 'shipping_rate_per_kg')).toBe('0');
        expect(columnDefault(db, table, 'markup_multiplier')).toBe('2.5');
        expect(columnDefault(db, table, 'cost_amount')).toBe('0');
      }
      apply(db);
      for (const table of ['products', 'product_listings']) {
        for (const column of THE_THREE) {
          expect(columnDefault(db, table, column), `${table}.${column} still has a default`).toBeNull();
        }
      }
    } finally { db.close(); }
  });

  it('a tea added afterwards follows the shop on all three, where before it shipped free', () => {
    const db = seeded();
    try {
      const insert = `INSERT INTO products (id, account_id, type, product_name, given_name, slug)
                      VALUES (?, 'acc-r', 'Puerh', ?, ?, ?)`;
      db.prepare(insert).run('p-before', 'Before', 'Before', 'before');
      const before = db.prepare('SELECT * FROM products WHERE id = ?').get('p-before') as any;
      expect([before.shipping_rate_per_kg, before.markup_multiplier, before.cost_amount]).toEqual([0, 2.5, 0]);

      apply(db);

      db.prepare(insert).run('p-after', 'After', 'After', 'after');
      const after = db.prepare('SELECT * FROM products WHERE id = ?').get('p-after') as any;
      expect([after.shipping_rate_per_kg, after.markup_multiplier, after.cost_amount]).toEqual([null, null, null]);
    } finally { db.close(); }
  });
});

describe('what the migration must not change', () => {
  it('leaves every row of both tables exactly as it found it', () => {
    const db = seeded();
    try {
      const before = { products: snapshot(db, 'products'), product_listings: snapshot(db, 'product_listings') };
      apply(db);
      for (const table of ['products', 'product_listings'] as const) {
        const after = snapshot(db, table);
        expect(after.size, `${table} changed row count`).toBe(before[table].size);
        for (const [id, was] of before[table]) {
          const now = after.get(id);
          expect(now, `${table} lost row ${id}`).toBeTruthy();
          // Key by key, so a column silently blanked is caught rather than a
          // row count that looks reassuring.
          for (const [column, value] of Object.entries(was)) {
            expect(now![column], `${table}.${id}.${column} changed`).toStrictEqual(value);
          }
          expect(Object.keys(now!).sort(), `${table} changed its column set`).toEqual(Object.keys(was).sort());
        }
      }
    } finally { db.close(); }
  });

  it('keeps a deliberate zero a zero, which is the whole risk of this change', () => {
    const db = seeded();
    try {
      apply(db);
      const free = db.prepare('SELECT * FROM products WHERE id = ?').get('p-free') as any;
      expect(free.shipping_rate_per_kg, 'a tea Adrian ships free now follows the shop rate instead').toBe(0);
      const teaware = db.prepare('SELECT * FROM products WHERE id = ?').get('p-teaware') as any;
      expect(teaware.shipping_rate_per_kg).toBe(0);
      const gift = db.prepare('SELECT * FROM products WHERE id = ?').get('p-gift') as any;
      expect(gift.cost_amount, 'a gift stopped being recorded as free').toBe(0);
      const pinned = db.prepare('SELECT * FROM products WHERE id = ?').get('p-pinned') as any;
      expect(pinned.shipping_rate_per_kg).toBe(85);
      const chosen = db.prepare('SELECT * FROM products WHERE id = ?').get('p-set-markup') as any;
      expect(chosen.markup_multiplier).toBe(3);
    } finally { db.close(); }
  });

  it('keeps every index and trigger, because it drops no table', () => {
    const db = seeded();
    try {
      const before = {
        products: schemaObjects(db, 'products'),
        product_listings: schemaObjects(db, 'product_listings'),
      };
      expect(before.products.length, 'the fixture has no indexes, so this proves nothing').toBeGreaterThan(10);
      expect(before.products.filter(o => o.type === 'trigger').length,
        'the live products table carries three triggers; the fixture has none').toBeGreaterThanOrEqual(3);
      apply(db);
      for (const table of ['products', 'product_listings'] as const) {
        expect(schemaObjects(db, table), `${table} lost or gained a schema object`).toEqual(before[table]);
      }
    } finally { db.close(); }
  });

  it('touches no table that points at these two, which the ordinary rebuild would empty', () => {
    const db = seeded();
    try {
      // Derived from the pragma, not hand-typed, and checked for completeness
      // before it is trusted: the hand-typed list this replaced named seven
      // tables while thirteen actually reference products / product_listings.
      const children = foreignKeyChildren(db, PARENTS);
      const uniqueTables = [...new Set(children.map(edge => edge.table))];
      expect(children.length, 'the pragma no longer finds fifteen edges; update this comment and the count below')
        .toBe(15);
      expect(uniqueTables.length, 'the pragma no longer finds thirteen child tables; update this comment and the count above')
        .toBe(13);

      db.exec(`
        INSERT INTO articles (id, account_id, slug, title) VALUES ('art-1', 'acc-r', 'a', 'A');
        INSERT INTO article_products (article_id, product_id) VALUES ('art-1', 'p-pinned');
        INSERT INTO sales_grants (id, account_id, product_id, seller_user_id, granted_by_user_id)
          VALUES ('grant-1', 'acc-r', 'p-pinned', 'user-r', 'user-r');
        INSERT INTO inventory_receipts (id, account_id, state, source_kind, created_by_user_id, idempotency_key, request_fingerprint)
          VALUES ('rec-1', 'acc-r', 'in_transit', 'manual', 'user-r', 'rehearsal-key', '{}');
        INSERT INTO inventory_receipt_lines (id, receipt_id, account_id, product_id, expected_quantity, unit, intended_purpose, source_kind)
          VALUES ('line-1', 'rec-1', 'acc-r', 'p-pinned', 100, 'g', 'working', 'manual');
        INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, account_id)
          VALUES ('led-1', 'p-pinned', 100, 100, 'PURCHASE_RECEIPT', 'acc-r');
      `);
      const counted = () => Object.fromEntries(uniqueTables.map(table => [
        table, (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as any).n,
      ]));
      const before = counted();
      expect(before.article_products, 'the cascade fixture is empty, so this proves nothing').toBe(1);
      expect(before.sales_grants).toBe(1);
      expect(before.inventory_receipt_lines).toBe(1);

      apply(db);

      expect(counted(), 'a child table lost rows; the migration is dropping a parent again').toEqual(before);
      expect(db.prepare('PRAGMA foreign_key_check').all(), 'the migration left a dangling reference').toEqual([]);
    } finally { db.close(); }
  });
});

describe('the migration file itself', () => {
  it('claims 0018 exactly once, so a later migration cannot collide with this number', () => {
    // This used to also assert 0018 was the highest-numbered file in the
    // ledger, which was only ever true the day it was written; migrations
    // 0019-0021 (creator profiles) landed after it on purpose. The number
    // is a collision guard, not a claim that nothing else ships later.
    const files = migrationFiles();
    expect(files.filter(f => f.startsWith('0018'))).toEqual(['0018_the_table_stops_saying_free.sql']);
  });

  it('never drops a table, because dropping products is the destructive version', () => {
    /* Comments stripped: the header explains at length what dropping the table
       would do, and a guard that reads its own explanation can only be
       satisfied by deleting the reason it exists. */
    const body = migration.replace(/--[^\n]*/g, '');
    expect(body, 'a DROP TABLE here cascade-deletes article_products and sales_grants on D1')
      .not.toMatch(/DROP\s+TABLE/i);
    expect(body, 'D1 ignores PRAGMA foreign_keys = OFF, so a migration relying on it is not doing what it says')
      .not.toMatch(/PRAGMA\s+foreign_keys/i);
  });

  it('names each of the six columns it rewrites, so a half-done migration is visible', () => {
    const body = migration.replace(/--[^\n]*/g, '');
    for (const table of ['products', 'product_listings']) {
      for (const column of THE_THREE) {
        expect(body, `${table}.${column} is not rewritten`).toContain(
          `ALTER TABLE ${table} RENAME COLUMN ${column}_0018 TO ${column}`,
        );
      }
    }
  });

  it('leaves the three columns at the end of the table, which nothing reads by position', () => {
    const db = seeded();
    try {
      apply(db);
      for (const table of ['products', 'product_listings'] as const) {
        const names = tableInfo(db, table).map(c => c.name);
        expect(names.slice(-3)).toEqual([...THE_THREE]);
      }
    } finally { db.close(); }
  });
});

describe('worker/schema.sql now says what the database does', () => {
  const schema = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');

  it('describes the three columns with no default, on both tables', () => {
    const scan = (table: string) => {
      const start = schema.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`) >= 0
        ? schema.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`)
        : schema.indexOf(`CREATE TABLE ${table} (`);
      expect(start, `${table} is not in schema.sql`).toBeGreaterThan(-1);
      return schema.slice(start, schema.indexOf('\n);', start));
    };
    for (const table of ['products', 'product_listings']) {
      const body = scan(table);
      for (const column of THE_THREE) {
        const line = body.split('\n').find(l => new RegExp(`^\\s*${column}\\s`).test(l));
        expect(line, `${table}.${column} is missing from schema.sql`).toBeTruthy();
        expect(line, `${table}.${column} still carries a default in schema.sql; `
          + 'the file is describing a database that no longer exists').not.toMatch(/DEFAULT\s+[0-9]/i);
      }
    }
  });
});
