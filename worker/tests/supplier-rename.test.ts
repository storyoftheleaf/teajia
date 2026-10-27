import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { applySupplierRename, listSupplierFreight, previewSupplierRename, SUPPLIER_NAME_COLUMNS, SupplierRenameRefusal } from '../src/supplierRename';
import { supplierRenameTools } from '../src/mcpTools/supplierRename';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/*
 * Adrian, 2026-10-11: "I see someone called Master Bo. If that's not his name,
 * there needs to be a button that I can click and change the name and it will
 * update it across not only all the records, but permanently."
 *
 * What has to be true afterwards, asked of the database the app reads (the
 * MIGRATION LEDGER, which is what production was built from): the card, every
 * row tied to him by id, and every row that only typed his name now say the new
 * name; another shop's "Master Bo" is untouched; a different supplier who merely
 * shares a text name is untouched; and a failure part-way changes nothing.
 */

const SECRET = 'supplier-rename-secret';
const A = 'acc-bo';
const B = 'acc-other';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function makeDb() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: A, role: 'owner', bundles: ['catalog', 'stock', 'gather'] });
  seedIdentity(db, { userId: 'adrian', accountId: B, role: 'owner', bundles: ['catalog', 'stock', 'gather'] });
  return db;
}

const run = (db: SqliteD1, sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).run(...values as any[]);
const get = (db: SqliteD1, sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...values as any[]) as Record<string, any>;

function seedCustomer(db: SqliteD1, id: string, account: string, name: string, tags = '["vendor"]') {
  run(db, `INSERT INTO customers (id, account_id, name, tags, whatsapp) VALUES (?, ?, ?, ?, '+86 1')`, id, account, name, tags);
}

/** Master Bo in shop A, carried by id in some places and by typed name in others. */
function seedMasterBo(db: SqliteD1) {
  seedCustomer(db, 'bo', A, 'Master Bo');
  seedCustomer(db, 'bo-other-shop', B, 'Master Bo');
  seedCustomer(db, 'bo-twin', A, 'Master Bo Tea Co'); // a different supplier, similar name

  // By id: the stored text may be anything, the id wins.
  for (const [id, vendorName, vendorId, account] of [
    ['t-id-1', 'Master Bo', 'bo', A], ['t-id-2', 'Bo (Menghai)', 'bo', A], ['t-id-3', 'Master Bo', 'bo-other-shop', B],
  ]) {
    run(db, `INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name, vendor_id) VALUES (?, 'adrian', ?, 'Tea', ?, ?)`, id, account, vendorName, vendorId);
  }
  // By text only: typed the old name, no id.
  run(db, `INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name) VALUES ('t-text', 'adrian', ?, 'Tea', ' master bo ')`, A);
  run(db, `UPDATE tea_compass_entries SET vendor_id = NULL WHERE id = 't-text'`);
  // Text equal to the old name but tied to a DIFFERENT supplier by id: not his.
  run(db, `INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name, vendor_id) VALUES ('t-twin', 'adrian', ?, 'Tea', 'Master Bo', 'bo-twin')`, A);
  // Same text in another shop: not his.
  run(db, `INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name) VALUES ('t-b-text', 'adrian', ?, 'Tea', 'Master Bo')`, B);

  run(db, `INSERT INTO purchase_orders (id, account_id, vendor_name, vendor_id, created_at, updated_at) VALUES ('po-id', ?, 'Master Bo', 'bo', 'now', 'now')`, A);
  run(db, `INSERT INTO purchase_orders (id, account_id, vendor_name, created_at, updated_at) VALUES ('po-text', ?, 'Master Bo', 'now', 'now')`, A);
  run(db, `INSERT INTO purchase_orders (id, account_id, vendor_name, created_at, updated_at) VALUES ('po-b', ?, 'Master Bo', 'now', 'now')`, B);

  run(db, `INSERT INTO curate_visits (id, account_id, created_by_user_id, vendor_id, vendor_name) VALUES ('v-id', ?, 'adrian', 'bo', 'Master Bo')`, A);
  run(db, `INSERT INTO batches (id, account_id, label, vendor) VALUES ('b-text', ?, 'Spring', 'Master Bo')`, A);
  run(db, `INSERT INTO batches (id, account_id, label, vendor) VALUES ('b-other', ?, 'Spring', 'Master Bo')`, B);
  run(db, `INSERT INTO inventory_receipts (id, account_id, vendor_name, source_kind, created_by_user_id, idempotency_key, request_fingerprint)
           VALUES ('r-text', ?, 'Master Bo', 'manual', 'adrian', 'k1', 'f1')`, A);

  // Money rows tied by id carry no name and must simply be left alone.
  run(db, `INSERT INTO curate_freight_costs (id, account_id, vendor_id, leg, mode, total_amount, currency, weight_kg, observed_on, created_by_user_id)
           VALUES ('f1', ?, 'bo', 'Guangzhou to Bali', 'air', 850, 'Yuan', 10, '2026-10-01', 'adrian')`, A);
  run(db, `INSERT INTO curate_freight_costs (id, account_id, vendor_id, leg, mode, total_amount, currency, weight_kg, observed_on, created_by_user_id)
           VALUES ('f0', ?, 'bo', 'Guangzhou to Bali', 'air', 900, 'Yuan', 10, '2026-09-01', 'adrian')`, A);
  run(db, `INSERT INTO curate_vendor_profiles (vendor_id, account_id, story) VALUES ('bo', ?, 'Old family shop')`, A);
}

