import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
const secret = 'customer-supplier-name-update';
afterEach(() => { databases.splice(0).forEach(db => db.close()); });

function fixture() {
  const db = new SqliteD1(); databases.push(db);
  seedIdentity(db, { accountId: 'shop', userId: 'owner' });
  seedIdentity(db, { accountId: 'other-shop', userId: 'owner' });
  seedIdentity(db, { accountId: 'shop', userId: 'seller', role: 'staff', bundles: ['sell'] });
  seedIdentity(db, { accountId: 'shop', userId: 'curator', role: 'staff', bundles: ['catalog'] });
  db.exec(`INSERT INTO customers (id, account_id, name, tags, type, notes) VALUES
    ('supplier', 'shop', 'Huang Wie', '["vendor"]', 'supplier', 'Original contact'),
    ('rival', 'shop', 'Other Supplier', '["vendor"]', 'supplier', 'Rival contact'),
    ('buyer', 'shop', 'Old Buyer', '[]', 'customer', 'Buyer contact'),
    ('foreign', 'other-shop', 'Huang Wie', '["vendor"]', 'supplier', 'Foreign contact');
    INSERT INTO contact_relationships (id, account_id, customer_id, kind) VALUES
    ('supplier-buyer', 'shop', 'supplier', 'buyer'), ('supplier-vendor', 'shop', 'supplier', 'vendor');
    INSERT INTO products (id, account_id, product_name, type, vendor, vendor_id, stock_grams) VALUES
    ('tea-one', 'shop', 'First tea', 'Oolong', 'Huang Wie', 'supplier', 100),
    ('tea-two', 'shop', 'Second tea', 'Oolong', 'Misspelled alias', 'supplier', 50),
    ('tea-text', 'shop', 'Older tea', 'Oolong', ' huang wie ', NULL, 40),
    ('tea-other', 'other-shop', 'Other shop tea', 'Oolong', 'Huang Wie', 'foreign', 25),
    ('tea-rival', 'shop', 'Different supplier tea', 'Oolong', 'Huang Wie', 'rival', 20),
    ('tea-buyer', 'shop', 'Unrelated text', 'Oolong', 'Old Buyer', NULL, 10);
    INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
    VALUES ('prof_tea-one', 'first-tea', 'shop', 'shop', 'First tea');
    INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, vendor, vendor_id, stock_grams)
    VALUES ('list_tea-one', 'shop', 'prof_tea-one', 'tea-one', 'Huang Wie', 'supplier', 100);
    INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name, vendor_id)
    VALUES ('curate-linked', 'owner', 'shop', 'Sample', 'Huang Wie', 'supplier'),
      ('curate-text', 'owner', 'shop', 'Older sample', 'Huang Wie', NULL);
    INSERT INTO purchase_orders (id, account_id, vendor_name, vendor_id, created_at, updated_at)
    VALUES ('order', 'shop', 'Huang Wie', 'supplier', 'now', 'now');
    INSERT INTO batches (id, account_id, label, vendor) VALUES ('intake', 'shop', 'Intake', 'Huang Wie');
    INSERT INTO curate_visits (id, account_id, created_by_user_id, vendor_id, vendor_name)
    VALUES ('visit', 'shop', 'owner', 'supplier', 'Huang Wie');
    INSERT INTO inventory_receipts (id, account_id, vendor_name, source_kind, created_by_user_id, idempotency_key, request_fingerprint)
    VALUES ('receipt', 'shop', 'Huang Wie', 'manual', 'owner', 'receipt-key', 'receipt-fingerprint');`);
  const call = async (id: string, body: Record<string, unknown>, userId = 'owner', accountId = 'shop', method = 'PUT') => {
    const token = await signedToken(secret, { sub: userId, email: `${userId}@test.dev`, active_account_id: accountId });
    return worker.fetch(new Request(`https://worker.test/api/customers${id ? `/${id}` : ''}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), { DB: db, JWT_SECRET: secret } as any);
  };
  const read = (table: string, column: string, id: string) =>
    (db.sqlite.prepare(`SELECT ${column} AS value FROM ${table} WHERE id = ?`).get(id) as { value: unknown }).value;
  return { db, call, read };
}

describe('supplier corrections through the generic contact editor', () => {
  it('creates suppliers with a romanized main name and preserves their Chinese name separately', async () => {
    const { db, call, read } = fixture();
    for (const supplier of [
      { tags: ['vendor'] }, { type: 'supplier' }, { type: 'vendor' }, { relationship_kinds: ['vendor'] },
    ]) {
      const created = await call('', { ...supplier, name: '  Chu   Huan Tea ', chinese_name: '楚桓茶业' }, 'owner', 'shop', 'POST');
      expect(created.status, await created.clone().text()).toBe(201);
      const { id } = await created.json() as { id: string };
      expect(read('customers', 'name', id)).toBe('Chu Huan Tea');
      expect(read('customers', 'chinese_name', id)).toBe('楚桓茶业');
    }
    const ordinary = await call('', { name: '李女士', chinese_name: '李女士', type: 'customer', tags: ['friend'] }, 'owner', 'shop', 'POST');
    expect(ordinary.status).toBe(201);
    const { id } = await ordinary.json() as { id: string };
    expect(read('customers', 'name', id)).toBe('李女士');
    expect(read('customers', 'chinese_name', id)).toBe('李女士');
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM customers WHERE name = 'Chu Huan Tea'").get()).toMatchObject({ n: 4 });
  });

  it('refuses Han supplier creation through tags, type or relationship before any database write', async () => {
    const { db, call } = fixture();
    const before = (db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    for (const supplier of [
      { tags: ['vendor'] }, { tags: 'vendor' }, { type: 'supplier' }, { type: 'vendor' },
      { relationship_kinds: ['vendor'] }, { relationship_kinds: '["vendor"]' },
    ]) {
      for (const name of ['广易茶文化', '广易 Guang Yi Tea Culture']) {
        const refused = await call('', { ...supplier, name, chinese_name: '广易茶文化' }, 'owner', 'shop', 'POST');
        expect(refused.status).toBe(400);
        expect(await refused.json()).toMatchObject({ code: 'english_name_required' });
      }
    }
    expect((db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(before);
    const forbidden = await call('', { name: '广易茶文化', tags: ['vendor'] }, 'seller', 'shop', 'POST');
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: 'insufficient_bundle', details: { required_bundle: 'gather' } });
    expect((db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(before);
  });

  it('renames the contact, both teas, listings, Curate and operational records with the shared correction', async () => {
    const { db, call, read } = fixture();
    const response = await call('supplier', { name: '  Huang   Wei ', notes: 'Corrected contact', phone: '+86 123' });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wei');
    expect(read('customers', 'notes', 'supplier')).toBe('Corrected contact');
    expect(read('customers', 'phone', 'supplier')).toBe('+86 123');
    for (const id of ['tea-one', 'tea-two', 'tea-text']) expect(read('products', 'vendor', id)).toBe('Huang Wei');
    expect(read('product_listings', 'vendor', 'list_tea-one')).toBe('Huang Wei');
    for (const id of ['curate-linked', 'curate-text']) expect(read('tea_compass_entries', 'vendor_name', id)).toBe('Huang Wei');
    for (const [table, column, id] of [
      ['purchase_orders', 'vendor_name', 'order'], ['batches', 'vendor', 'intake'],
      ['curate_visits', 'vendor_name', 'visit'], ['inventory_receipts', 'vendor_name', 'receipt'],
    ]) expect(read(table, column, id)).toBe('Huang Wei');
    expect(read('products', 'vendor', 'tea-other')).toBe('Huang Wie');
    expect(read('products', 'vendor', 'tea-rival')).toBe('Huang Wie');
    expect(read('customers', 'name', 'foreign')).toBe('Huang Wie');
    expect(read('products', 'stock_grams', 'tea-one')).toBe(100);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toMatchObject({ count: 0 });
  });

  it('keeps Chinese in its own editable field and refuses Chinese main names before any contact or tea write', async () => {
    const { db, call, read } = fixture();
    expect((await call('supplier', { chinese_name: '黄维' })).status).toBe(200);
    expect(read('customers', 'chinese_name', 'supplier')).toBe('黄维');
    const changes = (db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    for (const name of ['黄维', '黄维 Huang Wei', 'Huang Wei 黄维']) {
      const refused = await call('supplier', { name, chinese_name: 'Must not overwrite', phone: 'must-not-save' });
      expect(refused.status).toBe(400);
      expect(await refused.json()).toMatchObject({ code: 'english_name_required' });
    }
    expect((db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(changes);
    expect(read('customers', 'chinese_name', 'supplier')).toBe('黄维');
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wie');
    expect(read('products', 'vendor', 'tea-one')).toBe('Huang Wie');
    expect((await call('supplier', { name: 'Huang Wei', chinese_name: '黄伟' })).status).toBe(200);
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wei');
    expect(read('customers', 'chinese_name', 'supplier')).toBe('黄伟');
    expect(read('products', 'vendor', 'tea-two')).toBe('Huang Wei');
    expect((await call('supplier', { notes: 'Contact-only edit' })).status).toBe(200);
    expect(read('customers', 'chinese_name', 'supplier')).toBe('黄伟');
  });

  it('validates an unchanged legacy Chinese primary name too, without changing its separate Chinese field', async () => {
    const { db, call, read } = fixture();
    db.exec("UPDATE customers SET name = '黄维', chinese_name = '黄维' WHERE id = 'supplier'");
    const refused = await call('supplier', { name: '黄维', phone: 'must-not-save' });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ code: 'english_name_required' });
    expect(read('customers', 'name', 'supplier')).toBe('黄维');
    expect(read('customers', 'chinese_name', 'supplier')).toBe('黄维');
    expect(read('customers', 'phone', 'supplier')).toBeNull();
  });

  it('requires catalog permission for a mixed buyer/supplier name, while preserving ordinary contact edits', async () => {
    const { call, read } = fixture();
    expect((await call('supplier', { notes: 'Sales contact' }, 'seller')).status).toBe(200);
    const denied = await call('supplier', { name: 'Huang Wei', tags: [], notes: 'Must not save' }, 'seller');
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'insufficient_bundle', details: { required_bundle: 'catalog' } });
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wie');
    expect(read('customers', 'notes', 'supplier')).toBe('Sales contact');
    expect((await call('supplier', { name: 'Huang Wei' }, 'curator')).status).toBe(200);
    expect(read('products', 'vendor', 'tea-two')).toBe('Huang Wei');
    expect((await call('foreign', { name: 'Not ours' })).status).toBe(404);
    expect(read('customers', 'name', 'foreign')).toBe('Huang Wie');
  });

  it('keeps a non-supplier name correction local to its contact card', async () => {
    const { call, read } = fixture();
    expect((await call('buyer', { name: 'New Buyer', notes: 'New buyer note' })).status).toBe(200);
    expect(read('customers', 'name', 'buyer')).toBe('New Buyer');
    expect(read('customers', 'notes', 'buyer')).toBe('New buyer note');
    expect(read('products', 'vendor', 'tea-buyer')).toBe('Old Buyer');
  });

  it('refuses duplicate names and stale names without changing other submitted contact fields', async () => {
    const { call, read } = fixture();
    const clash = await call('supplier', { name: 'Other Supplier', notes: 'Must not save' });
    expect(clash.status).toBe(409);
    expect(await clash.json()).toMatchObject({ code: 'name_taken' });
    const stale = await call('supplier', { name: 'Huang Wei', expected_old_name: 'Another old name', notes: 'Must not save' });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'name_changed' });
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wie');
    expect(read('customers', 'notes', 'supplier')).toBe('Original contact');
    expect(read('products', 'vendor', 'tea-two')).toBe('Misspelled alias');
  });

  it('rolls back every renamed record if the final contact-field update fails', async () => {
    const { db, call, read } = fixture();
    db.exec(`CREATE TRIGGER reject_contact_note BEFORE UPDATE OF notes ON customers
      WHEN NEW.notes = 'fail-contact' BEGIN SELECT RAISE(ABORT, 'Contact write failed'); END`);
    const response = await call('supplier', { name: 'Huang Wei', notes: 'fail-contact' });
    expect(response.status).toBe(500);
    expect(read('customers', 'name', 'supplier')).toBe('Huang Wie');
    expect(read('customers', 'notes', 'supplier')).toBe('Original contact');
    expect(read('products', 'vendor', 'tea-one')).toBe('Huang Wie');
    expect(read('products', 'vendor', 'tea-two')).toBe('Misspelled alias');
    expect(read('product_listings', 'vendor', 'list_tea-one')).toBe('Huang Wie');
    expect(read('tea_compass_entries', 'vendor_name', 'curate-linked')).toBe('Huang Wie');
    expect(read('inventory_receipts', 'vendor_name', 'receipt')).toBe('Huang Wie');
  });
});
