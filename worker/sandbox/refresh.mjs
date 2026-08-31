/**
 * Rebuilds the LOCAL sandbox database from the live one.
 *
 * What it copies: the table structure, and the rows an inventory or shop screen
 * needs to look real (products, listings, tea profiles, accounts, collections,
 * batches, exchange rates).
 *
 * What it deliberately does NOT copy: users, customers, invoices, orders,
 * tasting journals, notes, tokens. Nobody's personal details land on this disk,
 * and the sandbox does not need them to render a product grid.
 *
 * Run via: npm run sandbox:refresh  (from worker/)
 *
 * Two notes on the mechanics, both learned the hard way:
 *  - The live database has full-text search tables, and the export endpoint
 *    refuses to touch a database containing them. So the table list is fetched
 *    first and those are filtered out by name.
 *  - Rows arrive grouped by table in whatever order the export chose, which
 *    breaks foreign keys on load. They are re-ordered parents-first below.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = 'teajia-db';

/** Tables whose rows are copied, parents before children (foreign keys). */
const DATA_TABLES = [
  'accounts',
  'exchange_rates',
  'products',
  'tea_profiles',
  'product_listings',
  'collections',
  'collection_items',
  'batches',
];

const wrangler = (args, capture = false) => execFileSync(
  'npx',
  ['wrangler', 'd1', ...args],
  { cwd: join(HERE, '..'), encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'ignore'] : 'inherit' },
);

const step = (message) => console.log(`\n── ${message}`);

mkdirSync(HERE, { recursive: true });

step('Listing live tables');
const listing = wrangler(
  ['execute', DB, '--remote', '--json', '--command',
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"],
  true,
);
// Full-text search tables and the internal KV table cannot be exported.
const skip = /^(_cf_KV|notes_fts)/;
const tables = JSON.parse(listing)[0].results.map(row => row.name).filter(name => !skip.test(name));
console.log(`${tables.length} exportable tables`);

step('Exporting structure');
const schemaPath = join(HERE, 'schema-full.sql');
wrangler(['export', DB, '--remote', '--no-data', ...tables.flatMap(t => ['--table', t]),
  '--output', schemaPath, '-y']);

step('Exporting inventory rows (no personal data)');
const dataPath = join(HERE, 'data.sql');
wrangler(['export', DB, '--remote', '--no-schema', ...DATA_TABLES.flatMap(t => ['--table', t]),
  '--output', dataPath, '-y']);

step('Re-ordering rows so foreign keys hold');
const byTable = {};
for (const line of readFileSync(dataPath, 'utf8').split('\n')) {
  const match = line.match(/^INSERT INTO "([a-zA-Z_]+)"/);
  if (match) (byTable[match[1]] ||= []).push(line);
}
const orderedPath = join(HERE, 'data-ordered.sql');
writeFileSync(orderedPath, ['PRAGMA defer_foreign_keys=TRUE;',
  ...DATA_TABLES.flatMap(t => byTable[t] ?? [])].join('\n') + '\n');
for (const table of DATA_TABLES) {
  console.log(`  ${table}: ${(byTable[table] ?? []).length} rows`);
}

step('Building the local database');
wrangler(['execute', DB, '--local', '--file', schemaPath, '-y']);
wrangler(['execute', DB, '--local', '--file', orderedPath, '-y']);

// The structure above is a copy of LIVE, which can sit behind the repo's own
// forward migrations: a column added here but not yet applied to production is
// missing from the dump, and every sandbox run fails on it. Apply the numbered
// migrations on top. 0000 is the squashed baseline (already in the dump), and a
// column the live schema already has reports "duplicate column name", which is
// the expected no-op rather than a failure.
step('Applying forward migrations the live schema has not caught up with');
const migrationsDir = join(HERE, '..', 'migrations');
for (const file of readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
  if (file.startsWith('0000_')) continue;
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--file', join(migrationsDir, file), '-y'],
      { cwd: join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`  ${file}: applied`);
  } catch (error) {
    const detail = String(error.stderr || error.message);
    if (/duplicate column name|already exists/i.test(detail)) console.log(`  ${file}: already in the live structure`);
    else throw error;
  }
}

step('Seeding the sandbox operator');
execFileSync('node', [join(HERE, 'seed-operator.mjs')], { stdio: 'inherit' });

console.log('\nSandbox rebuilt. Start it with `npm run sandbox` from the project root.');
