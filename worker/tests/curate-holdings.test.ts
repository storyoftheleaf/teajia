import {describe,it,expect} from 'vitest';
import {SqliteD1} from './helpers/sqliteD1';
import {readCurateHoldings} from '../src/curateHoldings';
function setup() {
 const db=new SqliteD1(false);
 db.exec(`CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY,account_id TEXT,name TEXT,vendor_name TEXT,sample_state TEXT,draft_product_id TEXT,archived_at TEXT,deleted_at TEXT,merged_into_id TEXT);
 CREATE TABLE products(id TEXT PRIMARY KEY,account_id TEXT,source_compass_entry_id TEXT,stock_grams REAL,inventory_purpose TEXT);
 CREATE TABLE tea_sample_sets(id TEXT PRIMARY KEY,account_id TEXT,archived INTEGER);
 CREATE TABLE tea_samples(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,set_id TEXT,name TEXT,grams REAL,status TEXT,created_at TEXT);
 INSERT INTO tea_compass_entries VALUES('received','a','Received','Vendor','received',NULL,NULL,NULL,NULL);
 INSERT INTO tea_compass_entries VALUES('tasted','a','Tasted','Vendor','tasted',NULL,NULL,NULL,NULL);
 INSERT INTO tea_compass_entries VALUES('requested','a','Requested','Vendor','requested',NULL,NULL,NULL,NULL);
 INSERT INTO tea_compass_entries VALUES('stocked','a','Stocked','Vendor','received','product',NULL,NULL,NULL);
 INSERT INTO tea_compass_entries VALUES('foreign','b','Foreign','Vendor','received',NULL,NULL,NULL,NULL);
 INSERT INTO products VALUES('product','a','stocked',100,'working');
 INSERT INTO tea_sample_sets VALUES('set','a',0);
 INSERT INTO tea_sample_sets VALUES('foreign-set','b',0);
 INSERT INTO tea_sample_sets VALUES('archived-set','a',1);
 INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('r','a','received','set','Received sample',25,'received','2026-01-01');
 INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('t','a','tasted','set','Tasted sample',12,'tasted','2026-01-01');
 INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('f','b','foreign','foreign-set','Foreign sample',99,'received','2026-01-01');`);
 db.exec('ALTER TABLE tea_samples ADD COLUMN archived_at TEXT; ALTER TABLE tea_samples ADD COLUMN grams_known INTEGER NOT NULL DEFAULT 1');
 return db;
}
describe('one samples-only holdings reading for browser and agents',()=>{
 it('shows received and tasted holdings without manufacturing product rows',async()=>{
  const db=setup();const before=db.prepare('SELECT * FROM products').all().results;
  const holdings=await readCurateHoldings(db as any,'a',{samplesOnly:true});
  expect(holdings.map(h=>h.entry.id).sort()).toEqual(['received','tasted']);
  expect(holdings.find(h=>h.entry.id==='received')).toMatchObject({stock_grams:0,sample_grams:25});
  expect(holdings.find(h=>h.entry.id==='tasted')).toMatchObject({stock_grams:0,sample_grams:12});
  expect(db.prepare('SELECT * FROM products').all().results).toEqual(before);
 });
 it('excludes full stock even when it is linked through source and includes stock when asked',async()=>{
  const db=setup();db.exec("INSERT INTO products VALUES('source-only','a','tasted',75,'working')");
  expect((await readCurateHoldings(db as any,'a',{samplesOnly:true})).map(h=>h.entry.id)).toEqual(['received']);
  expect((await readCurateHoldings(db as any,'a',{teaId:'tasted'}))[0].stock_grams).toBe(75);
 });
 it('keeps merged sample portions distinct and scopes merge families to one account',async()=>{
  const db=setup();db.exec(`INSERT INTO tea_compass_entries VALUES('duplicate','a','Duplicate','Vendor','received',NULL,'2026-01-01',NULL,'received');
   INSERT INTO tea_compass_entries VALUES('cross-account-child','b','Foreign duplicate','Vendor','received',NULL,'2026-01-01',NULL,'received');
   INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('duplicate-sample','a','duplicate','set','Separate physical bag',7,'tasted','2026-01-02');
   INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('foreign-child','b','cross-account-child','foreign-set','Foreign child',88,'tasted','2026-01-02');
   INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,name,grams,status,created_at) VALUES('archived','a','received','archived-set','Old archived batch',100,'tasted','2026-01-02');`);
  const result=await readCurateHoldings(db as any,'a',{teaId:'received',samplesOnly:true});
  expect(result).toHaveLength(1);expect(result[0].sample_grams).toBe(32);
  expect(result[0].samples.map(s=>({id:s.id,grams:s.grams,tea:s.compass_entry_id}))).toEqual([{id:'r',grams:25,tea:'received'},{id:'duplicate-sample',grams:7,tea:'duplicate'}]);
  expect((await readCurateHoldings(db as any,'a',{teaId:'foreign'}))).toEqual([]);
 });
 it('does not report a legacy placeholder as a measured sample balance',async()=>{
  const db=setup();db.exec("UPDATE tea_samples SET grams=10,grams_known=0 WHERE id='r'");
  const row=(await readCurateHoldings(db as any,'a',{samplesOnly:true})).find(h=>h.entry.id==='received')!;
  expect(row.sample_grams).toBeNull();expect(row.samples[0].grams).toBeNull();
 });
 it('keeps received merged portions visible when the canonical tea has no sample marker',async()=>{
  const db=setup();db.exec("UPDATE tea_compass_entries SET sample_state=NULL WHERE id='received'");
  expect((await readCurateHoldings(db as any,'a',{samplesOnly:true})).map(h=>h.entry.id)).toContain('received');
  db.exec("UPDATE tea_samples SET archived_at='2026-10-08' WHERE id='r'");
  expect((await readCurateHoldings(db as any,'a',{samplesOnly:true})).map(h=>h.entry.id)).not.toContain('received');
 });
 it('reads positive stock in the merge family once and never calls samples full stock',async()=>{
  const db=setup();db.exec(`INSERT INTO tea_compass_entries VALUES('duplicate','a','Duplicate','Vendor','received','duplicate-product','2026-01-01',NULL,'received');
   INSERT INTO products VALUES('duplicate-product','a','duplicate',50,'working');
   INSERT INTO products VALUES('sample-product','a','received',200,'sample');`);
  expect((await readCurateHoldings(db as any,'a',{samplesOnly:true})).map(h=>h.entry.id)).toEqual(['tasted']);
  expect((await readCurateHoldings(db as any,'a',{teaId:'received'}))[0].stock_grams).toBe(50);
 });
});
