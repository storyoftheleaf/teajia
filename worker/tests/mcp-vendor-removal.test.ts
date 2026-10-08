import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { deleteUnreferencedVendor, readVendorDependencies, VENDOR_DEPENDENCIES } from '../src/vendorDependencies';

const ACCOUNT = 'acc-one';
const TOKEN = 'tjmcp_vendor_removal';
async function setup() {
  const db = new SqliteD1();
  seedIdentity(db);
  seedIdentity(db, { userId: 'other', accountId: 'other-account' });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(TOKEN))))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at)
    VALUES ('token',?,'user-one','user-one@test.dev','test',?,'tjmcp_',?,'operator',?)`)
    .run(ACCOUNT, hash, JSON.stringify(['stock:write']), Math.floor(Date.now() / 1000) + 3600);
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES ('vendor',?,'XWT','[\"vendor\"]')").run(ACCOUNT);
  return db;
}
async function call(db: SqliteD1, args: Record<string, unknown>, beforeDelete?: () => void) {
  const response = await mcpFetch(new Request('https://api.test/mcp', {
    method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'remove_vendor_contact', arguments: args } }),
  }), { DB: {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const wrapper = {
        statement, bind(...values: unknown[]) { statement.bind(...values); return wrapper; },
        first: async () => statement.first(), all: async () => statement.all(),
        run: async () => { if (sql.startsWith('DELETE FROM customers')) beforeDelete?.(); return statement.run(); },
      };
      return wrapper;
    }, batch: async (statements: any[]) => db.batch(statements.map(item => item.statement)),
  } } as any);
  expect(response.status).toBe(200);
  const body = await response.json() as any;
  expect(body.error).toBeUndefined();
  return body.result.structuredContent;
}
function addTea(db: SqliteD1, account = ACCOUNT) {
  db.sqlite.prepare("INSERT INTO tea_compass_entries(id,account_id,name,vendor_id,archived_at) VALUES ('tea',?,'LB1','vendor','2026-01-01')").run(account);
}

describe('vendor removal preserves durable sourcing references', () => {
  it('covers every durable vendor/contact column in the schema', () => {
    const schema = readFileSync('worker/schema.sql', 'utf8');
    const predicates = Object.values(VENDOR_DEPENDENCIES).join('\n');
    for (const table of schema.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? (\w+)\s*\(([\s\S]*?)\n\);/g)) {
      // Tags describe the contact itself and intentionally cascade on deletion.
      if (table[1] === 'customer_tags') continue;
      for (const column of table[2].matchAll(/^\s*(vendor_id|customer_id|contact_customer_id|linked_customer_id|resolved_vendor_customer_id) TEXT/gm)) {
        expect(predicates, `${table[1]}.${column[1]}`).toContain(`FROM ${table[1]} r`);
        expect(VENDOR_DEPENDENCIES[Object.keys(VENDOR_DEPENDENCIES).find(key =>
          VENDOR_DEPENDENCIES[key].includes(`FROM ${table[1]} r`))!]).toContain(`r.${column[1]} = customers.id`);
      }
    }
  });
  it('preserves an archived quote and a completed vendor order', async () => {
    const db = await setup();
    db.sqlite.prepare(`INSERT INTO curate_quotes(id,account_id,vendor_id,created_by_user_id,archived_at)
      VALUES ('quote',?,'vendor','user-one','2026-01-01')`).run(ACCOUNT);
    db.sqlite.prepare(`INSERT INTO purchase_orders(id,account_id,vendor_id,status,created_at,updated_at)
      VALUES ('order',?,'vendor','received','2026-01-01','2026-01-01')`).run(ACCOUNT);
    const preview = await call(db, { customer_id: 'vendor' });
    expect(preview.preview).toMatchObject({ will_refuse: true, references: { quotes: 1, purchase_orders: 1 } });
    expect(await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token })).toMatchObject({ error: 'vendor_still_referenced' });
    db.close();
  });
  it('previews and refuses Curate teas and physical samples even when archived', async () => {
    const db = await setup();
    addTea(db);
    db.sqlite.prepare("INSERT INTO tea_sample_sets(id,account_id,name,source_id,archived) VALUES ('set',?,'XWT','vendor',1)").run(ACCOUNT);
    db.sqlite.prepare("INSERT INTO tea_samples(id,account_id,name,set_id,source_id,grams,archived_at) VALUES ('sample',?,'LB1','set','vendor',5,'2026-01-01')").run(ACCOUNT);
    const preview = await call(db, { customer_id: 'vendor' });
    expect(preview.preview).toMatchObject({ will_refuse: true, references: { products: 0, invoices: 0, vendor_groups: 0, curate_teas: 1, samples: 1, sample_sets: 1 } });
    expect(await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token })).toMatchObject({ error: 'vendor_still_referenced' });
    expect(db.sqlite.prepare("SELECT id FROM customers WHERE id='vendor'").get()).toBeTruthy();
    db.close();
  });
  it('rechecks references added after a clear preview', async () => {
    const db = await setup();
    const preview = await call(db, { customer_id: 'vendor' });
    expect(preview.preview.will_refuse).toBe(false);
    addTea(db);
    expect(await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token })).toMatchObject({ error: 'vendor_still_referenced', references: { curate_teas: 1 } });
    db.close();
  });
  it('the atomic delete refuses a dependency inserted after the confirm read, without a success audit', async () => {
    const db = await setup();
    const preview = await call(db, { customer_id: 'vendor' });
    const result = await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token }, () => addTea(db));
    expect(result).toMatchObject({ error: 'vendor_still_referenced', references: { curate_teas: 1 } });
    expect(db.sqlite.prepare("SELECT COUNT(*) n FROM activity_logs WHERE action='VENDOR_CONTACT_REMOVE_MCP'").get()).toEqual({ n: 0 });
    db.close();
  });
  it('removes only a genuinely unreferenced contact and logs success once', async () => {
    const db = await setup();
    db.sqlite.prepare("INSERT INTO customer_tags(customer_id,account_id,tag) VALUES ('vendor',?,'vendor')").run(ACCOUNT);
    const preview = await call(db, { customer_id: 'vendor' });
    expect(await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token })).toMatchObject({ committed: true, vendor_id: 'vendor' });
    expect(db.sqlite.prepare("SELECT id FROM customers WHERE id='vendor'").get()).toBeUndefined();
    expect(db.sqlite.prepare("SELECT COUNT(*) n FROM activity_logs WHERE action='VENDOR_CONTACT_REMOVE_MCP'").get()).toEqual({ n: 1 });
    db.close();
  });
  it('does not count another account or disclose/delete its vendor', async () => {
    const db = await setup();
    addTea(db, 'other-account');
    db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES ('foreign','other-account','Private','[\"vendor\"]')").run();
    expect(await call(db, { customer_id: 'foreign' })).toEqual({ error: 'not_found' });
    const preview = await call(db, { customer_id: 'vendor' });
    expect(preview.preview.references.curate_teas).toBe(0);
    expect(await call(db, { customer_id: 'vendor', confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect(db.sqlite.prepare("SELECT id FROM customers WHERE id='foreign'").get()).toBeTruthy();
    db.close();
  });
  // Execute every predicate against SQLite, independently of the other
  // references: a broad OR elsewhere cannot conceal a broken guard.
  for (const [key, query] of Object.entries(VENDOR_DEPENDENCIES)) {
    it(`atomically protects ${key} and scopes its preview`, async () => {
      const db = new SqliteD1(false);
      db.sqlite.exec('CREATE TABLE customers(id TEXT,account_id TEXT,merged_into_id TEXT);');
      const tables = new Map<string, Set<string>>();
      for (const predicate of Object.values(VENDOR_DEPENDENCIES)) {
        const table = /FROM (\w+) r/.exec(predicate)![1];
        const columns = tables.get(table) ?? new Set<string>();
        for (const match of predicate.matchAll(/r\.(\w+)/g)) columns.add(match[1]);
        tables.set(table, columns);
      }
      for (const [table, columns] of tables) if (table !== 'customers')
        db.sqlite.exec(`CREATE TABLE ${table}(${[...columns].map(column => `${column} TEXT`).join(',')});`);
      db.sqlite.exec("INSERT INTO customers(id,account_id) VALUES ('vendor','acc-one');");
      const table = /FROM (\w+) r/.exec(query)![1];
      const columns = [...new Set([...query.matchAll(/r\.(\w+) = customers.id/g)].map(match => match[1]))];
      const values: Record<string, string> = { account_id: ACCOUNT, [columns[0]]: 'vendor' };
      if (key === 'attachments') values.entity_type = 'vendor';
      if (key === 'history') values.entity_type = 'vendor';
      const insert = (account: string) => db.sqlite.prepare(`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`)
        .run(...Object.entries(values).map(([column, value]) => column === 'account_id' ? account : value));
      insert('other-account');
      expect((await readVendorDependencies(db as any, ACCOUNT, 'vendor'))[key]).toBe(0);
      insert(ACCOUNT);
      expect((await readVendorDependencies(db as any, ACCOUNT, 'vendor'))[key]).toBe(1);
      expect((await deleteUnreferencedVendor(db as any, ACCOUNT, 'vendor')).meta.changes).toBe(0);
      db.close();
    });
  }
});