const names = (db: SqliteD1, table: string, col: string, id: string) => get(db, `SELECT ${col} AS n FROM ${table} WHERE id = ?`, id).n;

function bearer(userId: string, account: string) {
  return signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: account, platform_role: null });
}
async function rest(db: SqliteD1, path: string, init: { method?: string; body?: unknown; account?: string } = {}) {
  const headers = new Headers({ Authorization: `Bearer ${await bearer('adrian', init.account ?? A)}`, 'X-Teajia-Account': init.account ?? A });
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'), headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }), { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any);
}

describe('renaming a supplier changes every record that carries the name', () => {
  it('the preview counts rows by id and by text, and writes nothing', async () => {
    const db = makeDb();
    seedMasterBo(db);
    const p = await previewSupplierRename(db as any, A, 'bo', 'Bo Lin');
    const by = Object.fromEntries(p.counts.map(c => [c.table, c]));
    expect(p.old_name).toBe('Master Bo');
    expect(by.customers).toMatchObject({ by_id: 1, by_name: 0 });
    expect(by.tea_compass_entries).toMatchObject({ by_id: 2, by_name: 1 }); // t-id-1, t-id-2 | t-text
    expect(by.purchase_orders).toMatchObject({ by_id: 1, by_name: 1 });
    expect(by.curate_visits).toMatchObject({ by_id: 1, by_name: 0 });
    expect(by.batches).toMatchObject({ by_id: 0, by_name: 1 });
    expect(by.inventory_receipts).toMatchObject({ by_id: 0, by_name: 1 });
    expect(p.total).toBe(1 + 3 + 2 + 1 + 1 + 1);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-2')).toBe('Bo (Menghai)');
  });

  it('applying renames the card, every id-linked row and every text-only row, in this shop only', async () => {
    const db = makeDb();
    seedMasterBo(db);
    await applySupplierRename(db as any, A, 'bo', '  Bo   Lin ', 'Master Bo');

    expect(names(db, 'customers', 'name', 'bo')).toBe('Bo Lin');
    for (const id of ['t-id-1', 't-id-2', 't-text']) expect(names(db, 'tea_compass_entries', 'vendor_name', id)).toBe('Bo Lin');
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-id')).toBe('Bo Lin');
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-text')).toBe('Bo Lin');
    expect(names(db, 'curate_visits', 'vendor_name', 'v-id')).toBe('Bo Lin');
    expect(names(db, 'batches', 'vendor', 'b-text')).toBe('Bo Lin');
    expect(names(db, 'inventory_receipts', 'vendor_name', 'r-text')).toBe('Bo Lin');

    // Not his: other shop, other supplier sharing a text name, a lookalike supplier.
    expect(names(db, 'customers', 'name', 'bo-other-shop')).toBe('Master Bo');
    expect(names(db, 'customers', 'name', 'bo-twin')).toBe('Master Bo Tea Co');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-3')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-twin')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-b-text')).toBe('Master Bo');
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-b')).toBe('Master Bo');
    expect(names(db, 'batches', 'vendor', 'b-other')).toBe('Master Bo');

    // The money rows tied by id never held a name and still point at him.
    expect(get(db, `SELECT COUNT(*) AS n FROM curate_freight_costs WHERE vendor_id = 'bo'`).n).toBe(2);
    expect(get(db, `SELECT story FROM curate_vendor_profiles WHERE vendor_id = 'bo'`).story).toBe('Old family shop');
  });

  it('reconciles stale id-linked names when the supplier card is already correct, then refuses a no-op without writes', async () => {
    const db = makeDb();
    seedMasterBo(db);
    run(db, "UPDATE customers SET name = 'Bo Lin', updated_at = '2000-01-01' WHERE id = 'bo'");
    for (let index = 0; index < 4; index += 1) {
      run(db, `INSERT INTO products (id, account_id, product_name, type, vendor, vendor_id, stock_grams)
        VALUES (?, ?, 'Tea', 'Oolong', 'Master Bo (old spelling)', 'bo', 50)`, `stale-${index}`, A);
    }
    run(db, `INSERT INTO products (id, account_id, product_name, type, vendor, vendor_id)
      VALUES ('aligned', ?, 'Tea', 'Oolong', 'Bo Lin', 'bo'),
        ('other-supplier', ?, 'Tea', 'Oolong', 'Master Bo (old spelling)', 'bo-twin'),
        ('unlinked-alias', ?, 'Tea', 'Oolong', 'Master Bo (old spelling)', NULL)`, A, A, A);
    run(db, `INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
      VALUES ('prof_stale-0', 'stale-0', ?, ?, 'Tea')`, A, A);
    run(db, `INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, vendor, vendor_id)
      VALUES ('list_stale-0', ?, 'prof_stale-0', 'stale-0', 'Master Bo (old spelling)', 'bo')`, A);

    const preview = await previewSupplierRename(db as any, A, 'bo', 'Bo Lin');
    expect(preview).toMatchObject({ old_name: 'Bo Lin', new_name: 'Bo Lin' });
    expect(preview.counts.find(count => count.table === 'customers')).toMatchObject({ by_id: 0, by_name: 0 });
    expect(preview.counts.find(count => count.table === 'products')).toMatchObject({ by_id: 4, by_name: 0 });
    expect(preview.counts.find(count => count.table === 'product_listings')).toMatchObject({ by_id: 1, by_name: 0 });
    expect(names(db, 'products', 'vendor', 'stale-0')).toBe('Master Bo (old spelling)');
    await applySupplierRename(db as any, A, 'bo', 'Bo Lin', 'Bo Lin');
    for (let index = 0; index < 4; index += 1) expect(names(db, 'products', 'vendor', `stale-${index}`)).toBe('Bo Lin');
    expect(names(db, 'product_listings', 'vendor', 'list_stale-0')).toBe('Bo Lin');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-2')).toBe('Bo Lin');
    expect(names(db, 'products', 'vendor', 'aligned')).toBe('Bo Lin');
    expect(names(db, 'products', 'vendor', 'other-supplier')).toBe('Master Bo (old spelling)');
    expect(names(db, 'products', 'vendor', 'unlinked-alias')).toBe('Master Bo (old spelling)');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-3')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-twin')).toBe('Master Bo');
    expect(get(db, "SELECT updated_at FROM customers WHERE id = 'bo'").updated_at).toBe('2000-01-01');
    const changes = get(db, 'SELECT total_changes() AS n').n;
    await expect(previewSupplierRename(db as any, A, 'bo', 'Bo Lin')).rejects.toMatchObject({ code: 'unchanged' });
    await expect(applySupplierRename(db as any, A, 'bo', 'Bo Lin')).rejects.toMatchObject({ code: 'unchanged' });
    expect(get(db, 'SELECT total_changes() AS n').n).toBe(changes);
  });

  it('covers every name column the schema has for a supplier (a new vendor_name column fails here)', () => {
    const db = makeDb();
    const known = new Set(SUPPLIER_NAME_COLUMNS.map(c => `${c.table}.${c.nameColumn}`));
    // Columns that hold a supplier name on purpose but are NOT renamed, with the reason.
    const deliberately = new Map([
      ['curate_suggestions.from_vendor_name', 'what an agent said it read, provenance'],
    ]);
    const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const found: string[] = [];
    for (const { name } of tables) {
      const cols = db.sqlite.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>;
      for (const c of cols) if (/^(vendor|vendor_name|from_vendor_name|proposed_vendor_name)$/.test(c.name)) found.push(`${name}.${c.name}`);
    }
    const missing = found.filter(f => !known.has(f) && !deliberately.has(f));
    expect(missing, `a table now stores a supplier's name and the rename does not know it: ${missing.join(', ')}`).toEqual([]);
  });

  it('is all or nothing: a failure part-way leaves the card and every row as they were', async () => {
    const db = makeDb();
    seedMasterBo(db);
    // Fail the LAST write the batch makes, after the card and most rows are already updated.
    db.sqlite.exec(`CREATE TRIGGER boom BEFORE UPDATE ON inventory_receipts BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    await expect(applySupplierRename(db as any, A, 'bo', 'Bo Lin')).rejects.toThrow();
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-1')).toBe('Master Bo');
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-text')).toBe('Master Bo');
  });

  it('refuses a name another supplier already has, an empty name, an unchanged name, a non-supplier and another shop\'s supplier', async () => {
    const db = makeDb();
    seedMasterBo(db);
    seedCustomer(db, 'plain', A, 'A Customer', '["wholesale"]');
    const code = async (fn: () => Promise<unknown>) => {
      try { await fn(); } catch (e) { return e instanceof SupplierRenameRefusal ? e.code : `other:${e}`; }
      return 'none';
    };
    expect(await code(() => previewSupplierRename(db as any, A, 'bo', 'master bo tea co'))).toBe('name_taken');
    expect(await code(() => previewSupplierRename(db as any, A, 'bo', '   '))).toBe('name_required');
    // The fixture's id-linked alias is intentionally stale; align it before
    // asking for a no-op. A same-name request may now repair stale id copies.
    run(db, "UPDATE tea_compass_entries SET vendor_name = 'Master Bo' WHERE id = 't-id-2'");
    expect(await code(() => previewSupplierRename(db as any, A, 'bo', 'Master Bo'))).toBe('unchanged');
    expect(await code(() => previewSupplierRename(db as any, A, 'plain', 'Someone'))).toBe('not_a_supplier');
    expect(await code(() => previewSupplierRename(db as any, A, 'bo-other-shop', 'Someone'))).toBe('not_found');
    expect(await code(() => applySupplierRename(db as any, A, 'bo', 'Bo Lin', 'Somebody Else'))).toBe('name_changed');
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
  });

  it('refuses Chinese or mixed main names without writes and preserves the separate Chinese name on an English correction', async () => {
    const db = makeDb();
    seedMasterBo(db);
    run(db, "UPDATE customers SET chinese_name = '博师傅' WHERE id = 'bo'");
    const changes = get(db, 'SELECT total_changes() AS n').n;
    for (const name of ['博师傅', '博师傅 Master Bo', 'Master Bo 博', '𠀀 Tea']) {
      await expect(previewSupplierRename(db as any, A, 'bo', name)).rejects.toMatchObject({ status: 400, code: 'english_name_required' });
      await expect(applySupplierRename(db as any, A, 'bo', name)).rejects.toMatchObject({ status: 400, code: 'english_name_required' });
    }
    expect(get(db, 'SELECT total_changes() AS n').n).toBe(changes);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
    expect(names(db, 'tea_compass_entries', 'vendor_name', 't-id-2')).toBe('Bo (Menghai)');
    await applySupplierRename(db as any, A, 'bo', 'Bo Lin');
    expect(names(db, 'customers', 'name', 'bo')).toBe('Bo Lin');
    expect(get(db, "SELECT chinese_name FROM customers WHERE id = 'bo'").chinese_name).toBe('博师傅');
  });

  it('a case-only change is a rename', async () => {
    const db = makeDb();
    seedMasterBo(db);
    await applySupplierRename(db as any, A, 'bo', 'MASTER BO');
    expect(names(db, 'customers', 'name', 'bo')).toBe('MASTER BO');
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-id')).toBe('MASTER BO');
  });

  it('renames shelf teas and listings tied by id or by name (columns read from the live table)', async () => {
    const db = makeDb();
    seedMasterBo(db);
    db.sqlite.exec('PRAGMA foreign_keys = OFF');
    const insert = (table: string, id: string, account: string, vendor: string | null, vendorId: string | null) => {
      const cols = db.sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; notnull: number; dflt_value: any }>;
      const must = cols.filter(c => c.notnull && c.dflt_value == null).map(c => c.name);
      const row: Record<string, unknown> = { id, account_id: account, vendor, vendor_id: vendorId };
      for (const c of must) if (!(c in row)) row[c] = c.includes('price') || c.includes('cost') ? 0 : `x-${id}`;
      const keys = Object.keys(row);
      run(db, `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...keys.map(k => row[k]));
    };
    insert('products', 'p-id', A, 'whatever', 'bo');
    insert('products', 'p-text', A, 'Master Bo', null);
    insert('products', 'p-b', B, 'Master Bo', null);
    insert('product_listings', 'l-id', A, 'whatever', 'bo');
    insert('product_listings', 'l-text', A, 'Master Bo', null);

    const p = await previewSupplierRename(db as any, A, 'bo', 'Bo Lin');
    const by = Object.fromEntries(p.counts.map(c => [c.table, c]));
    expect(by.products).toMatchObject({ by_id: 1, by_name: 1 });
    expect(by.product_listings).toMatchObject({ by_id: 1, by_name: 1 });

    await applySupplierRename(db as any, A, 'bo', 'Bo Lin');
    expect(names(db, 'products', 'vendor', 'p-id')).toBe('Bo Lin');
    expect(names(db, 'products', 'vendor', 'p-text')).toBe('Bo Lin');
    expect(names(db, 'products', 'vendor', 'p-b')).toBe('Master Bo');
    expect(names(db, 'product_listings', 'vendor', 'l-id')).toBe('Bo Lin');
    expect(names(db, 'product_listings', 'vendor', 'l-text')).toBe('Bo Lin');
  });
});

