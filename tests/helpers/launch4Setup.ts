/**
 * The Launch 4 journey (tests/launch-4.spec.ts) walks the same fixture pieces
 * at two sizes, so before each size it puts them back the way the fixture
 * made them (worker/sandbox/launch-4-fixture.mjs), against the local fixture
 * database only, with wrangler's own `d1 execute --local`. Nothing here stands
 * in for a person: every step of the journey is still done in the browser.
 *
 * Needs L4_STATE: the directory the sandbox workers were started with
 * (`--persist-to`), the same as TEAJIA_OFFLINE_FIXTURES_STATE.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const worker = resolve(process.cwd(), 'worker');

export function launch4State(): string | undefined {
  const state = process.env.L4_STATE;
  return state && existsSync(join(state, '.dev.vars')) ? state : undefined;
}

function run(sql: string): string {
  const state = launch4State();
  if (!state) throw new Error('Set L4_STATE to the sandbox workers\' --persist-to directory.');
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

/**
 * The Launch 4 fixture pieces, as the fixture made them. With L4_RUN set, once
 * per run and size: Playwright starts a fresh worker after a failed step, and
 * that worker must not undo what the steps before it did.
 */
export function resetLaunch4(once: string) {
  if (process.env.L4_RUN) {
    try { writeFileSync(join(launch4State() ?? '.', `.reset-${once}`), '', { flag: 'wx' }); } catch { return; }
  }
  run(`
    DELETE FROM member_tasting_shares WHERE journal_entry_id = 'l4-journal-mei';
    DELETE FROM family_hides WHERE target_id IN ('l4-journal-jun', 'l4-journal-mei');
    UPDATE member_tasting_shares SET share_state = 'page', tea_table_at = datetime('now', '-4 days'),
      tea_table_sittings = '["l4-sit-jun"]' WHERE journal_entry_id = 'l4-journal-jun';
    UPDATE events SET tea_table_at = NULL, tea_table_hidden_at = NULL WHERE id = 'l4-recap';
    DELETE FROM tea_table_holds;
    DELETE FROM tea_table_keeps;
    DELETE FROM favourite_articles;
    DELETE FROM tea_house_contributions;
    DELETE FROM tea_house_pages;
    UPDATE saved_locations SET is_host_table = 0, area_hint = NULL WHERE id = 'l4-place-ana';
    DELETE FROM contributor_top_teas;
  `);
}
