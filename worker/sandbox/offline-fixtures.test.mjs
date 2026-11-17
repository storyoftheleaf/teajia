import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('../', import.meta.url));

test('an empty offline fixtures database boots locally and a second boot preserves it', () => {
  const persistence = mkdtempSync(join(tmpdir(), 'teajia-offline-fixtures-test-'));
  const env = {
    ...process.env,
    TEAJIA_OFFLINE_FIXTURES_STATE: persistence,
    WRANGLER_SEND_METRICS: 'false',
  };
  const prepare = () => execFileSync('npm', ['run', 'sandbox:offline:fixtures', '--', '--prepare-only'], {
    cwd: worker, env, encoding: 'utf8', stdio: 'pipe',
  });
  const local = (sql) => JSON.parse(execFileSync(join(worker, 'node_modules/.bin/wrangler'), [
    'd1', 'execute', 'teajia-offline-fixtures', '--config', 'wrangler.offline-fixtures.toml',
    '--local', '--persist-to', persistence, '--json', '--command', sql,
  ], { cwd: worker, env, encoding: 'utf8', stdio: 'pipe' })).flatMap((entry) => entry.results);

  try {
    assert.match(prepare(), /Offline fixtures database initialized/);
    assert.deepEqual(local(`
      SELECT
        (SELECT count(*) FROM pragma_table_info('inquiries') WHERE name = 'converted_invoice_id') AS converted_columns,
        (SELECT count(*) FROM sqlite_schema WHERE name = 'logistics_shipment_lines') AS logistics_tables,
        (SELECT count(*) FROM account_members WHERE user_id = 'sandbox-operator' AND status = 'active') AS memberships,
        (SELECT count(*) FROM products) AS products
    `), [{ converted_columns: 1, logistics_tables: 1, memberships: 2, products: 0 }]);

    local("UPDATE accounts SET name = 'Edited fixture' WHERE id = 'acc_teajia_bali'");
    assert.match(prepare(), /Offline fixtures database already initialized/);
    assert.deepEqual(local("SELECT name FROM accounts WHERE id = 'acc_teajia_bali'"), [{ name: 'Edited fixture' }]);
  } finally {
    rmSync(persistence, { recursive: true, force: true });
  }
});
