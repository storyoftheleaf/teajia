/**
 * Refuses to start the sandbox API against a database that has nothing in it.
 *
 * A fresh checkout or a new worktree has no local D1 state at all: wrangler
 * creates the file on first use and every table is absent. The API starts
 * perfectly happily against that and answers a wall of 500s, which reads like
 * broken application code rather than an empty disk. One query up front turns
 * a confusing afternoon into a one-line instruction.
 *
 * Run via: npm run sandbox  (from worker/, ahead of wrangler dev)
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), '..');
const REBUILD = 'npm run sandbox:refresh';

const rebuildFirst = (reason) => {
  console.error(`\nThe local sandbox database ${reason}.`);
  console.error(`Build it first:  ${REBUILD}\n`);
  console.error('It pulls the live structure and the product rows, and takes a couple of minutes.');
  console.error('Without it every admin request answers 500 with no useful message.\n');
  process.exit(1);
};

// A broken toolchain is not an empty database, and telling someone to rebuild
// when wrangler itself is the problem sends them down the wrong path.
const toolFailed = (detail) => {
  console.error('\nCould not read the local sandbox database. This is wrangler failing, not an');
  console.error(`empty database, so ${REBUILD} is unlikely to help until it is fixed:\n`);
  console.error(detail.trim().split('\n').slice(-8).join('\n'));
  console.error('');
  process.exit(1);
};

/** wrangler prefixes stdout with warnings, so the JSON does not start at byte 0. */
const ask = (sql) => {
  let out;
  try {
    out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'teajia-db', '--local', '--json', '--command', sql],
      { cwd: WORKER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return { error: String(error.stdout || '') + String(error.stderr || error.message) };
  }
  const start = out.indexOf('[');
  if (start === -1) return { error: out };
  try {
    return { row: JSON.parse(out.slice(start)).flatMap(r => r.results ?? [])[0] ?? {} };
  } catch {
    return { error: out };
  }
};

const counted = ask(
  "SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%') AS tables",
);
if (counted.error) toolFailed(counted.error);
const tables = Number(counted.row.tables ?? 0);
if (tables === 0) rebuildFirst('is empty');
if (tables < 50) rebuildFirst(`has only ${tables} tables, so it is half-built`);

// Tables without rows is the other half-built shape: the structure loaded and
// the copy step did not, which renders an admin screen that looks broken.
const stocked = ask('SELECT COUNT(*) AS c FROM products');
if (stocked.error) rebuildFirst('has no products table');
const products = Number(stocked.row.c ?? 0);
if (products === 0) rebuildFirst('has no products in it');

console.log(`Sandbox database ready: ${tables} tables, ${products} products.`);
