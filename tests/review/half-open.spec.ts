/**
 * A10: the site and the worker disagree about a switch (todo/plans/review-prompts/astra-a10-open-then-close.md).
 *
 * Opening a switch is one commit, but Pages and the worker deploy separately,
 * so for some minutes one is open and the other closed. Start the rig with the
 * two sides disagreeing and walk every door the switches add:
 *
 *   node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --site-set all --worker-set live --slot 5
 *   node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --site-set live --worker-set all --slot 6
 *   set -a; . test-results/review/slot-5.env; set +a
 *   npx playwright test -c tests/review/review.config.ts half-open --trace off
 *
 * "all against live" opens every site door while every route it calls is
 * closed, which is each switch's worst case at once; "live against all" is the
 * other direction. For one switch alone use --site-set only:<SWITCH> --worker-set live.
 *
 * A quiet "not here yet", or the page simply not offering the door, passes.
 * A page error, a 5xx, a loader still turning after the page settles, an error
 * sentence, a blank page or the not-found page reached from a door the site
 * itself offers are recorded and soft-failed. Every door's result is written to
 * test-results/review/half-open.json for the findings file.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { SITE_SET, WORKER_SET, quiet, signIn, task, type Who } from './helpers';

type Door = { name: string; switches: string; who: Who | null; path: string; account?: string };

// Fixture ids: worker/sandbox/few-hosts-fixture.mjs, launch-4-fixture.mjs, launch-5-fixture.mjs, review-fixture.mjs.
const DOORS: Door[] = [
  { name: 'Home, signed out', switches: 'HOME_BAR, TEA_TABLE, TEA_HOUSES', who: null, path: '/' },
  { name: 'Home, the guest', switches: 'HOME_BAR, ANYONE_HOSTS', who: 'guest', path: '/' },
  { name: 'Host a table (host)', switches: 'FEW_HOSTS, YOUR_TABLE_PLACE, HOST_TOKENS, CIRCLES', who: 'host', path: '/account/host' },
  { name: 'Host a table (guest)', switches: 'FEW_HOSTS, ANYONE_HOSTS', who: 'guest', path: '/account/host' },
  { name: 'A hosted table, ahead (host)', switches: 'FEW_HOSTS, CIRCLES, ANYONE_HOSTS', who: 'host', path: '/account/host/fh-event-next' },
  { name: 'A hosted table, finished (host)', switches: 'FEW_HOSTS, ANYONE_HOSTS', who: 'host', path: '/account/host/fh-event' },
  { name: 'Session link of a hosted table', switches: 'FEW_HOSTS', who: null, path: '/event/fh-ana-table-test' },
  { name: 'Guest page, finished table', switches: 'FIRST_TABLE, ANYONE_HOSTS', who: null, path: '/m/fh-magic-rui' },
  { name: 'Guest page, on now', switches: 'FIRST_TABLE, TABLE_CARD', who: null, path: '/m/rv-magic-lin' },
  { name: 'After the sit (guest)', switches: 'ANYONE_HOSTS', who: 'guest', path: '/after-sit' },
  { name: 'Favourites (guest)', switches: 'FAVOURITES', who: 'guest', path: '/account/favourites' },
  { name: 'Tea chest (guest)', switches: 'FAVOURITES', who: 'guest', path: '/account/cellar' },
  { name: 'Your Table page (guest)', switches: 'YOUR_TABLE_PAGE', who: 'guest', path: '/account' },
  { name: 'Your Table sessions (guest)', switches: 'YOUR_TABLE_PAGE', who: 'guest', path: '/account/sessions' },
  { name: 'Journal (guest)', switches: 'TEA_TABLE, YOUR_TABLE_PAGE', who: 'guest', path: '/account/journal' },
  { name: 'Tea credit (host)', switches: 'HOST_CREDIT', who: 'host', path: '/account/tea-credit' },
  { name: 'Profile (host)', switches: 'HOST_ARTICLES', who: 'host', path: '/account/profile' },
  { name: 'The Tea Table, signed out', switches: 'TEA_TABLE, KNOW_THIS_TEA', who: null, path: '/tea-table' },
  { name: 'The Tea Table (guest)', switches: 'TEA_TABLE, KNOW_THIS_TEA, FAVOURITES', who: 'guest', path: '/tea-table' },
  { name: 'A person page (Jun)', switches: 'TOP_TEAS, TEA_TABLE', who: null, path: '/people/l4-jun' },
  { name: 'Jun on his own page', switches: 'TOP_TEAS', who: 'jun', path: '/people/l4-jun' },
  { name: 'A published recap', switches: 'TEA_TABLE', who: null, path: '/event/l4-autumn-oolongs/recap' },
  { name: 'Tea Houses', switches: 'TEA_HOUSES', who: null, path: '/tea-houses' },
  { name: 'Tea Houses, work', switches: 'TEA_HOUSES', who: null, path: '/tea-houses/work' },
  { name: 'Tea Houses, a house', switches: 'TEA_HOUSES', who: null, path: '/tea-houses/work/l4-garden-house' },
  { name: 'Tea Houses, build', switches: 'TEA_HOUSES', who: null, path: '/tea-houses/build' },
  { name: 'Tea Houses, visit', switches: 'TEA_HOUSES', who: null, path: '/tea-houses/visit' },
  { name: 'Manage, platform (owner)', switches: 'FEW_HOSTS, ANYONE_HOSTS', who: 'owner', path: '/admin/platform' },
  { name: 'Manage, settings (owner)', switches: 'HOST_CREDIT, TEA_HOUSES', who: 'owner', path: '/admin/account-settings' },
  { name: 'Manage, activity (owner)', switches: 'HOST_CREDIT', who: 'owner', path: '/admin/activity' },
  { name: 'Manage, guest notes (owner)', switches: 'TEA_TABLE, KNOW_THIS_TEA, ANYONE_HOSTS', who: 'owner', path: '/admin/tasting-notes' },
  { name: 'Manage, magazine (owner)', switches: 'HOST_ARTICLES', who: 'owner', path: '/admin/magazine' },
  { name: 'Manage, a session (owner)', switches: 'TABLE_CARD, ANYONE_HOSTS', who: 'owner', path: '/admin/events/l5-card-event' },
  { name: 'Manage, the card for a table (owner)', switches: 'TABLE_CARD', who: 'owner', path: '/admin/events/l5-card-test/card' },
];

// The site's own ways of saying a read failed, as seen on the rig ("Could not open the Tea Table.",
// "Your tea credit could not be read just now.", "This table was not found.").
const ERROR_WORDS = /something went wrong|could not|couldn['’]t|failed to load|try again later|unexpected error|error loading|was not found|not found\./i;

type Seen = {
  door: string; switches: string; path: string; site_set: string; worker_set: string; project: string;
  final_path: string; not_found_page: boolean; loader_left: boolean; blank: boolean; error_words: string | null;
  page_errors: string[]; closed_calls: string[]; heading: string | null;
};

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

test.describe(`half-open: site ${SITE_SET}, worker ${WORKER_SET}`, () => {
  for (const door of DOORS) {
    test(door.name, async ({ page }, info) => {
      const watch = quiet(page);
      const closed: string[] = [];
      page.on('response', r => {
        const url = new URL(r.url());
        if (url.pathname.startsWith('/api/') && r.status() === 404) closed.push(`${r.request().method()} ${url.pathname}`);
      });
      if (door.who) await signIn(page, door.who, door.account ? { account: door.account } : {});
      else await page.context().addInitScript(() => undefined);
      await task(page, `half-open: ${door.name}`, 0, async () => { await page.goto(door.path); await settle(page); }, info);

      const finalPath = new URL(page.url()).pathname;
      const notFound = await page.getByText('Page not found', { exact: true }).isVisible().catch(() => false);
      // EmblemLoader (src/components/shared/EmblemLoader.tsx): the emblem alone, with no words beside it.
      // Manage keeps an idle emblem in its layout, so there this check reads every page as loading; it is
      // left to the screenshot there.
      const loaderLeft = door.path.startsWith('/admin') ? false : await page.locator('[class*="min-h-[45vh]"]:has(svg)').evaluateAll(
        nodes => nodes.some(n => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).innerText.trim()),
      ).catch(() => false);
      const text = (await page.locator('main').first().innerText().catch(() => '')) || (await page.locator('body').innerText());
      const errorMatch = text.match(ERROR_WORDS)?.[0] ?? null;
      const heading = await page.locator('h1').first().innerText({ timeout: 1000 }).catch(() => null);
      const seen: Seen = {
        door: door.name, switches: door.switches, path: door.path, site_set: SITE_SET, worker_set: WORKER_SET,
        project: info.project.name, final_path: finalPath, not_found_page: notFound, loader_left: loaderLeft,
        blank: text.trim().length < 20, error_words: errorMatch, page_errors: watch.problems, closed_calls: [...new Set(closed)], heading,
      };
      const dir = join(process.cwd(), 'test-results', 'review');
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, 'half-open.json'), JSON.stringify(seen) + '\n');
      await page.screenshot({ path: join(dir, 'half-open', `${SITE_SET}-vs-${WORKER_SET}`.replace(/[:]/g, '_'), `${info.project.name}-${door.name.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => undefined);

      watch.check(door.name);
      expect.soft(loaderLeft, `${door.name}: a loader is still turning`).toBe(false);
      expect.soft(errorMatch, `${door.name}: an error sentence`).toBeNull();
      expect.soft(seen.blank, `${door.name}: a blank page`).toBe(false);
    });
  }
});

// The doors the switches add, walked from where a person starts, with the taps
// counted (tests/review/helpers.ts task). With the site's switch closed the door
// must not be offered at all; with it open the walk is recorded against the
// two-tap budget in test-results/review/steps.json.
test.describe(`the doors, walked: site ${SITE_SET}, worker ${WORKER_SET}`, () => {
  const siteOpen = (name: string) => SITE_SET === 'all' || SITE_SET.includes(name);
  const workerOpen = (name: string) => WORKER_SET === 'all' || WORKER_SET.includes(name);

  test('host: from Home to connecting an assistant (HOST_TOKENS)', async ({ page }, info) => {
    await signIn(page, 'host');
    await page.goto('/');
    await settle(page);
    const door = page.getByRole('link', { name: /Host a table/ }).first();
    if (!siteOpen('HOST_TOKENS') || !(await door.waitFor({ timeout: 8000 }).then(() => true, () => false))) {
      await page.goto('/account/host');
      await settle(page);
      await expect(page.getByRole('button', { name: 'Connect an assistant' })).toHaveCount(0);
      return;
    }
    await task(page, 'A10 host: Home to a new assistant key', 3, async () => {
      await door.click();
      await page.getByRole('button', { name: 'Connect an assistant' }).click();
      await settle(page);
    }, info);
  });

  test('owner: from Manage to the Tea Table pieces (TEA_TABLE)', async ({ page }, info) => {
    await signIn(page, 'owner');
    await page.goto('/admin/dashboard');
    await settle(page);
    // The section shows only when both sides are open: with the worker still
    // closed its list answers 404 and the section stays quiet (A10-3).
    if (!siteOpen('TEA_TABLE') || !workerOpen('TEA_TABLE')) {
      await page.goto('/admin/tasting-notes');
      await settle(page);
      await expect(page.getByRole('heading', { name: 'The Tea Table' })).toHaveCount(0);
      return;
    }
    await task(page, 'A10 owner: Manage to the Tea Table pieces', 2, async () => {
      const publish = page.getByRole('link', { name: 'Publish', exact: true }).or(page.getByRole('button', { name: 'Publish', exact: true })).first();
      if (await publish.isVisible().catch(() => false)) {
        // Desktop: the Publish room, then its Guest notes tab.
        await publish.click();
        await settle(page);
        await page.getByRole('link', { name: 'Guest notes' }).or(page.getByRole('button', { name: 'Guest notes' })).first().click();
      } else {
        // Phone: the bar's Menu lists the Manage rooms, and a room's own tabs
        // (Guest notes is one of Publish's) only once that room is open. So:
        // Menu, publish, Menu again, guest notes.
        const menu = page.getByRole('button', { name: 'Menu', exact: true }).first();
        await menu.click();
        await page.locator('a[href="/admin/magazine"]:visible').first().click();
        await settle(page);
        await menu.click();
        await page.waitForTimeout(500);
        await page.locator('a[href="/admin/tasting-notes"]:visible').first().click();
      }
      await settle(page);
      await page.getByText('The Tea Table', { exact: true }).first().scrollIntoViewIfNeeded();
    }, info);
  });
});
