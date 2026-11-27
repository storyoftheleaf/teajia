/**
 * W5: empty, failing, slow and signed out, for every page the five launches added.
 * Run against the review rig (tests/review/README.md), slot 7 in the cloud:
 *   set -a; . test-results/review/slot-7.env; set +a
 *   npx playwright test -c tests/review/empty-and-failing.config.ts --trace off
 * Writes a screenshot per state to test-results/review/w5/ and one line per state to
 * test-results/review/w5/observations.jsonl. This slice alone mocks (per the brief).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';
import { test, stubBrowserServices } from '../fixtures';
import { call, login, signIn, task } from './helpers';

const OUT = join(process.cwd(), 'test-results', 'review', 'w5');
mkdirSync(OUT, { recursive: true });

type Who = 'guest' | 'host' | 'owner';
type State = 'empty' | 'error' | 'slow' | 'signed-out' | 'wrong-person';
type Spec = {
  id: string;
  path: string | (() => string);
  /** The main request, as a regex on the full URL. */
  main: RegExp;
  /** What "nothing at all" looks like on the wire. */
  empty: { status?: number; json: unknown };
  who: Who;
  /** The "wrong person" visit, where it exists: who signs in. */
  wrong?: Who;
};

const EMPTY_TABLE = { held: [], items: [], earlier: null };
let tableId = 'none';
let eventSlug = 'none';

const PAGES: Spec[] = [
  { id: 'favourites', path: '/account/favourites', main: /\/api\/me\/favourites$/, empty: { json: { articles: [], shop_teas: [], chest_teas: [] } }, who: 'guest' },
  { id: 'tea-table', path: '/tea-table', main: /\/api\/tea-table(\?.*)?$/, empty: { json: EMPTY_TABLE }, who: 'guest' },
  { id: 'tea-credit', path: '/account/tea-credit', main: /\/api\/me\/tea-credit(\?.*)?$/, empty: { json: { balances: [], lines: [], orders: [] } }, who: 'host', wrong: 'guest' },
  { id: 'tea-houses-visit', path: '/tea-houses/visit', main: /\/api\/network\/stores/, empty: { json: [] }, who: 'guest' },
  { id: 'tea-houses-work', path: '/tea-houses/work', main: /\/api\/tea-houses\/work$/, empty: { json: { houses: [] } }, who: 'guest' },
  { id: 'tea-houses-build', path: '/tea-houses/build', main: /\/api\/tea-houses\/build$/, empty: { json: { houses: [], parts: [] } }, who: 'guest' },
  { id: 'tea-house-page', path: '/tea-houses/work/no-such-house', main: /\/api\/tea-houses\/work\/[^/]+$/, empty: { status: 404, json: { error: 'Not found' } }, who: 'guest' },
  { id: 'home', path: '/', main: /\/api\/(tea-table(\?.*)?|tea-houses\/work)$/, empty: { json: { held: [], items: [], earlier: null, houses: [] } }, who: 'guest' },
  { id: 'host-a-table', path: '/account/host', main: /\/api\/me\/hosting$/, empty: { json: { approved: false, account_id: null, doors: null } }, who: 'host', wrong: 'guest' },
  { id: 'hosted-table', path: () => `/account/host/${tableId}`, main: /\/api\/me\/tables\/[^/]+$/, empty: { status: 404, json: { error: 'Not found' } }, who: 'host', wrong: 'guest' },
  { id: 'journey-hosted', path: '/account/journey', main: /\/api\/me\/journey$/, empty: { json: {} }, who: 'guest' },
  { id: 'after-sit', path: '/after-sit#' + 'a'.repeat(64), main: /\/api\/after-sit\/recap$/, empty: { status: 404, json: { error: 'Not found' } }, who: 'guest' },
  { id: 'journey', path: '/journey', main: /\/api\/journey/, empty: { json: {} }, who: 'guest' },
  { id: 'session-card', path: () => `/admin/events/${eventSlug}/card`, main: /\/api\/events\/[^/]+\/(public|tea-menu)|\/api\/events\/public\//, empty: { json: {} }, who: 'owner', wrong: 'guest' },
];

const width = (page: Page) => String(page.viewportSize()?.width ?? 0);

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const text = (document.querySelector('main') ?? document.body).innerText.replace(/\s+/g, ' ').trim();
    const buttons = [...document.querySelectorAll('main button, main a, [role=alert] button')]
      .map(e => (e as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 12);
    return { text: text.slice(0, 400), textLength: text.length, buttons, url: location.pathname + location.search };
  });
}

