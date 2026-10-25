import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { SqliteD1 } from './helpers/sqliteD1';
import { readCurateHoldings } from '../src/curateHoldings';

const schema = `
CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY,account_id TEXT,name TEXT,vendor_name TEXT,sample_state TEXT,draft_product_id TEXT,archived_at TEXT,deleted_at TEXT,merged_into_id TEXT);
CREATE TABLE products(id TEXT PRIMARY KEY,account_id TEXT,source_compass_entry_id TEXT,stock_grams REAL,inventory_purpose TEXT);
CREATE TABLE tea_sample_sets(id TEXT PRIMARY KEY,account_id TEXT,archived INTEGER);
CREATE TABLE tea_samples(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,set_id TEXT,name TEXT,grams REAL,grams_known INTEGER,status TEXT,created_at TEXT,archived_at TEXT);
CREATE INDEX entry_account ON tea_compass_entries(account_id);
CREATE INDEX product_account ON products(account_id);
CREATE INDEX sample_account ON tea_samples(account_id);
INSERT INTO tea_sample_sets VALUES('set','a',0),('other-set','b',0),('archived-set','a',1);
`;
function entry(id: string, parent: string | null = null, draft: string | null = null, account = 'a') {
  return `INSERT INTO tea_compass_entries VALUES('${id}','${account}','${id}','Vendor','received',${draft ? `'${draft}'` : 'NULL'},NULL,NULL,${parent ? `'${parent}'` : 'NULL'});`;
}

describe('holdings database reads stay bounded as the collection grows', () => {
  it('keeps exactly three reads and linear SQLite execution work at realistic inventory sizes', async () => {
    const measures: number[] = [];
    for (const scale of [1, 4]) {
      let fixture = schema;
      for (let i = 0; i < 50 * scale; i++) {
        fixture += entry(`tea-${i}`);
        fixture += `INSERT INTO tea_samples VALUES('sample-${i}','a','tea-${i}','set','Bag',5,1,'received','2026-01-01',NULL);`;
      }
      for (let i = 0; i < 340 * scale; i++) fixture += `INSERT INTO products VALUES('product-${i}','a','tea-${i % (50 * scale)}',10,'working');`;
      const db = new SqliteD1(false); db.exec(fixture);
      const queries: Array<{ sql: string; values: unknown[] }> = [];
      const measuredDb = {
        prepare(sql: string) {
          return { bind(...values: unknown[]) {
            queries.push({ sql, values });
            return db.prepare(sql).bind(...values);
          } };
        },
      };
      try {
        const holdings = await readCurateHoldings(measuredDb as any, 'a');
        expect(holdings).toHaveLength(50 * scale);
        expect(holdings.reduce((sum, holding) => sum + holding.stock_grams, 0)).toBe(3400 * scale);
        expect(queries).toHaveLength(3);
        // Count real SQLite VM instructions, not elapsed time or returned rows.
        // A correlated scan can return few rows while exhausting D1's allowance.
        const operations = Number(execFileSync('python3', ['-c', `
import json, sqlite3, sys
fixture=json.load(sys.stdin)
db=sqlite3.connect(':memory:')
db.executescript(fixture['schema'])
steps=0
def count():
 global steps
 steps+=1
 return 0
db.set_progress_handler(count,1)
for query in fixture['queries']:
 db.execute(query['sql'],query['values']).fetchall()
print(steps)
`], { input: JSON.stringify({ schema: fixture, queries }), encoding: 'utf8' }).trim());
        expect(operations).toBeLessThan(30_000 * scale);
        measures.push(operations);
      } finally { db.close(); }
    }
    // Four times the input must not return to per-tea product/sample scans.
    expect(measures[1]).toBeLessThan(measures[0] * 4.5);
  });

  it('deduplicates source/draft links, preserves merge depth, and excludes foreign stock', async () => {
    const db = new SqliteD1(false);
    let fixture = schema + entry('root', null, 'shared') + entry('second', null, 'shared');
    for (let i = 1; i <= 21; i++) fixture += entry(`child-${i}`, i === 1 ? 'root' : `child-${i - 1}`, i === 1 ? 'shared' : null);
    fixture += entry('foreign', 'root', null, 'b');
    fixture += `
INSERT INTO products VALUES('shared','a','child-1',30,'working'),('boundary','a','child-20',5,NULL),('too-deep','a','child-21',100,'working'),('foreign','b','root',999,'working'),('sample-product','a','root',500,'sample');
INSERT INTO tea_samples VALUES('included','a','child-20','set','Included',7,1,'received','2026-01-01',NULL),('too-deep','a','child-21','set','Excluded',100,1,'received','2026-01-01',NULL),('foreign','b','foreign','other-set','Foreign',999,1,'received','2026-01-01',NULL),('wrong-set','a','root','other-set','Wrong account',999,1,'received','2026-01-01',NULL),('archived-set','a','root','archived-set','Archived',999,1,'received','2026-01-01',NULL);
UPDATE tea_compass_entries SET archived_at='2026-01-01',deleted_at='2026-01-01' WHERE id='child-1';`;
    db.exec(fixture);
    try {
      const holdings = await readCurateHoldings(db as any, 'a');
      expect(holdings.map(h => h.entry.id)).toEqual(['root', 'second']);
      expect(holdings[0]).toMatchObject({ stock_grams: 35, sample_grams: 7 });
      expect(holdings[0].samples.map(s => s.id)).toEqual(['included']);
      expect(holdings[1].stock_grams).toBe(30);
      expect(await readCurateHoldings(db as any, 'a', { samplesOnly: true })).toEqual([]);
      expect(await readCurateHoldings(db as any, 'a', { teaId: 'foreign' })).toEqual([]);
      expect((await readCurateHoldings(db as any, 'a', { teaId: 'second' }))[0].stock_grams).toBe(30);
    } finally { db.close(); }
  });
});
