import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { decodeCompassWrite } from '../src/compassCodec';
import { receiptRequest, ReceiptDb } from './helpers/receiptHarness';
const migration = readFileSync('worker/migrations/0048_compass_given_name.sql', 'utf8');
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA recursive_triggers=ON;
    CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY, account_id TEXT, name TEXT, draft_product_id TEXT, updated_at TEXT);
    CREATE TABLE products(id TEXT PRIMARY KEY, account_id TEXT, product_name TEXT, given_name TEXT, source_compass_entry_id TEXT, updated_at TEXT);
    INSERT INTO tea_compass_entries VALUES('tea','a','Supplier name',NULL,NULL),('other','b','Other source',NULL,NULL);`);
  db.exec(migration);
  return db;
}
describe('given name travels with one tea identity', () => {
  it('persists before inventory without creating or changing any product', () => {
    const db = database();
    db.prepare('UPDATE tea_compass_entries SET given_name=? WHERE id=?').run('Amber Sky','tea');
    expect(db.prepare('SELECT name,given_name,draft_product_id FROM tea_compass_entries WHERE id=?').get('tea')).toMatchObject({name:'Supplier name',given_name:'Amber Sky',draft_product_id:null});
    expect(db.prepare('SELECT count(*) n FROM products').get()).toMatchObject({n:0});
  });
  it('keeps edits and deliberate clearing synchronized in both directions, without cross-account writes or loops', () => {
    const db = database();
    db.exec("INSERT INTO products VALUES('p','a','Supplier name','Amber','tea',NULL); INSERT INTO products VALUES('foreign','b','Foreign','Keep','tea',NULL);");
    db.exec("UPDATE tea_compass_entries SET given_name='Gold' WHERE id='tea'");
    expect(db.prepare("SELECT given_name FROM products WHERE id='p'").get()).toMatchObject({given_name:'Gold'});
    expect(db.prepare("SELECT given_name FROM products WHERE id='foreign'").get()).toMatchObject({given_name:'Keep'});
    db.exec("UPDATE products SET given_name='New name' WHERE id='p'");
    expect(db.prepare("SELECT name,given_name FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({name:'Supplier name',given_name:'New name'});
    db.exec("UPDATE tea_compass_entries SET given_name=NULL WHERE id='tea'");
    expect(db.prepare("SELECT product_name,given_name FROM products WHERE id='p'").get()).toMatchObject({product_name:'Supplier name',given_name:null});
  });
  it('preserves a pre-inventory name when linking an existing holding', () => {
    const db = database();
    db.exec("UPDATE tea_compass_entries SET given_name='Chosen first' WHERE id='tea'; INSERT INTO products VALUES('existing','a','Original','Old stock title',NULL,NULL); UPDATE tea_compass_entries SET draft_product_id='existing' WHERE id='tea';");
    expect(db.prepare("SELECT given_name FROM products WHERE id='existing'").get()).toMatchObject({given_name:'Chosen first'});
    expect(db.prepare("SELECT name,given_name FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({name:'Supplier name',given_name:'Chosen first'});
  });
  it('adopts an existing holding name only when the encounter has none', () => {
    const db = database();
    db.exec("INSERT INTO products VALUES('existing','a','Original','Existing chosen title',NULL,NULL); UPDATE tea_compass_entries SET draft_product_id='existing' WHERE id='tea';");
    expect(db.prepare("SELECT given_name FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({given_name:'Existing chosen title'});
  });
  it('accepts the explicit field in the API codec', () => {
    expect(decodeCompassWrite({given_name:'Amber'},true)).toEqual({values:{given_name:'Amber'}});
  });
  it('promotes with the chosen name, preserves source name and reuses the same identity', async () => {
    const db = ReceiptDb.seeded();
    Object.assign(db.entries.get('entry-a')!, { name:'Supplier source',given_name:'Amber Sky' });
    const response = await receiptRequest(db,'/api/compass/entries/entry-a/promote',{method:'POST'});
    expect(response.status).toBe(201);
    const product = await response.json() as any;
    expect(db.products.get(product.id)).toMatchObject({given_name:'Amber Sky',product_name:'Supplier source',source_compass_entry_id:'entry-a'});
    const again = await receiptRequest(db,'/api/compass/entries/entry-a/promote',{method:'POST'});
    expect((await again.json() as any).id).toBe(product.id);
  });
});
