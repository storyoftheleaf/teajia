import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { MIGRATIONS_DIR, seedFromMigrations, splitStatements, tableInfo } from './helpers/migratedSqlite';

const SECRET = 'intake-commit-recovery-secret';
const opened: SqliteD1[] = [];
afterEach(() => { while (opened.length) opened.pop()!.close(); });

function setup(source: 'schema' | 'migrations') {
  const db = new SqliteD1(source);
  opened.push(db);
  seedIdentity(db, { accountId: 'shop-a', userId: 'owner-a', bundles: ['catalog', 'stock'] });
  seedIdentity(db, { accountId: 'shop-b', userId: 'owner-b', bundles: ['catalog', 'stock'] });
  db.sqlite.prepare('INSERT INTO curate_import_batches (id, account_id, created_by_user_id, title) VALUES (?, ?, ?, ?)')
    .run('import-a', 'shop-a', 'owner-a', 'Intake A');
  db.sqlite.prepare('INSERT INTO curate_import_batches (id, account_id, created_by_user_id, title) VALUES (?, ?, ?, ?)')
    .run('import-b', 'shop-b', 'owner-b', 'Intake B');
  return db;
}

async function call(db: SqliteD1, accountId: string, method: string, path: string, body?: unknown) {
  const userId = accountId === 'shop-a' ? 'owner-a' : 'owner-b';
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: accountId,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db as never, JWT_SECRET: SECRET } as never);
}

const intake = {
  batch_id: null,
  products: [{ product_name: 'Red tea', cost_amount: 20, cost_currency: 'USD' }],
  purchase_records: [{ vendor_name: 'Vendor', items_json: '[]', total_usd: 20 }],
};

it('adds recovery columns when nullable totals were migrated first in production', () => {
  const { db } = seedFromMigrations({ through: '0037' });
  try {
    for (const file of ['0040_purchase_order_total_can_be_unknown.sql', '0039_intake_commit_recovery.sql']) {
      for (const statement of splitStatements(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) db.exec(statement);
    }
    const names = tableInfo(db, 'purchase_orders').map(column => column.name);
    expect(names).toContain('create_request_key');
    expect(names).toContain('create_request_fingerprint');
    expect(tableInfo(db, 'purchase_orders').find(column => column.name === 'total_usd')).toMatchObject({ notnull: 0, dflt_value: null });
    db.prepare("INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, created_at, updated_at, create_request_key) VALUES ('unknown', 'shop-a', 'Vendor', '[]', 'now', 'now', 'intake:one')").run();
    expect(db.prepare("SELECT total_usd FROM purchase_orders WHERE id = 'unknown'").get()).toEqual({ total_usd: null });
    expect(() => db.prepare("INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, created_at, updated_at, create_request_key) VALUES ('duplicate', 'shop-a', 'Vendor', '[]', 'now', 'now', 'intake:one')").run()).toThrow(/UNIQUE/);
  } finally { db.close(); }
});

describe.each(['schema', 'migrations'] as const)('intake recovery on %s D1', source => {
  it('persists an immutable account-scoped plan and can resume it after reload', async () => {
    const db = setup(source);
    const initial = await call(db, 'shop-a', 'PUT', '/api/intake-commits/import-a', intake);
    expect(initial.status).toBe(200);
    expect(await initial.json()).toMatchObject({ id: 'import-a', status: 'pending', ...intake });
    const resumed = await call(db, 'shop-a', 'GET', '/api/intake-commits/import-a');
    expect(await resumed.json()).toMatchObject({ id: 'import-a', status: 'pending', ...intake });
    const replay = await call(db, 'shop-a', 'PUT', '/api/intake-commits/import-a', intake);
    expect(replay.status).toBe(200);
    const changed = await call(db, 'shop-a', 'PUT', '/api/intake-commits/import-a', {
      ...intake, products: [{ ...intake.products[0], cost_amount: 30 }],
    });
    expect(changed.status).toBe(409);
    expect((await call(db, 'shop-b', 'GET', '/api/intake-commits/import-a')).status).toBe(404);
    expect((await call(db, 'shop-b', 'POST', '/api/intake-commits/import-a/complete')).status).toBe(404);
    expect((await call(db, 'shop-a', 'POST', '/api/intake-commits/import-a/complete')).status).toBe(200);
    const completed = await call(db, 'shop-a', 'GET', '/api/intake-commits/import-a');
    expect(await completed.json()).toMatchObject({ status: 'completed', ...intake });
  });

  it('replays a lost purchase-order response without duplicating, and rejects key reuse for changed details', async () => {
    const db = setup(source);
    const order = { idempotency_key: 'intake:import-a:po:0', vendor_name: 'Vendor', items_json: '[]', total_usd: 20 };
    const first = await call(db, 'shop-a', 'POST', '/api/purchase-orders', order);
    expect(first.status).toBe(201);
    const created = await first.json() as { id: string };
    const replay = await call(db, 'shop-a', 'POST', '/api/purchase-orders', order);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ id: created.id, idempotent: true });
    expect((await call(db, 'shop-a', 'POST', '/api/purchase-orders', { ...order, total_usd: 25 })).status).toBe(409);
    const other = await call(db, 'shop-b', 'POST', '/api/purchase-orders', order);
    expect(other.status).toBe(201);
    expect((await other.json() as { id: string }).id).not.toBe(created.id);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM purchase_orders WHERE account_id = ?').get('shop-a')).toEqual({ n: 1 });
  });

  it('keeps an unknown purchase total distinct from an explicitly free order on replay', async () => {
    const db = setup(source);
    const unknown = { idempotency_key: 'intake:import-a:po:unknown', vendor_name: 'Vendor', items_json: '[]' };
    const first = await call(db, 'shop-a', 'POST', '/api/purchase-orders', unknown);
    expect(first.status).toBe(201);
    const { id } = await first.json() as { id: string };
    expect(db.sqlite.prepare('SELECT total_usd FROM purchase_orders WHERE id = ?').get(id)).toEqual({ total_usd: null });
    expect((await call(db, 'shop-a', 'POST', '/api/purchase-orders', unknown)).status).toBe(200);
    expect((await call(db, 'shop-a', 'POST', '/api/purchase-orders', { ...unknown, total_usd: 0 })).status).toBe(409);
  });
});
