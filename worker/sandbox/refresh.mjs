/**
 * Rebuilds the LOCAL sandbox database from the live one.
 *
 * What it copies: the full table structure INCLUDING indexes and triggers, and
 * the rows an inventory or shop screen needs to look real (products, listings,
 * tea profiles, accounts, collections, batches, exchange rates).
 *
 * What it deliberately does NOT copy: users, customers, invoices, orders,
 * tasting journals, notes, tokens. Nobody's personal details land on this disk,
 * and the sandbox does not need them to render a product grid.
 *
 * Run via: npm run sandbox:refresh  (from worker/)
 *
 * Four notes on the mechanics, all learned the hard way:
 *  - The live database has full-text search tables, and the export endpoint
 *    refuses to touch a database containing them. So the table list is fetched
 *    first and those are filtered out by name.
 *  - Rows arrive grouped by table in whatever order the export chose, which
 *    breaks foreign keys on load. They are re-ordered parents-first below.
 *  - `wrangler d1 export` emits CREATE TABLE and nothing else. Live's 253
 *    indexes and 15 triggers are absent from the dump, so they are read back
 *    out of live's sqlite_master and replayed separately. This is not a
 *    performance nicety: an upsert whose ON CONFLICT target is a UNIQUE INDEX
 *    fails outright without it, and the triggers that maintain
 *    contact_relationships silently do nothing.
 *  - A migration file is applied one statement at a time. Handed the whole
 *    file, a first statement that duplicates a live column aborts the rest,
 *    and the columns those later statements would have added go missing with
 *    no error anyone sees.
 *
 * The last step verifies the result against live and exits non-zero on any
 * difference, so "the sandbox is faithful" is a measurement rather than a hope.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

/** Full-text search tables and the internal KV table cannot be exported. */
const SKIP = /^(_cf_KV|notes_fts)/;

const wrangler = (args, capture = false) => execFileSync(
  'npx',
  ['wrangler', 'd1', ...args],
  { cwd: join(HERE, '..'), encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'ignore'] : 'inherit' },
);

/**
 * Runs read-only SQL and returns its rows. Several statements may be passed at
 * once separated by semicolons; every result set is flattened into one list,
 * which is how the column check below reads 122 tables without paying 122
 * round trips to the remote API.
 */
const query = (sql, where) => {
  // wrangler prefixes stdout with warnings under some shells (a proxy variable
  // being set is enough), so the JSON does not start at the first byte and a
  // plain JSON.parse dies on "Unexpected token 'P'". Start at the array.
  const out = wrangler(['execute', DB, where, '--json', '--command', sql], true);
  const start = out.indexOf('[');
  if (start === -1) throw new Error(`no JSON in wrangler output:\n${out.slice(0, 400)}`);
  return JSON.parse(out.slice(start)).flatMap(result => result.results ?? []);
};

const step = (message) => console.log(`\n── ${message}`);

/**
 * Splits a migration file into individual statements. Semicolons inside string
 * literals and line comments do not end a statement. No migration in this repo
 * defines a trigger, so BEGIN...END bodies are not a case this has to handle;
 * live's triggers are replayed one per command instead.
 */
const splitStatements = (sql) => {
  const statements = [];
  let cur = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      cur += '\n';
      continue;
    }
    if (c === "'") {
      cur += c;
      i++;
      while (i < sql.length) {
        cur += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { cur += sql[++i]; i++; continue; }
          break;
        }
        i++;
      }
      continue;
    }
    if (c === ';') { statements.push(cur); cur = ''; continue; }
    cur += c;
  }
  statements.push(cur);
  return statements.map(s => s.trim()).filter(Boolean);
};

/** True when an error only means "live already had this". */
const isAlreadyPresent = (detail) => /duplicate column name|already exists/i.test(detail);

mkdirSync(HERE, { recursive: true });

step('Listing live tables');
const tables = query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  '--remote',
).map(row => row.name).filter(name => !SKIP.test(name));
console.log(`${tables.length} exportable tables`);

step('Exporting structure');
const schemaPath = join(HERE, 'schema-full.sql');
// No -y here: `d1 export` has no such flag and the pinned wrangler rejects it
// outright. Only `d1 execute` prompts, so only `d1 execute` gets it.
wrangler(['export', DB, '--remote', '--no-data', ...tables.flatMap(t => ['--table', t]),
  '--output', schemaPath]);

step('Exporting inventory rows (no personal data)');
const dataPath = join(HERE, 'data.sql');
wrangler(['export', DB, '--remote', '--no-schema', ...DATA_TABLES.flatMap(t => ['--table', t]),
  '--output', dataPath]);

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

// A rebuild has to start from nothing. The dump is plain CREATE TABLE, so a
// second run against a database that already has the tables dies on "table
// products already exists" and leaves a half-updated copy behind. The local
// state is a disposable cache of live — throwing it away IS the rebuild.
step('Clearing the old local database');
const localState = join(HERE, '..', '.wrangler', 'state', 'v3', 'd1');
rmSync(localState, { recursive: true, force: true });
console.log(`  removed ${localState}`);

step('Building the local database');
wrangler(['execute', DB, '--local', '--file', schemaPath, '-y']);
wrangler(['execute', DB, '--local', '--file', orderedPath, '-y']);

