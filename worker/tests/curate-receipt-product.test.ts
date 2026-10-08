import { afterEach, describe, expect, it } from 'vitest';
import { compassVendorId } from '../src/curateReceiptProduct';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { accountId: 'shop', userId: 'owner' });
  seedIdentity(db, { accountId: 'other', userId: 'other-owner' });
  db.sqlite.exec(`INSERT INTO customers (id, account_id, name, tags) VALUES
    ('supplier', 'shop', 'Tea House', '["vendor"]'),
    ('customer', 'shop', 'Buyer', '[]'),
    ('foreign', 'other', 'Tea House', '["vendor"]')`);
  return db;
}

describe('Curate vendor identity at promotion and arrival', () => {
  it('uses the recorded ID even if its old display name differs', async () => {
    const db = database();
    expect(await compassVendorId(db as any, 'shop', { vendor_id: 'supplier', vendor_name: 'Old name' })).toBe('supplier');
  });

  it('rejects foreign IDs without falling back to a matching local name', async () => {
    const db = database();
    await expect(compassVendorId(db as any, 'shop', { vendor_id: 'foreign', vendor_name: 'Tea House' })).rejects.toThrow(/account/);
  });

  it('resolves only a unique existing vendor and leaves customers untagged', async () => {
    const db = database();
    expect(await compassVendorId(db as any, 'shop', { vendor_name: ' tea house ' })).toBe('supplier');
    expect(await compassVendorId(db as any, 'shop', { vendor_name: 'Buyer' })).toBeNull();
    expect(db.sqlite.prepare('SELECT tags FROM customers WHERE id = ?').get('customer')).toMatchObject({ tags: '[]' });
    db.sqlite.exec(`INSERT INTO customers (id, account_id, name, tags) VALUES ('duplicate', 'shop', 'Tea House', '["vendor"]')`);
    expect(await compassVendorId(db as any, 'shop', { vendor_name: 'Tea House' })).toBeNull();
  });
});