async function visit(page: Page, spec: Spec, state: State, who: Who) {
  let release: (() => void) | null = null;
  const handler = async (route: Route) => {
    if (state === 'empty') return route.fulfill({ status: spec.empty.status ?? 200, json: spec.empty.json });
    if (state === 'error') return route.fulfill({ status: 500, json: { error: 'Internal error: boom at worker/src/x.ts:12' } });
    await new Promise<void>(r => { release = r; setTimeout(r, 8000); });
    return route.continue().catch(() => {});
  };
  const mocked = state === 'empty' || state === 'error' || state === 'slow';
  if (mocked) await page.route(spec.main, handler);
  const path = typeof spec.path === 'string' ? spec.path : spec.path();
  const started = Date.now();
  await page.goto(path, { waitUntil: 'commit' }).catch(() => {});
  await page.waitForTimeout(1000);
  const atOneSecond = await snapshot(page);
  const shot = (name: string) => page.screenshot({ path: join(OUT, `${spec.id}-${state}-${name}-${width(page)}.png`) });
  if (state === 'slow') {
    await shot('1s');
    await page.waitForTimeout(8500);
  } else {
    await page.waitForTimeout(1500);
  }
  // Wait out the dev server's first compile of a page (the shell says "Loading Teajia"), up to 25s.
  for (let i = 0; i < 25; i++) {
    const now = await snapshot(page);
    if (now.textLength > 5 && !/Loading Teajia/.test(now.text)) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);
  const settled = await snapshot(page);
  await shot('settled');
  const row = {
    page: spec.id, state, who, width: width(page), ms: Date.now() - started,
    one_second: atOneSecond, settled,
    raw_error_text: /boom|worker\/src|TypeError|undefined|\[object|Failed to fetch|HTTP \d{3}|Internal error|\b500\b|NetworkError/i.test(settled.text),
    site_problem_banner: /site (problem|issue)|something went wrong on our side|we are fixing/i.test(settled.text),
    retry_offered: settled.buttons.some(b => /try again|retry|reload/i.test(b)),
  };
  appendFileSync(join(OUT, 'observations.jsonl'), JSON.stringify(row) + '\n');
  if (mocked) await page.unroute(spec.main, handler).catch(() => {});
  (release as (() => void) | null)?.();
}

test.describe('W5 empty, failing, slow, signed out', () => {
  test.skip(({ viewport }) => !viewport || ![390, 1280].includes(viewport.width), 'only 390 and 1280');
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const ana = await login(page, 'host');
    const owner = await login(page, 'owner');
    const mine = await call(page, ana, '/api/me/tables');
    tableId = mine.body?.tables?.[0]?.id ?? 'none';
    const events = await call(page, owner, '/api/admin/events');
    const list = Array.isArray(events.body) ? events.body : events.body?.events ?? [];
    eventSlug = list[0]?.slug ?? 'none';
    // Warm every page once, so the dev server's first compile is not read as a slow page.
    const warm = await browser.newPage();
    for (const spec of PAGES) {
      const path = typeof spec.path === 'string' ? spec.path : spec.path();
      await warm.goto(`${process.env.REVIEW_SITE}${path}`, { waitUntil: 'load' }).catch(() => {});
      await warm.waitForTimeout(2500);
    }
    await warm.close();
    await page.close();
  });

  for (const spec of PAGES) {
    for (const state of ['empty', 'error', 'slow', 'signed-out'] as const) {
      test(`${spec.id} ${state}`, async ({ page }) => {
        if (state === 'signed-out') await stubBrowserServices(page.context());
        else await signIn(page, spec.who);
        await task(page, `W5 ${spec.id} ${state}`, 2, () => visit(page, spec, state, spec.who));
      });
    }
    if (spec.wrong) {
      test(`${spec.id} wrong-person`, async ({ page }) => {
        await signIn(page, spec.wrong!);
        await task(page, `W5 ${spec.id} wrong-person`, 2, () => visit(page, spec, 'wrong-person', spec.wrong!));
      });
    }
  }
});
