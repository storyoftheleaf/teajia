import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./sql-schema-audit.mjs', import.meta.url));
const schema = `CREATE TABLE customers(id TEXT PRIMARY KEY, account_id TEXT, name TEXT);
CREATE TABLE attachments(id TEXT, account_id TEXT, customer_id TEXT);`;
function audit(source) {
  const dir = mkdtempSync(join(tmpdir(), 'teajia-sql-audit-'));
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'schema.sql'), schema);
    writeFileSync(join(dir, 'src', 'fixture.ts'), source);
    const run = spawnSync(process.execPath, ['--experimental-sqlite', script, '--worker-dir', dir], { encoding: 'utf8' });
    assert.equal(run.signal, null, run.stderr);
    return { code: run.status, output: run.stdout + run.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('valid complete statements are verified without executing writes', () => {
  const result = audit(`db.prepare('SELECT id, account_id FROM customers');
    db.prepare("UPDATE customers SET name = ? WHERE id = ? AND account_id = ?");`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /2 complete statements prepared/);
  assert.match(result.output, /0 unresolved/);
});

test('actual complete statements with missing columns or tables still fail', () => {
  for (const sql of ['SELECT absent FROM customers', 'SELECT id FROM absent', 'UPDATE customers SET absent = ? WHERE id = ?', 'INSERT INTO customers (absent) VALUES (?)']) {
    const result = audit(`db.prepare(${JSON.stringify(sql)});`);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /fixture.ts:1/);
    assert.match(result.output, /no such (column|table)|has no column named/);
  }
});

test('correlated vendor fragments are unresolved while the complete outer query is checked', () => {
  const result = audit(`const fragments = { attachments: \`SELECT 1 FROM attachments r
    WHERE r.account_id = customers.account_id AND r.customer_id = customers.id\` };
    db.prepare(\`SELECT (SELECT COUNT(*) FROM (SELECT 1 FROM attachments r
      WHERE r.account_id = customers.account_id AND r.customer_id = customers.id)) AS n
      FROM customers WHERE id = ? AND account_id = ?\`);`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /1 complete statements prepared/);
  assert.match(result.output, /1 unresolved/);
  assert.match(result.output, /fixture.ts:1.*not a complete database call/);
  assert.doesNotMatch(result.output, /fault\(s\)/);
});

test('SQLite checks recursive CTE roots and family with column lists', () => {
  const result = audit(`db.prepare(\`WITH RECURSIVE roots(id) AS (SELECT id FROM customers),
    family(id) AS (SELECT id FROM roots UNION SELECT c.id FROM customers c JOIN family f ON c.id=f.id)
    SELECT id FROM family\`);`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /1 complete statements prepared/);
});

test('dynamic CTE and UPSERT SET cannot invent missing tables and remain explicitly unverified', () => {
  const result = audit('db.prepare(`WITH RECURSIVE roots(id) AS (${rootSql}), family(id) AS (SELECT id FROM roots) SELECT id FROM family`);\n'
    + 'db.prepare(`INSERT INTO customers (${columns}) VALUES (?) ON CONFLICT(id) DO UPDATE SET ${updates} WHERE customers.account_id = excluded.account_id`);');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /0 complete statements prepared/);
  assert.match(result.output, /2 unresolved/);
  assert.match(result.output, /fixture.ts:1.*runtime SQL/);
  assert.match(result.output, /fixture.ts:2.*runtime SQL/);
  assert.doesNotMatch(result.output, /no such table: (SET|roots|family)/);
  assert.doesNotMatch(result.output, /No query asks/);
});

test('unresolved identifiers and runtime concatenation retain their source sites', () => {
  const result = audit(`db.prepare(externalSql);
    db.prepare('SELECT ' + fields + ' FROM customers');`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /unresolved/);
  assert.match(result.output, /fixture.ts:1/);
  assert.match(result.output, /fixture.ts:2/);
  assert.doesNotMatch(result.output, /No query asks/);
});

test('static const SQL follows lexical bindings and still rejects an actual bad column', () => {
  const invalid = audit(`const sql = 'SELECT absent FROM customers'; db.prepare(sql);`);
  assert.equal(invalid.code, 1, invalid.output);
  assert.match(invalid.output, /no such column: absent/);
  const shadowed = audit(`const sql = 'SELECT absent FROM customers';
    function query(sql: string) { return db.prepare(sql); }`);
  assert.equal(shadowed.code, 0, shadowed.output);
  assert.match(shadowed.output, /runtime SQL/);
});

test('a complete database call with invalid syntax is a real preparation fault', () => {
  for (const sql of ['SELECT', 'SELECT FROM customers']) {
    const result = audit(`db.prepare(${JSON.stringify(sql)});`);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /incomplete input|syntax error/);
  }
});

test('statically assembled correlated SQL is resolved and prepared in its outer context', () => {
  const result = audit('const fragment = `SELECT 1 FROM attachments r WHERE r.account_id = customers.account_id AND r.customer_id = customers.id`;\n'
    + 'const sql = `SELECT (SELECT COUNT(*) FROM (${fragment})) AS n FROM customers WHERE account_id = ?`;\n'
    + 'db.prepare(sql);');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /1 complete statements prepared/);
  assert.match(result.output, /0 unresolved/);
});