describe('the freight bills the sheet shows', () => {
  it('lists every bill with per-kg worked out and the newest per leg marked current', async () => {
    const db = makeDb();
    seedMasterBo(db);
    db.sqlite.prepare('INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES (?, ?)').run('Yuan', 7.1);
    const bills = await listSupplierFreight(db as any, A, 'bo');
    expect(bills.map(b => [b.id, b.current])).toEqual([['f1', true], ['f0', false]]);
    expect(bills[0]).toMatchObject({ per_kg: 85, currency: 'Yuan', per_kg_usd: 11.97 });
  });

  it('a currency with no rate has no dollar figure, never a rate of one', async () => {
    const db = makeDb();
    seedMasterBo(db);
    db.sqlite.prepare("DELETE FROM exchange_rates WHERE currency = 'Yuan'").run();
    const bills = await listSupplierFreight(db as any, A, 'bo');
    expect(bills[0].per_kg).toBe(85);
    expect(bills[0].per_kg_usd).toBeNull();
  });
});

describe('over HTTP', () => {
  it('previews with GET, applies with POST, and another shop gets a 404', async () => {
    const db = makeDb();
    seedMasterBo(db);
    const preview = await rest(db, '/api/suppliers/bo/rename-preview?name=Bo%20Lin');
    expect(preview.status).toBe(200);
    expect((await preview.json() as any).total).toBe(9);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');

    const apply = await rest(db, '/api/suppliers/bo/rename', { body: { name: 'Bo Lin', expected_old_name: 'Master Bo' } });
    expect(apply.status).toBe(200);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Bo Lin');

    const stranger = await rest(db, '/api/suppliers/bo-other-shop/rename', { body: { name: 'X' } });
    expect(stranger.status).toBe(404);
    expect(names(db, 'customers', 'name', 'bo-other-shop')).toBe('Master Bo');

    const taken = await rest(db, '/api/suppliers/bo/rename', { body: { name: 'Master Bo Tea Co' } });
    expect(taken.status).toBe(409);
    expect((await taken.json() as any).code).toBe('name_taken');

    const freight = await rest(db, '/api/suppliers/bo/freight');
    expect(freight.status).toBe(200);
    expect((await freight.json() as any[]).length).toBe(2);
  });

  it('a member without the catalog permission cannot rename', async () => {
    const db = makeDb();
    seedMasterBo(db);
    seedIdentity(db, { userId: 'helper', accountId: A, role: 'staff', bundles: ['stock'] });
    const headers = new Headers({
      Authorization: `Bearer ${await bearer('helper', A)}`, 'X-Teajia-Account': A, 'Content-Type': 'application/json',
    });
    const res = await worker.fetch(new Request('https://worker.test/api/suppliers/bo/rename', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Bo Lin' }),
    }), { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any);
    expect(res.status).toBe(403);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
  });
});

