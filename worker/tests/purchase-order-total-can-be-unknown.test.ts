import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { schemaObjects, seedFromMigrations, splitStatements, tableInfo } from './helpers/migratedSqlite';

/**
 * A purchase order whose dollar total nobody could work out is stored as
 * unknown (NULL), never as $0.
 *
 * Curate leaves `total_usd` out when there is no honest dollar figure: a
 * currency the shop has no rate for, or a tea on the order with no price yet.
 * The column was `NOT NULL DEFAULT 0` (migration 0000), so those orders landed
 * as 0, which reads as an order that cost nothing. Migration 0040 lets it hold
 * NULL without changing any stored value, and the worker writes NULL for an
 * absent total.
 *
 * Seeded from the MIGRATION LEDGER, not schema.sql: schema.sql is a hand-kept
 * description of the database, and a test seeded from it asks what the file
 * says rather than what the live table does.
 */

const migration = readFileSync(
  fileURLToPath(new URL('../migrations/0040_purchase_order_total_can_be_unknown.sql', import.meta.url)), 'utf8',
);

/** Row shapes the migration must carry across untouched, each a different answer. */
const SHAPES = [
  { id: 'po-dollars', total_usd: 63.38, display_currency: 'Yuan', note: 'a yuan order converted at the shop rate' },
  { id: 'po-zero', total_usd: 0, display_currency: 'USD', note: 'a 0, from the old default or a free order: kept as 0' },
  { id: 'po-usd', total_usd: 120, display_currency: 'USD', note: 'an order placed in dollars' },
];

function seedShapes(db: ReturnType<typeof seedFromMigrations>['db']) {
  const now = '2026-10-09T00:00:00.000Z';
  for (const shape of SHAPES) {
    db.prepare(`INSERT INTO purchase_orders (id, account_id, vendor_name, vendor_id, items_json, total_usd, display_currency, status, created_at, updated_at)
      VALUES (?, 'account-a', 'Wang Laoshi', 'vendor-wang', '[]', ?, ?, 'confirmed', ?, ?)`)
      .run(shape.id, shape.total_usd, shape.display_currency, now, now);
  }
}

const rows = (db: ReturnType<typeof seedFromMigrations>['db']) => db.prepare(
  'SELECT id, account_id, vendor_name, vendor_id, vendor_contact, items_json, total_usd, display_currency, status, message_text, notes, freight_estimate_json, created_at, updated_at FROM purchase_orders ORDER BY id',
).all();

const column = (db: ReturnType<typeof seedFromMigrations>['db']) => tableInfo(db, 'purchase_orders').find((c) => c.name === 'total_usd')!;

describe('migration 0040, rehearsed against the ledger it runs on', () => {
  it('the premise: before 0040 the column refuses an unknown total', () => {
    const { db } = seedFromMigrations({ through: '0039' });
    expect(column(db)).toMatchObject({ notnull: 1, dflt_value: '0' });
    expect(() => db.prepare(`INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, total_usd, created_at, updated_at)
      VALUES ('po-x', 'account-a', 'V', '[]', NULL, 'now', 'now')`).run()).toThrow(/NOT NULL/);
  });

  it('changes no stored value, keeps every index, and then accepts NULL with no default', () => {
    const { db } = seedFromMigrations({ through: '0039' });
    seedShapes(db);
    const before = rows(db);
    const objectsBefore = schemaObjects(db, 'purchase_orders');
    for (const statement of splitStatements(migration)) db.exec(statement);

    expect(rows(db)).toEqual(before);
    expect(schemaObjects(db, 'purchase_orders')).toEqual(objectsBefore);
    expect(column(db)).toMatchObject({ type: 'REAL', notnull: 0, dflt_value: null });
    expect(tableInfo(db, 'purchase_orders').some((c) => c.name === 'total_usd_0040')).toBe(false);

    db.prepare(`INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, created_at, updated_at)
      VALUES ('po-unknown', 'account-a', 'V', '[]', 'now', 'now')`).run();
    expect(db.prepare(`SELECT total_usd FROM purchase_orders WHERE id = 'po-unknown'`).get()).toEqual({ total_usd: null });
  });
});

const SECRET = 'po-total-secret';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function database() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  return db;
}

async function createOrder(db: SqliteD1, extra: Record<string, unknown>) {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER, active_account_id: ACCOUNT, platform_role: null,
  });
  const response = await worker.fetch(new Request('https://worker.test/api/purchase-orders', {
    method: 'POST',
    headers: new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ vendor_name: 'Wang Laoshi', items_json: '[]', display_currency: 'Yuan', status: 'confirmed', ...extra }),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
  expect(response.status).toBe(201);
  const { id } = await response.json() as { id: string };
  return (db.sqlite.prepare('SELECT total_usd FROM purchase_orders WHERE id = ?').get(id) as { total_usd: number | null }).total_usd;
}

describe('creating a purchase order', () => {
  it('stores an absent total as unknown, not as $0', async () => {
    expect(await createOrder(database(), {})).toBeNull();
  });

  it('stores a total that is not a number as unknown', async () => {
    expect(await createOrder(database(), { total_usd: 'about 60' })).toBeNull();
  });

  it('keeps a stated total, and a stated 0, as given', async () => {
    expect(await createOrder(database(), { total_usd: 63.38 })).toBe(63.38);
    expect(await createOrder(database(), { total_usd: 0 })).toBe(0);
  });
});
