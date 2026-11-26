/**
 * The two things a person cannot do in a browser during the Launch 3 journey
 * (tests/anyone-hosts.spec.ts), done against the local fixture database only,
 * with wrangler's own `d1 execute --local`:
 *
 *  - wait for a table to end: moves one hosted table's start into the past, the
 *    way a clock running on would. Its seats, guests, teas and way in stay as
 *    the host and guests made them.
 *  - Adrian's approval of a People profile: a person can write their profile
 *    draft, but only the shop publishes it (see "Begin a private draft"), so
 *    the one flag he would set is set here for one person.
 *
 * Needs ANYONE_HOSTS_STATE: the directory the sandbox worker was started with
 * (`--persist-to`), the same as TEAJIA_OFFLINE_FIXTURES_STATE.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const worker = resolve(process.cwd(), 'worker');

function stateDir() {
  const state = process.env.ANYONE_HOSTS_STATE;
  if (!state || !existsSync(join(state, '.dev.vars'))) {
    throw new Error('Set ANYONE_HOSTS_STATE to the sandbox worker\'s --persist-to directory.');
  }
  return state;
}

function run(sql: string): string {
  const state = stateDir();
  return execFileSync(join(worker, 'node_modules/.bin/wrangler'), [
    'd1', 'execute', 'teajia-offline-fixtures',
    '--config', join(worker, 'wrangler.offline-fixtures.toml'),
    '--persist-to', state, '--env-file', join(state, '.dev.vars'), '--local', '--json', '--command', sql,
  ], {
    cwd: worker,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' },
  });
}

function rows<T = Record<string, unknown>>(sql: string): T[] {
  const out = run(sql);
  return JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
}

const safe = (value: string, pattern: RegExp, what: string) => {
  if (!pattern.test(value)) throw new Error(`Not ${what}: ${value}`);
  return value;
};

/** The table has been, as of `daysAgo` days ago. */
export function endTheTable(slug: string, daysAgo = 2) {
  safe(slug, /^[a-z0-9-]+$/, 'a table slug');
  const started = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  run(`UPDATE events SET event_date = '${started}', event_end_date = NULL WHERE slug = '${slug}'`);
  // wrangler's local answer does not count changes, so read the row back.
  const [{ ended }] = rows<{ ended: number }>(`SELECT COUNT(*) AS ended FROM events WHERE slug = '${slug}' AND event_date = '${started}'`);
  if (ended !== 1) throw new Error(`Expected to end one table, found ${ended}.`);
}

/**
 * The shop that holds a person's People profile draft. The sandbox shops are not marked as the
 * platform's own, and a draft has nowhere to live until one is, so Bali is marked (idempotent).
 */
export function ensureEditorialSteward() {
  run(`UPDATE accounts SET is_platform_owner = 1 WHERE id = 'acc_teajia_bali'`);
  const [{ n }] = rows<{ n: number }>(`SELECT COUNT(*) AS n FROM accounts WHERE is_platform_owner = 1 AND status = 'active'`);
  if (n < 1) throw new Error('No shop could be marked as the platform\'s own.');
}

/** Adrian's publish of one person's People profile draft. Returns the profile's id. */
export function publishPeopleProfile(email: string): string {
  safe(email, /^[a-z0-9._+-]+@[a-z0-9.-]+$/i, 'an email');
  const [profile] = rows<{ id: string }>(
    `SELECT c.id FROM contributors c JOIN users u ON u.id = c.user_id WHERE lower(u.email) = lower('${email}')`);
  if (!profile) throw new Error(`No People profile draft for ${email}.`);
  run(`UPDATE contributors SET is_published = 1 WHERE id = '${profile.id}'`);
  const [{ published }] = rows<{ published: number }>(`SELECT COUNT(*) AS published FROM contributors WHERE id = '${profile.id}' AND is_published = 1`);
  if (published !== 1) throw new Error('The profile was not published.');
  return profile.id;
}
