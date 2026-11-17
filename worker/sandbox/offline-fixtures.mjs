import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backup } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { seedFromMigrations } from '../tests/helpers/migratedSqlite.ts';
import { sandboxAccountIds, sandboxOperatorStatements, sandboxUserId } from './operator-fixture.mjs';

const worker = fileURLToPath(new URL('../', import.meta.url));
const config = join(worker, 'wrangler.offline-fixtures.toml');
const persistence = resolve(worker, process.env.TEAJIA_OFFLINE_FIXTURES_STATE || '.wrangler/offline-fixtures');
const envFile = join(persistence, '.dev.vars');
const wrangler = join(worker, 'node_modules/.bin/wrangler');
const localOptions = ['--config', config, '--persist-to', persistence, '--env-file', envFile, '--local'];
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true',
  CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
};

const runD1 = (...args) => execFileSync(wrangler, [
  'd1', 'execute', 'teajia-offline-fixtures', ...localOptions, '--json', ...args,
], { cwd: worker, env, encoding: 'utf8', stdio: 'pipe' });
const query = (sql) => JSON.parse(runD1('--command', sql)).flatMap(({ results }) => results);

async function prepare() {
  mkdirSync(persistence, { recursive: true });
  try {
    writeFileSync(envFile, `JWT_SECRET=${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  const [{ tables }] = query(`
    SELECT count(*) AS tables FROM sqlite_schema
    WHERE type = 'table' AND name NOT GLOB '_cf_*' AND name NOT GLOB 'sqlite_*'
  `);
  if (tables > 0) {
    const [operator] = query(`
      SELECT COUNT(*) AS memberships FROM account_members
      WHERE user_id = '${sandboxUserId}' AND status = 'active'
    `);
    if (operator.memberships !== sandboxAccountIds.length) {
      throw new Error(`Offline fixtures database at ${persistence} is already populated without the sandbox operator. Choose a fresh state directory.`);
    }
    console.log('Offline fixtures database already initialized.');
    return;
  }

  // The initial migration is a historical dump. The shared rehearsal skips
  // already-present columns before replaying the rest of the production ledger.
  const { db, applied } = seedFromMigrations();
  const temporary = mkdtempSync(join(tmpdir(), 'teajia-offline-fixtures-'));
  try {
    const sqlite = join(temporary, 'fixtures.sqlite');
    await backup(db, sqlite);
    const schema = execFileSync('sqlite3', [sqlite, '.dump'], { encoding: 'utf8' });
    // D1 enforces foreign keys. Add fixtures once all parent tables exist.
    const fixtures = [
      `INSERT INTO accounts (id, slug, name, status, public_enabled) VALUES
        ('${sandboxAccountIds[0]}', 'bali', 'Sandbox Bali', 'active', 0),
        ('${sandboxAccountIds[1]}', 'australia', 'Sandbox Australia', 'active', 0)`,
      `INSERT INTO exchange_rates (currency, rate_to_usd, last_updated)
        VALUES ('USD', 1, datetime('now')), ('Yuan', 7.1, datetime('now'))`,
      ...sandboxOperatorStatements,
    ];
    const dump = join(temporary, 'fixtures.sql');
    writeFileSync(dump, schema.replace(/COMMIT;\s*$/, `${fixtures.join(';\n')};\nCOMMIT;\n`));
    runD1('--file', dump);
    console.log(`Offline fixtures database initialized from ${applied.length} migration files.`);
  } finally {
    db.close();
    rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  await prepare();
  if (!process.argv.includes('--prepare-only')) {
    const server = spawn(wrangler, ['dev', ...localOptions], { cwd: worker, env, stdio: 'inherit' });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.on('exit', code => { process.exitCode = code ?? 1; });
  }
} catch (error) {
  console.error(error.stdout?.toString().trim() || error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}