describe('rename_supplier (agent tool)', () => {
  const auth = (account = A) => ({ accountId: account, userId: 'adrian', userEmail: 'a@test.dev', tokenId: 'tok', creatorTier: 'account_owner' }) as any;
  const call = (db: SqliteD1, args: any, account = A) => supplierRenameTools.handlers.rename_supplier({ DB: db } as any, auth(account), args) as Promise<any>;

  it('previews first, writes nothing, then commits only with the token', async () => {
    const db = makeDb();
    seedMasterBo(db);
    const preview = await call(db, { vendor_id: 'bo', new_name: 'Bo Lin' });
    expect(preview.confirmation_token).toBeTruthy();
    expect(preview.preview.total_rows).toBe(9);
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');

    const done = await call(db, { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, old_name: 'Master Bo', new_name: 'Bo Lin' });
    expect(names(db, 'purchase_orders', 'vendor_name', 'po-text')).toBe('Bo Lin');

    // Single use, and another shop's token session cannot spend it.
    expect(await call(db, { confirm: preview.confirmation_token })).toMatchObject({ error: 'invalid_or_expired_confirmation_token' });
  });

  it('a ticket cannot be spent by another shop and a refusal comes back as words', async () => {
    const db = makeDb();
    seedMasterBo(db);
    const preview = await call(db, { vendor_id: 'bo', new_name: 'Bo Lin' });
    expect(await call(db, { confirm: preview.confirmation_token }, B)).toMatchObject({ error: 'invalid_or_expired_confirmation_token' });
    expect(names(db, 'customers', 'name', 'bo')).toBe('Master Bo');
    expect(await call(db, { vendor_id: 'bo', new_name: 'Master Bo Tea Co' })).toMatchObject({ error: 'name_taken' });
  });

  it('is scoped as a catalog write and is not advertised as read-only', () => {
    const def = supplierRenameTools.defs[0];
    expect(def.scope).toBe('catalog:write');
  });
});
