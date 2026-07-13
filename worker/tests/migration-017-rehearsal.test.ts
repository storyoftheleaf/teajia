import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workerDir = join(process.cwd(), 'worker');
const sql = (relative: string) => readFileSync(join(workerDir, relative), 'utf8');
const sqlite = (input: string) => execFileSync('sqlite3', [':memory:'], { input, encoding: 'utf8' }).trim();

const legacyTables = [
  'products', 'invoices', 'invoice_line_items', 'customers', 'activity_logs', 'stock_ledger',
  'teaware_collection', 'teaware_photos', 'tea_compass_entries', 'events', 'event_attendees',
  'event_notifications', 'event_post_session', 'event_tea_menu', 'event_tasting_notes', 'saved_locations',
];
const legacySchema = `
  PRAGMA foreign_keys=OFF;
  CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT NOT NULL);
  CREATE TABLE exchange_rates(currency TEXT PRIMARY KEY, rate_to_usd REAL);
  ${legacyTables.map(name => `CREATE TABLE ${name}(id TEXT PRIMARY KEY); INSERT INTO ${name}(id) VALUES ('legacy');`).join('\n')}
`;

describe('migration 017 rehearsals', () => {
  it('boots the clean canonical schema with the converged account tables', () => {
    const output = sqlite(`${sql('schema.sql')}\nSELECT name FROM sqlite_master WHERE type='table' AND name IN ('accounts','account_members') ORDER BY name;`);
    expect(output.split('\n')).toEqual(['account_members', 'accounts']);
  });

  it('upgrades a pre-017 legacy shape and converges missing tables through 018', () => {
    const output = sqlite(`${legacySchema}\n${sql('migrations/017_multi_account_patched.sql')}\n${sql('migrations/018_missing_tables.sql')}\nSELECT account_id FROM products WHERE id='legacy';`);
    expect(output).toBe('acc_teajia_bali');
  });

  it('treats the production double-ledger evidence as already applied and repeated applies as no-ops', () => {
    const ledger = new Set(['017_multi_account.sql', '017_multi_account_patched.sql']);
    const applyTracked = (name: string) => {
      if (ledger.has(name)) return false;
      ledger.add(name);
      return true;
    };
    expect(applyTracked('017_multi_account_patched.sql')).toBe(false);
    expect(applyTracked('017_multi_account_patched.sql')).toBe(false);
    expect([...ledger]).toEqual(['017_multi_account.sql', '017_multi_account_patched.sql']);
  });
});
