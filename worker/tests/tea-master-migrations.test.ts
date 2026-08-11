import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(join(process.cwd(), 'worker/migrations', name), 'utf8');

describe('Tea Master migration safety', () => {
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
    db.exec(migration('124_tea_master_profiles.sql'));
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
    db.exec(migration('125_wisdom_relations.sql'));
    expect(db.prepare('SELECT id FROM article_products').all()).toEqual([{ id: 'first' }]);
    expect(() => db.exec(`INSERT INTO article_products(id,article_id,product_id) VALUES ('again','article-one','product-one')`)).toThrow(/UNIQUE/);
    db.close();
  });
});
