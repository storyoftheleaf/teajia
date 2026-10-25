/** Isolated Library copy. Remote operations are SELECT only; writes stay in a new local D1. */
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = join(worker, '.wrangler/library-preview');
const config = join(home, 'wrangler.json');
const state = join(home, 'state');
const account = 'acc_teajia_bali';
const command = process.argv[2];
const run = args => execFileSync('npx', ['wrangler', ...args], { cwd: worker, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const remote = sql => {
  if (!/^SELECT\b/.test(sql)) throw new Error('Only SELECT may reach production');
  const out = run(['d1', 'execute', 'teajia-db', '--remote', '--json', '--command', sql]);
  return JSON.parse(out.slice(out.indexOf('['))).flatMap(r => r.results ?? []);
};
const privateFile = (path, value) => writeFileSync(path, value, { mode: 0o600 });

if (command === 'start') {
  if (!existsSync(config)) throw new Error('Run library-preview.mjs snapshot first');
  // A separate cwd and config prevent loading the shop .dev.vars credentials.
  const child = spawn(resolve(worker, 'node_modules/.bin/wrangler'), ['dev', '--config', config,
    '--local', '--ip', '127.0.0.1', '--port', '8790', '--persist-to', state],
  { cwd: home, stdio: 'inherit', env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' } });
  child.on('exit', code => process.exit(code ?? 1));
} else if (command === 'snapshot') {
  if (existsSync(config)) throw new Error('A persistent preview already exists. Preserve its edits; use start.');
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const schema = remote("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'notes_fts%' AND type IN ('table','index','trigger')");
  const tables = schema.filter(o => o.type === 'table');
  const names = new Set(tables.map(o => o.name));
  const selected = ['accounts', 'exchange_rates', 'products', 'product_listings', 'tea_profiles', 'batches',
    'tea_compass_entries', 'tea_sample_sets', 'curate_quotes', 'curate_journeys', 'curate_visits',
    'inventory_receipts', 'inventory_receipt_lines', 'curate_receipt_proposals', 'stock_ledger',
    'purchase_orders', 'curate_import_batches', 'curate_import_vendor_groups', 'curate_import_items',
    'curate_import_receipts', 'curate_freight_costs', 'shipping_routes'];
  const data = {};
  for (const table of selected.filter(t => names.has(t))) {
    const cols = remote(`SELECT name FROM pragma_table_info('${table}')`).map(c => c.name);
    const safe = cols.filter(c => !/encrypted|secret|token|api_key/i.test(c));
    let where = cols.includes('account_id') ? ` WHERE account_id = '${account}'` : '';
    if (table === 'accounts') where = ` WHERE id = '${account}'`;
    data[table] = remote(`SELECT ${safe.map(c => `"${c}"`).join(',')} FROM "${table}"${where}`);
    console.log(`${table}: ${data[table].length}`);
  }
  // Supplier identities only: no personal contact channels, verification data or auth rows.
  data.customers = remote(`SELECT id,name,company,tags,type,account_id FROM customers WHERE account_id = '${account}' AND (type = 'supplier' OR id IN (SELECT vendor_id FROM tea_compass_entries WHERE account_id = '${account}') OR id IN (SELECT vendor_id FROM products WHERE account_id = '${account}'))`);
  const password = randomBytes(24).toString('base64url');
  const operator = 'library-preview-operator';
  const userIds = new Set([operator]);
  for (const rows of Object.values(data)) for (const row of rows) for (const [key, value] of Object.entries(row)) {
    if ((key === 'user_id' || key.endsWith('_user_id')) && value) userIds.add(value);
    if (key === 'source_id' && 'parsed_data_json' in row) row[key] = null;
  }
  data.users = [...userIds].map(id => ({ id, email: `${id}@preview.invalid`, name: id === operator ? 'Library Preview' : 'Local record owner',
    password_hash: id === operator ? createHash('sha256').update(password).digest('hex') : 'disabled-local-copy',
    role: id === operator ? 'owner' : 'user', username: id === operator ? 'library-preview' : null,
    platform_role: id === operator ? 'platform_owner' : null, admin_request_status: 'approved',
    email_verified_at: new Date().toISOString(), session_version: 0 }));
  data.account_members = [{ id: 'library-preview-owner', account_id: account, user_id: operator, role: 'owner', status: 'active' }];
  privateFile(join(home, 'snapshot.json'), JSON.stringify({ schema, data }));
  privateFile(join(home, 'credentials.json'), JSON.stringify({ username: 'library-preview', password, account, api: 'http://127.0.0.1:8790' }));
  privateFile(config, JSON.stringify({ name: 'teajia-library-local', main: join(worker, 'src/index.ts'), compatibility_date: '2024-12-01',
    vars: { JWT_SECRET: randomBytes(48).toString('hex'), VERIFICATION_CODE_SECRET: randomBytes(48).toString('hex') },
    d1_databases: [{ binding: 'DB', database_name: 'teajia-library-local', database_id: '00000000-0000-0000-0000-000000000001' }],
    r2_buckets: [{ binding: 'MEDIA_BUCKET', bucket_name: 'library-local-media' }, { binding: 'ATLAS_BUCKET', bucket_name: 'library-local-atlas' }] }));
  initialize();
} else if (command === 'initialize') initialize();
else throw new Error('Usage: library-preview.mjs snapshot|start');

function initialize() {
  run(['d1', 'execute', 'teajia-library-local', '--config', config, '--local', '--persist-to', state, '--command', 'SELECT 1']);
  const findDb = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? findDb(join(dir, e.name)) : e.name.endsWith('.sqlite') && e.name !== 'metadata.sqlite' ? [join(dir, e.name)] : []);
  const dbs = findDb(state);
  if (dbs.length !== 1) throw new Error('Local database identity ambiguous');
  execFileSync('python3', ['-c', `import json,sqlite3,sys
payload=json.load(open(sys.argv[1])); db=sqlite3.connect(sys.argv[2]); db.execute('PRAGMA foreign_keys=OFF')
for o in payload['schema']:
 if o['type']=='table': db.execute(o['sql'])
for table,rows in payload['data'].items():
 for row in rows:
  keys=list(row); db.execute('INSERT INTO "'+table+'" ('+','.join('"'+k+'"' for k in keys)+') VALUES ('+','.join('?' for k in keys)+')',[row[k] for k in keys])
for o in payload['schema']:
 if o['type']!='table': db.execute(o['sql'])
db.commit(); print('Local database created; production unchanged')`, join(home, 'snapshot.json'), dbs[0]], { stdio: 'inherit' });
  console.log(`Start: node worker/sandbox/library-preview.mjs start\nCredentials (local only): ${join(home, 'credentials.json')}`);
}
