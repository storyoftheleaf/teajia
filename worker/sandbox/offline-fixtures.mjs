import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backup } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { seedFromMigrations } from '../tests/helpers/migratedSqlite.ts';
import { sandboxAccountIds, sandboxOperatorStatements, sandboxUserId } from './operator-fixture.mjs';
import { firstTableStatements } from './first-table-fixture.mjs';
import { fewHostsStatements } from './few-hosts-fixture.mjs';
import { launch5Statements } from './launch-5-fixture.mjs';
import { launch4Statements } from './launch-4-fixture.mjs';

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
// wrangler can print a proxy notice before its JSON; read from the JSON itself.
const parseD1 = (out) => JSON.parse(out.slice(out.indexOf('[')));
const query = (sql) => parseD1(runD1('--command', sql)).flatMap(({ results }) => results);

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
      // Launch 1's test table: one finished session, two guests, one paid order.
      ...firstTableStatements,
      // Launch 2's test host: ana / ana, approved, with one finished table in her private account.
      ...fewHostsStatements,
      // Launch 4's pieces: a tasting to share, one on the table, a recap, a tea master, a tea house, a place.
      ...launch4Statements,
      // Launch 5's journey: a host's credit, her own order to use it on, a session for the card.
      ...launch5Statements,
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
    // FIRST_TABLE_OPEN=true opens Launch 1 in this local shop only (src/lib/firstTable.ts).
    // FAVOURITES_OPEN=true opens Launch 4's favourites the same way (src/lib/favouritesOpen.ts).
    // FEW_HOSTS_OPEN=true opens Launch 2 the same way (src/lib/fewHosts.ts).
    // ANYONE_HOSTS_OPEN=true opens Launch 3 the same way (src/lib/anyoneHosts.ts).
    // CIRCLES_OPEN, HOST_TOKENS_OPEN and HOST_CREDIT_OPEN=true open Launch 5's three parts the same way.
    const flags = [
      ...(process.env.FIRST_TABLE_OPEN === 'true' ? ['--var', 'FIRST_TABLE_OPEN:true'] : []),
      ...(process.env.FEW_HOSTS_OPEN === 'true' ? ['--var', 'FEW_HOSTS_OPEN:true'] : []),
      ...(process.env.ANYONE_HOSTS_OPEN === 'true' ? ['--var', 'ANYONE_HOSTS_OPEN:true'] : []),
      ...(process.env.FAVOURITES_OPEN === 'true' ? ['--var', 'FAVOURITES_OPEN:true'] : []),
      // Launch 4's other switches, the same way (tests/launch-4.spec.ts).
      ...['TEA_TABLE_OPEN', 'YOUR_TABLE_PAGE_OPEN', 'HOST_ARTICLES_OPEN', 'TOP_TEAS_OPEN', 'TEA_HOUSES_OPEN', 'YOUR_TABLE_PLACE_OPEN']
        .flatMap(name => (process.env[name] === 'true' ? ['--var', `${name}:true`] : [])),
      ...['CIRCLES_OPEN', 'HOST_TOKENS_OPEN', 'HOST_CREDIT_OPEN', 'KNOW_THIS_TEA_OPEN']
        .flatMap(flag => (process.env[flag] === 'true' ? ['--var', `${flag}:true`] : [])),
      // Ports of its own, so a check can run beside another sandbox.
      ...(process.env.SANDBOX_PORT ? ['--port', process.env.SANDBOX_PORT] : []),
      ...(process.env.SANDBOX_INSPECTOR_PORT ? ['--inspector-port', process.env.SANDBOX_INSPECTOR_PORT] : []),
    ];
    // TEAJIA_OFFLINE_FIXTURES_PORT runs a second worker beside the usual 8787.
    const port = process.env.TEAJIA_OFFLINE_FIXTURES_PORT ? ['--port', process.env.TEAJIA_OFFLINE_FIXTURES_PORT] : [];
    const server = spawn(wrangler, ['dev', ...localOptions, ...port, ...flags], { cwd: worker, env, stdio: 'inherit' });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.on('exit', code => { process.exitCode = code ?? 1; });
  }
} catch (error) {
  console.error(error.stdout?.toString().trim() || error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}
