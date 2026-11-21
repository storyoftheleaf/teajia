/**
 * Brings the LOCAL practice database up to this checkout's migrations.
 *
 * Local only. It opens the miniflare SQLite file under worker/.wrangler/state
 * and never touches Cloudflare, the live database, or any network. Run it with
 * the API stopped.
 *
 * How: every numbered migration (0000 is the squashed baseline, skipped) is
 * applied one statement at a time, in filename order, the same way
 * refresh.mjs and the Worker tests do. A statement that only says "duplicate
 * column name" or "already exists" is skipped: the local copy was built from
 * live's structure, which already carries many of them. Anything else fails
 * loudly. Each file that finishes is noted in a small table
 * (practice_migrations_applied) so a second run does nothing.
 *
 * Run via: npm run practice:migrate  (from worker/)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { migrationFiles, MIGRATIONS_DIR, splitStatements } from '../tests/helpers/migratedSqlite.ts';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), '..');
const D1_DIR = join(WORKER, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

const candidates = readdirSync(D1_DIR)
  .filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
  .map((name) => join(D1_DIR, name));
if (candidates.length !== 1) {
  console.error(`Expected one local database in ${D1_DIR}, found ${candidates.length}.`);
  console.error('Build it first:  npm run sandbox:refresh   (reads live, read-only)');
  process.exit(1);
}
const file = candidates[0];
if (statSync(file).size < 100_000) {
  console.error('The local database looks empty. Build it first:  npm run sandbox:refresh');
  process.exit(1);
}

const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys = OFF');
db.exec('CREATE TABLE IF NOT EXISTS practice_migrations_applied (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const done = new Set(db.prepare('SELECT name FROM practice_migrations_applied').all().map((row) => row.name));

let ran = 0;
for (const name of migrationFiles(MIGRATIONS_DIR)) {
  if (name.startsWith('0000_') || done.has(name)) continue;
  let applied = 0;
  let skipped = 0;
  for (const statement of splitStatements(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))) {
    try {
      db.exec(statement);
      applied += 1;
    } catch (error) {
      const message = String(error.message ?? error);
      if (/duplicate column name|already exists/i.test(message)) { skipped += 1; continue; }
      console.error(`${name}: ${message}\n${statement.slice(0, 300)}`);
      process.exit(1);
    }
  }
  db.prepare('INSERT INTO practice_migrations_applied (name) VALUES (?)').run(name);
  console.log(`  ${name}: ${applied} applied, ${skipped} already present`);
  ran += 1;
}
console.log(ran ? `Practice database brought up to date (${ran} files).` : 'Practice database already up to date.');
db.close();
