/**
 * The one thing a person cannot do in a test: wait for a table to end.
 * Moves a hosted table's start into the past in the local fixture database
 * only, with wrangler's own `d1 execute --local`, the way a clock running on
 * would. The table, its seats, its way in and its teas stay exactly as the
 * host and guests made them.
 *
 * Needs FEW_HOSTS_STATE: the directory the sandbox worker was started with
 * (`--persist-to`), the same as TEAJIA_OFFLINE_FIXTURES_STATE.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const worker = resolve(process.cwd(), 'worker');

export function endTheTable(slug: string, daysAgo = 2) {
  const state = process.env.FEW_HOSTS_STATE;
  if (!state || !existsSync(join(state, '.dev.vars'))) {
    throw new Error('Set FEW_HOSTS_STATE to the sandbox worker\'s --persist-to directory to end a table.');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Not a table slug: ${slug}`);
  const started = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const sql = `UPDATE events SET event_date = '${started}', event_end_date = NULL WHERE slug = '${slug}'`;
  const run = (sql: string) => execFileSync(join(worker, 'node_modules/.bin/wrangler'), [
    'd1', 'execute', 'teajia-offline-fixtures',
    '--config', join(worker, 'wrangler.offline-fixtures.toml'),
    '--persist-to', state, '--env-file', join(state, '.dev.vars'), '--local', '--json', '--command', sql,
  ], {
    cwd: worker,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' },
  });
  run(sql);
  // wrangler's local answer does not count changes, so read the row back.
  const out = run(`SELECT COUNT(*) AS ended FROM events WHERE slug = '${slug}' AND event_date = '${started}'`);
  const ended = JSON.parse(out.slice(out.indexOf('[')))[0]?.results?.[0]?.ended;
  if (ended !== 1) throw new Error(`Expected to end one table, found ${ended}.`);
}