// The structure above is a copy of LIVE, which can sit behind the repo's own
// forward migrations: a column added here but not yet applied to production is
// missing from the dump, and every sandbox run fails on it. Apply the numbered
// migrations on top. 0000 is the squashed baseline (already in the dump), and a
// column the live schema already has reports "duplicate column name", which is
// the expected no-op rather than a failure.
//
// Statement by statement, deliberately. A file handed to wrangler whole stops
// at its first duplicate column, and the columns its remaining statements would
// have added are then missing from the sandbox with nothing in the output to
// say so — which is exactly how a sandbox stops being faithful without anyone
// noticing.
step('Applying forward migrations the live schema has not caught up with');
const migrationsDir = join(HERE, '..', 'migrations');
for (const file of readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
  if (file.startsWith('0000_')) continue;
  const statements = splitStatements(readFileSync(join(migrationsDir, file), 'utf8'));
  let applied = 0;
  let skipped = 0;
  for (const statement of statements) {
    try {
      execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--command', statement, '-y'],
        { cwd: join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
      applied++;
    } catch (error) {
      const detail = String(error.stderr || error.message);
      if (isAlreadyPresent(detail)) skipped++;
      else throw new Error(`${file}: ${statement.slice(0, 80)}…\n${detail}`);
    }
  }
  console.log(`  ${file}: ${applied} applied, ${skipped} already in the live structure`);
}

// `wrangler d1 export` writes CREATE TABLE and stops there. Everything that
// hangs off a table — its indexes, its triggers — has to be fetched separately
// or the sandbox quietly behaves differently from live under write load.
step('Copying indexes and triggers');
const objects = query(
  "SELECT type, name, tbl_name, sql FROM sqlite_master " +
  "WHERE type IN ('index','trigger') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
  '--remote',
).filter(row => !SKIP.test(row.name) && !SKIP.test(row.tbl_name));

// IF NOT EXISTS, because a forward migration above may already have created the
// same index, and because the script has to stay re-runnable.
const idempotent = (sql) => sql.replace(
  /^\s*CREATE\s+(UNIQUE\s+)?(INDEX|TRIGGER)\s+(?!IF\s+NOT\s+EXISTS)/i,
  (_, unique, kind) => `CREATE ${unique ?? ''}${kind} IF NOT EXISTS `,
);

const indexes = objects.filter(o => o.type === 'index');
const indexPath = join(HERE, 'indexes.sql');
writeFileSync(indexPath, indexes.map(o => `${idempotent(o.sql)};`).join('\n') + '\n');
wrangler(['execute', DB, '--local', '--file', indexPath, '-y']);

// Triggers carry BEGIN...END bodies, which the file executor splits on the
// inner semicolons. One command per trigger keeps each body intact.
const triggers = objects.filter(o => o.type === 'trigger');
for (const trigger of triggers) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--command', idempotent(trigger.sql), '-y'],
    { cwd: join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
}
console.log(`  ${indexes.length} indexes, ${triggers.length} triggers`);

step('Seeding the sandbox operator');
execFileSync('node', [join(HERE, 'seed-operator.mjs')], { stdio: 'inherit' });

// The point of the sandbox is that an agent can trust what it sees here. That
// is worth proving on every rebuild rather than assuming: a schema that drifts
// from live turns every verification run into a false negative, and the failure
// arrives later as an unexplained 500 rather than as a message about schemas.
step('Verifying the copy matches live');
// Columns are read with one literal pragma per table, batched as separate
// statements in a single command. Two forms that look simpler both fail:
// sqlite_master joined to pragma_table_info(m.name) is refused remotely with
// SQLITE_AUTH, because the authorizer will not take a pragma argument it
// cannot see as a constant; and UNION ALL across every table is refused with
// "too many terms in compound SELECT". Separate statements have neither limit,
// and each row carries its own table name so the result sets can be flattened.
const NAME = /^[A-Za-z0-9_]+$/;
const columnsOf = (where) => {
  const map = {};
  const wanted = tables.filter(name => NAME.test(name));
  for (let i = 0; i < wanted.length; i += 40) {
    const sql = wanted.slice(i, i + 40)
      .map(name => `SELECT '${name}' AS tbl, name AS col FROM pragma_table_info('${name}');`)
      .join(' ');
    for (const row of query(sql, where)) (map[row.tbl] ??= new Set()).add(row.col);
  }
  return map;
};

const OBJECTS = "SELECT type, name, tbl_name FROM sqlite_master WHERE type IN ('index','trigger') " +
  "AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name";
const namesOf = (where) => new Set(
  query(OBJECTS, where)
    .filter(r => !SKIP.test(r.name) && !SKIP.test(r.tbl_name))
    .map(r => `${r.type} ${r.name}`),
);

const liveColumns = columnsOf('--remote');
const localColumns = columnsOf('--local');
const liveObjects = namesOf('--remote');
const localObjects = namesOf('--local');

const problems = [];
for (const table of Object.keys(liveColumns).sort()) {
  if (!localColumns[table]) { problems.push(`missing table   ${table}`); continue; }
  const missing = [...liveColumns[table]].filter(col => !localColumns[table].has(col));
  if (missing.length) problems.push(`missing columns ${table}: ${missing.join(', ')}`);
}
for (const object of [...liveObjects].sort()) {
  if (!localObjects.has(object)) problems.push(`missing ${object}`);
}

if (problems.length) {
  console.error(`\n${problems.length} difference(s) from live:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nThe sandbox is NOT a faithful copy. Endpoints will fail here that work live.');
  process.exit(1);
}
const columnCount = Object.values(liveColumns).reduce((n, set) => n + set.size, 0);
console.log(`  ${Object.keys(liveColumns).length} tables, ${columnCount} columns, ` +
  `${liveObjects.size} indexes and triggers: all present`);

console.log('\nSandbox rebuilt. Start it with `npm run sandbox` from the project root.');
