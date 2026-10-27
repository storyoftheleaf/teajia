import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { vendorEconomics } from '../../src/admin/views/vendorProfileData';

const opened: SqliteD1[] = [];
const tempDirs: string[] = [];
afterEach(() => tempDirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
afterEach(() => opened.splice(0).forEach(db => db.close()));
it('prices only the vendor subset with full-inventory parity and lower fixture work', async () => {
  const db = new SqliteD1(); opened.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop' });
  seedIdentity(db, { userId: 'other', accountId: 'other' });
  db.sqlite.exec("INSERT OR REPLACE INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1),('Yuan',8); UPDATE accounts SET default_shipping_rate_per_kg=85, default_shipping_rate_currency='Yuan' WHERE id='shop'");
  const insert = db.sqlite.prepare(`INSERT INTO products (id,account_id,product_name,vendor_id,type,cost_amount,cost_currency,cost_currency_source,quantity_purchased,quantity_units,stock_grams,shipping_rate_per_kg,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const cases = [
    ['Tea',88,'CNY','stated',100,null,40.5,null,'Active'],
    ['Tea',0,'USD','stated',100,null,0,0,'Active'],
    ['Teaware',50,'USD','stated',10,5,0,null,'Active'],
    ['Tea',null,'USD',null,100,null,null,null,'Active'],
    ['Tea',90,'ZZZ','stated',100,null,50,null,'Active'],
    ['Tea',88,'Yuan','stated',0,null,10,null,'Active'],
    ['Tea',88,'Yuan','stated',100,null,10,null,'Archived'],
    ['Tea',88,'UNK',null,100,null,10,null,'Active'],
  ];
  for (let i=0;i<340;i++) insert.run(`p${i}`, 'shop', `Tea ${i}`, i<cases.length?'vendor':'elsewhere', ...(cases[i] ?? cases[0]));
  insert.run('foreign','other','Foreign','vendor',...cases[0]);
  const queries: Array<{sql:string; values:unknown[]}> = [];
  const measured = { prepare(sql:string) {
    let values:unknown[]=[];
    const stmt:any = { bind(...v:unknown[]) { values=v; return stmt; }, async all() { queries.push({sql,values}); return db.prepare(sql).bind(...values).all(); }, async run() { return db.prepare(sql).bind(...values).run(); } }; return stmt;
  }, async batch(stmts:any[]) { return Promise.all(stmts.map(s=>s.all())); } };
  const token = await signedToken('secret',{sub:'owner',email:'owner@test.dev',active_account_id:'shop',platform_role:null});
  async function get(path:string) { const res=await worker.fetch(new Request(`https://test${path}`,{headers:{Authorization:`Bearer ${token}`,'X-Teajia-Account':'shop'}}),{DB:measured,JWT_SECRET:'secret'} as any); expect(res.status).toBe(200);return res.json() as Promise<any[]>; }
  const inventory=await get('/api/products');
  const inventoryQueries=queries.splice(0);
  const detail=await get('/api/products/p0') as unknown as Record<string, unknown>;
  const detailQueries=queries.splice(0);
  expect(detail).toEqual(inventory.find(row=>row.id==='p0'));
  const supplied=await get('/api/customers/vendor/products');
  expect(inventory).toHaveLength(340); expect(supplied).toHaveLength(cases.length);
  expect(supplied.some(row=>row.id==='foreign')).toBe(false);
  const rates=[{currency:'USD',rateToUSD:1},{currency:'Yuan',rateToUSD:8}];
  for(const row of supplied) {
    const priced=inventory.find(p=>p.id===row.id);
    expect(row.cost_per_gram_usd).toBe(priced.cost_per_gram_usd);
    expect(vendorEconomics([row],[row],rates)).toEqual(vendorEconomics([row],inventory,rates));
  }
  expect(supplied.find(row=>row.id==='p0').stock_grams).toBe(40.5);
  expect(supplied.find(row=>row.id==='p3').stock_grams).toBeNull();
  expect(vendorEconomics(supplied,supplied,rates)).toEqual(vendorEconomics(supplied,inventory,rates));
  const afterBytes=Buffer.byteLength(JSON.stringify(supplied));
  const oldSupplied=supplied.map(({cost_currency_source,quantity_purchased,quantity_units,shipping_rate_per_kg,cost_per_gram_usd,...row})=>row);
  const beforeBytes=Buffer.byteLength(JSON.stringify(inventory))+Buffer.byteLength(JSON.stringify(oldSupplied));
  expect(afterBytes).toBeLessThan(beforeBytes/10);
  // Execute the captured real queries over identical data in Python SQLite.
  // VM instructions and returned rows are fixture metrics, NOT D1 billed rows.
  const rows=db.sqlite.prepare('SELECT * FROM products').all();
  const accounts=db.sqlite.prepare('SELECT * FROM accounts').all();
  const rateRows=db.sqlite.prepare('SELECT * FROM exchange_rates').all();
  const productQueries=(qs:typeof queries)=>qs.filter(q=>/FROM products/i.test(q.sql));
  const tempDir=mkdtempSync(join(tmpdir(),'vendor-cost-')); tempDirs.push(tempDir);
  const fixturePath=join(tempDir,'fixture.json');
  writeFileSync(fixturePath,JSON.stringify({schema:readFileSync('worker/schema.sql','utf8'),accounts,products:rows,exchange_rates:rateRows,before:[...productQueries(inventoryQueries),...productQueries(queries).map(q=>({...q,sql:q.sql.replace(',\n      cost_currency_source, quantity_purchased, quantity_units, shipping_rate_per_kg','')}))],after:productQueries(queries),detailBefore:productQueries(inventoryQueries),detailAfter:productQueries(detailQueries)}));
  const report=JSON.parse(execFileSync('python3',['-c',`
import sqlite3,json,sys
with open(sys.argv[1]) as source: x=json.load(source)
db=sqlite3.connect(':memory:');db.executescript(x['schema'])
for table in ['accounts','products','exchange_rates']:
 for row in x[table]:
  db.execute('INSERT OR REPLACE INTO '+table+' ('+','.join(row)+') VALUES ('+','.join('?' for _ in row)+')',list(row.values()))
def measure(queries):
 steps=[0];returned=0
 def tick(): steps[0]+=1;return 0
 db.set_progress_handler(tick,1)
 for q in queries: returned+=len(db.execute(q['sql'],q['values']).fetchall())
 db.set_progress_handler(None,0)
 return dict(vmSteps=steps[0],returnedRows=returned)
print(json.dumps(dict(before=measure(x['before']),after=measure(x['after']),detailBefore=measure(x['detailBefore']),detailAfter=measure(x['detailAfter']))))
`,fixturePath],{encoding:'utf8',timeout:10_000}));
  expect(report.before.returnedRows).toBe(348); expect(report.after.returnedRows).toBe(8);
  expect(report.after.vmSteps).toBeLessThan(report.before.vmSteps);
  const detailBeforeBytes=Buffer.byteLength(JSON.stringify(inventory));
  const detailAfterBytes=Buffer.byteLength(JSON.stringify(detail));
  expect(report.detailBefore.returnedRows).toBe(340); expect(report.detailAfter.returnedRows).toBe(1);
  expect(report.detailAfter.vmSteps).toBeLessThan(report.detailBefore.vmSteps);
  expect(detailAfterBytes).toBeLessThan(detailBeforeBytes/100);
  process.stdout.write('Product detail fixture cost (not D1 billing): '+JSON.stringify({before:report.detailBefore,after:report.detailAfter,beforeBytes:detailBeforeBytes,afterBytes:detailAfterBytes})+'\n');
  process.stdout.write('Vendor fixture cost (not D1 billing): '+JSON.stringify({...report,beforeBytes,afterBytes})+'\n');
});
