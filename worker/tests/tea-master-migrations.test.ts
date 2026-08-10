import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(join(process.cwd(), 'worker/migrations', name), 'utf8');

describe('Tea Master migration safety', () => {
  it('ships account-confined grants, attribution snapshots and settlement history with schema parity', () => {
    const canonical = new DatabaseSync(':memory:');
    canonical.exec(readFileSync(join(process.cwd(), 'worker/schema.sql'), 'utf8'));
    const migrated = new DatabaseSync(':memory:');
    migrated.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE accounts(id TEXT PRIMARY KEY);
      CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE products(id TEXT PRIMARY KEY, account_id TEXT);
      CREATE TABLE invoices(id TEXT PRIMARY KEY, account_id TEXT);
      CREATE TABLE invoice_line_items(id TEXT PRIMARY KEY, account_id TEXT, invoice_id TEXT, product_id TEXT);
      CREATE TABLE stock_holds(
        id TEXT PRIMARY KEY,
        account_id TEXT,
        invoice_id TEXT,
        product_id TEXT,
        held_grams REAL DEFAULT 0
      );
      INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams)
        VALUES ('legacy-valid','account-a','invoice-a','product-a',12),
               ('legacy-null-account',NULL,'invoice-a','product-a',5),
               ('legacy-null-quantity','account-a','invoice-a','product-a',NULL);
    `);
    migrated.exec(migration('126_tea_master_sales.sql'));

    expect(migrated.prepare(`SELECT name,type,"notnull",dflt_value,pk FROM pragma_table_info('stock_holds') ORDER BY cid`).all())
      .toEqual(canonical.prepare(`SELECT name,type,"notnull",dflt_value,pk FROM pragma_table_info('stock_holds') ORDER BY cid`).all());
    for (const index of ['idx_stock_holds_invoice', 'idx_stock_holds_product']) {
      expect(migrated.prepare(`SELECT name FROM pragma_index_info('${index}') ORDER BY seqno`).all())
        .toEqual(canonical.prepare(`SELECT name FROM pragma_index_info('${index}') ORDER BY seqno`).all());
    }
    expect(migrated.prepare(`SELECT id,account_id,invoice_id,product_id,held_grams,expires_at FROM stock_holds ORDER BY id`).all())
      .toEqual([{ id: 'legacy-valid', account_id: 'account-a', invoice_id: 'invoice-a', product_id: 'product-a', held_grams: 12, expires_at: null }]);
    migrated.exec(`
      INSERT INTO accounts(id) VALUES ('reservation-account');
      INSERT INTO users(id) VALUES ('reservation-seller');
      INSERT INTO products(id,account_id) VALUES ('reservation-product','reservation-account');
      INSERT INTO invoices(id,account_id,sold_by_user_id) VALUES ('reservation-invoice','reservation-account','reservation-seller');
      INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at)
        VALUES ('reservation-hold','reservation-account','reservation-invoice','reservation-product',10,datetime('now','+2 days'));
    `);
    expect(migrated.prepare(`SELECT held_grams, expires_at IS NOT NULL AS has_expiry FROM stock_holds WHERE id='reservation-hold'`).get())
      .toEqual({ held_grams: 10, has_expiry: 1 });

    for (const table of ['sales_grants', 'sales_settlements']) {
      expect(migrated.prepare(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`).all())
        .toEqual(canonical.prepare(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`).all());
    }
    for (const [table, columns] of [
      ['invoices', ['sold_by_user_id', 'payment_recipient_user_id']],
      ['invoice_line_items', ['stock_owner_user_id', 'sales_grant_id', 'owner_share_type', 'owner_share_value']],
    ] as const) {
      for (const column of columns) {
        const canonicalColumn = canonical.prepare(
          `SELECT name,type,"notnull",dflt_value,pk FROM pragma_table_info('${table}') WHERE name=?`
        ).get(column);
        expect(migrated.prepare(
          `SELECT name,type,"notnull",dflt_value,pk FROM pragma_table_info('${table}') WHERE name=?`
        ).get(column)).toEqual(canonicalColumn);
        expect(canonicalColumn).toMatchObject({ name: column });
      }
    }
    expect(migrated.prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_sales_grants_account_product_seller'`).get()).toBeTruthy();
    expect(migrated.prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_sales_settlements_account_status'`).get()).toBeTruthy();
    canonical.close();
    migrated.close();
  });

  it('keeps fulfilled settlements after a grant is revoked', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(join(process.cwd(), 'worker/schema.sql'), 'utf8'));
    db.exec(`
      INSERT INTO accounts(id, slug, name) VALUES ('account-a','account-a','Account A');
      INSERT INTO users(id,email,name,password_hash) VALUES
        ('owner-a','owner@a.test','Owner','x'),('seller-a','seller@a.test','Seller','x');
      INSERT INTO products(id,account_id,type,product_name,owner_user_id) VALUES ('product-a','account-a','Tea','Tea','owner-a');
      INSERT INTO invoices(id,account_id,invoice_number,sold_by_user_id) VALUES ('invoice-a','account-a','A-1','seller-a');
      INSERT INTO sales_grants(id,account_id,product_id,seller_user_id,granted_by_user_id,owner_share_type,owner_share_value)
        VALUES ('grant-a','account-a','product-a','seller-a','owner-a','percent',80);
      INSERT INTO invoice_line_items(id,account_id,invoice_id,product_id,quantity,price_at_sale,stock_owner_user_id,sales_grant_id)
        VALUES ('line-a','account-a','invoice-a','product-a',10,1,'owner-a','grant-a');
      INSERT INTO sales_settlements(id,account_id,invoice_id,line_item_id,product_id,stock_owner_user_id,seller_user_id,grant_id,gross_amount,owner_amount,seller_amount)
        VALUES ('settlement-a','account-a','invoice-a','line-a','product-a','owner-a','seller-a','grant-a',10,8,2);
      UPDATE sales_grants SET revoked_at=datetime('now') WHERE id='grant-a';
    `);
    expect(db.prepare(`SELECT status, grant_id FROM sales_settlements WHERE id='settlement-a'`).get())
      .toEqual({ status: 'owed', grant_id: 'grant-a' });
    db.close();
  });
  it('ships review notes and an append-only redacted payment audit ledger in the canonical schema', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(join(process.cwd(), 'worker/schema.sql'), 'utf8'));
    expect(db.prepare(`SELECT name FROM pragma_table_info('contributor_profile_drafts') WHERE name='reviewer_note'`).get())
      .toEqual({ name: 'reviewer_note' });
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='payment_method_audit_events'`).get())
      .toEqual({ name: 'payment_method_audit_events' });
    expect(db.prepare(`SELECT name FROM pragma_table_info('contributors') WHERE name='unpublished_at'`).get())
      .toEqual({ name: 'unpublished_at' });
    expect(db.prepare(`SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list('contributor_accounts')
      WHERE "from"='contributor_id'`).get()).toEqual({
        table: 'contributors', from: 'contributor_id', to: 'id', on_delete: 'CASCADE',
      });
    db.close();
  });

  it('preserves immutable payment audit history when a contributor identity is deleted', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(join(process.cwd(), 'worker/schema.sql'), 'utf8'));
    db.exec(`
      INSERT INTO accounts(id, slug, name) VALUES ('steward','steward','Steward');
      INSERT INTO contributors(id, account_id, display_name) VALUES ('person','steward','Person');
      INSERT INTO payment_method_audit_events
        (id, contributor_id, payment_method_id, action, changed_fields, redacted_snapshot)
      VALUES ('audit-one','person','method-one','deleted','[]','{}');
      DELETE FROM contributors WHERE id='person';
    `);
    expect(db.prepare(`SELECT COUNT(*) AS count FROM payment_method_audit_events WHERE contributor_id='person'`).get())
      .toEqual({ count: 1 });
    expect(db.prepare(`SELECT COUNT(*) AS count FROM pragma_foreign_key_list('payment_method_audit_events')`).get())
      .toEqual({ count: 0 });
    expect(() => db.exec(`DELETE FROM payment_method_audit_events WHERE id='audit-one'`)).toThrow(/immutable/);
    db.close();
  });

  it('backfills a cross-account face and allows one contributor to host multiple accounts', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE accounts(id TEXT PRIMARY KEY, host_contributor_id TEXT);
      CREATE UNIQUE INDEX idx_accounts_host_contributor ON accounts(host_contributor_id) WHERE host_contributor_id IS NOT NULL;
      CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE contributors(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), user_id TEXT, face_of_account_id TEXT REFERENCES accounts(id), role TEXT, display_name TEXT NOT NULL, is_published INTEGER NOT NULL DEFAULT 0, updated_at TEXT);
      CREATE TABLE tea_profiles(id TEXT PRIMARY KEY);
      CREATE TABLE products(id TEXT PRIMARY KEY);
      CREATE TABLE product_listings(id TEXT PRIMARY KEY);
      INSERT INTO accounts(id) VALUES ('steward'),('host-one'),('host-two');
      INSERT INTO contributors(id,account_id,face_of_account_id,display_name,updated_at) VALUES ('person','steward','host-one','Person',datetime('now'));
    `);
    db.exec(migration('123_tea_master_profiles.sql'));
    expect(db.prepare(`SELECT account_id, is_host FROM contributor_accounts WHERE contributor_id='person' ORDER BY account_id`).all()).toEqual([
      { account_id: 'host-one', is_host: 1 }, { account_id: 'steward', is_host: 0 },
    ]);
    db.exec(`
      INSERT INTO contributor_accounts(contributor_id, account_id, is_host) VALUES ('person','host-two',1);
      UPDATE accounts SET host_contributor_id='person' WHERE id IN ('host-one','host-two');
    `);
    expect(db.prepare(`SELECT COUNT(*) AS count FROM accounts WHERE host_contributor_id='person'`).get()).toEqual({ count: 2 });
    db.close();
  });

  it('deduplicates an existing article_products table before adding its unique index', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE accounts(id TEXT PRIMARY KEY);
      CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE products(id TEXT PRIMARY KEY, account_id TEXT, cultivar TEXT);
      CREATE TABLE articles(id TEXT PRIMARY KEY, account_id TEXT, status TEXT);
      CREATE TABLE tea_profiles(id TEXT PRIMARY KEY);
      CREATE TABLE product_listings(id TEXT PRIMARY KEY, account_id TEXT, profile_id TEXT, legacy_product_id TEXT);
      CREATE TABLE article_products(id TEXT PRIMARY KEY, article_id TEXT NOT NULL, product_id TEXT NOT NULL, created_at TEXT);
      INSERT INTO products(id) VALUES ('product-one');
      INSERT INTO article_products(id,article_id,product_id) VALUES ('first','article-one','product-one'),('duplicate','article-one','product-one');
    `);
    db.exec(migration('124_wisdom_relations.sql'));
    expect(db.prepare('SELECT id FROM article_products').all()).toEqual([{ id: 'first' }]);
    expect(() => db.exec(`INSERT INTO article_products(id,article_id,product_id) VALUES ('again','article-one','product-one')`)).toThrow(/UNIQUE/);
    db.close();
  });
});
