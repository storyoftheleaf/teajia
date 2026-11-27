import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// The Tea Table (Launch 4, K1 and K2; todo/plans/tea-table.md), with mocked
// routes, at 390 by 844 and on a desktop. The Tea Table is closed until Adrian
// ships Launch 4: with VITE_TEA_TABLE_OPEN=true on the site these walk the open
// page, and without it they prove the address leads home.

const open = process.env.VITE_TEA_TABLE_OPEN === 'true';

function fakeJWT(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}
const token = fakeJWT({ sub: 'mei', email: 'mei@example.test', name: 'Mei', role: 'member', exp: Math.floor(Date.now() / 1000) + 86_400 });

const TASTING = {
  kind: 'tasting', id: 'journal-1', at: '2026-11-25 09:00:00',
  person: { name: 'Mei', path: '/people/mei' },
  tea: { name: 'Old Tree Red', chinese_name: null, path: '/shop/product/old-tree-red?store=teajia-bali', type: 'Red' },
  words: [{ date: '2026-11-24T08:00:00Z', text: 'Honey on the lid, and a long dry finish.' }],
  photographs: [],
};
const RECAP = {
  kind: 'recap', id: 'event-1', at: '2026-11-24 18:00:00', slug: 'autumn-sit', title: 'Autumn sit',
  session_date: '2026-11-20T18:00:00Z', host: 'Teajia Bali', writing: 'We poured three oolongs by the window.',
  teas: ['Dancong', 'Tieguanyin'], tea_type: 'Oolong',
};
const HELD = { ...RECAP, id: 'event-held', slug: 'held-sit', title: 'The long table', at: '2026-11-10 18:00:00' };
const EARLIER = { ...TASTING, id: 'journal-old', at: '2026-10-02 09:00:00', tea: { ...TASTING.tea, name: 'Spring Dancong' }, words: [{ date: null, text: 'Bright and floral.' }] };

type State = { kept: string[]; mine: string[]; requests: string[]; held: boolean; tookOff: string[] };

async function prepare(page: Page, state: State, { signedIn = false, width = 390, height = 844 } = {}) {
  await page.setViewportSize({ width, height });
  if (signedIn) await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();
    if (pathname === '/api/tea-table') {
      state.requests.push(url.search);
      const before = url.searchParams.get('before');
      const show = url.searchParams.get('show') ?? 'all';
      const pick = (items: any[]) => items.filter(item => !state.tookOff.includes(item.id))
        .filter(item => show === 'all' || (show === 'tastings' ? item.kind === 'tasting' : item.kind === 'recap'));
      if (before) return route.fulfill({ json: { held: [], items: pick([EARLIER]), earlier: null } });
      return route.fulfill({ json: { held: state.held ? pick([HELD]) : [], items: pick([TASTING, RECAP]), earlier: RECAP.at } });
    }
    if (pathname === '/api/tea-table/me') {
      const all = [TASTING, RECAP, HELD, EARLIER];
      return route.fulfill({ json: { kept: all.filter(item => state.kept.includes(`${item.kind}:${item.id}`)), mine: state.mine } });
    }
    const keep = pathname.match(/^\/api\/tea-table\/keeps\/(\w+)\/([^/]+)$/);
    if (keep) {
      const key = `${keep[1]}:${keep[2]}`;
      state.kept = method === 'PUT' ? [...state.kept, key] : state.kept.filter(k => k !== key);
      return route.fulfill({ json: { kind: keep[1], id: keep[2], kept: method === 'PUT' } });
    }
    const takeOff = pathname.match(/^\/api\/tea-table\/mine\/tasting\/([^/]+)$/);
    if (takeOff && method === 'DELETE') {
      state.tookOff.push(takeOff[1]);
      return route.fulfill({ json: { kind: 'tasting', id: takeOff[1], on_table: false } });
    }
    if (pathname === '/api/events') {
      return route.fulfill({ json: [{ id: 'next', slug: 'winter-sit', title: 'Winter sit', eventDate: '2099-01-15T18:00:00Z' }] });
    }
    if (pathname === '/api/auth/me') {
      return signedIn ? route.fulfill({ json: { user: { id: 'mei', email: 'mei@example.test', name: 'Mei' } } }) : route.fulfill({ status: 401, json: {} });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });
}

const fresh = (): State => ({ kept: [], mine: [], requests: [], held: false, tookOff: [] });

async function expectQuietAndFitting(page: Page) {
  const text = await page.getByTestId('tea-table-page').innerText();
  expect(text).not.toMatch(/\b(likes?|comments?|repl(y|ies)|follow(ers?|ing)?|views?|kept by|trending|popular|for you|feed)\b/i);
  for (const piece of await page.getByTestId('tea-table-piece').all()) {
    const words = await piece.innerText();
    if (/Tasted by/.test(words)) expect(words).not.toMatch(/\d/);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('the Tea Table, closed', () => {
  test.skip(open, 'The Tea Table is open in this run');
  test('its address shows the missing page and the old address leads home', async ({ page }) => {
    await prepare(page, fresh());
    await page.goto('/tea-table');
    await expect(page.getByText('Page not found', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/tea-table$/);
    await page.goto('/tea-feed');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('the Tea Table, open', () => {
  test.skip(!open, 'The Tea Table is closed; run with VITE_TEA_TABLE_OPEN=true');

  test('a signed-out visitor sees what was put on the table, newest first, by day, with nothing counted', async ({ page }) => {
    await prepare(page, fresh());
    await page.goto('/tea-table');
    await expect(page.getByRole('heading', { level: 1, name: 'The Tea Table' })).toBeVisible();
    const pieces = page.getByTestId('tea-table-piece');
    await expect(pieces).toHaveCount(2);
    await expect(pieces.nth(0)).toContainText('Old Tree Red');
    await expect(pieces.nth(0)).toContainText('Honey on the lid');
    await expect(pieces.nth(0).getByRole('link', { name: 'Mei' })).toHaveAttribute('href', '/people/mei');
    await expect(pieces.nth(1)).toContainText('Autumn sit');
    await expect(pieces.nth(1).getByRole('link', { name: /Autumn sit/ })).toHaveAttribute('href', '/event/autumn-sit/recap');
    await expect(page.getByTestId('tea-table-day')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: '25 November 2026' })).toBeVisible();
    await expect(page.getByTestId('tea-table-page')).not.toContainText('Winter sit');
    await expect(page.getByTestId('tea-table-next-session')).toHaveCount(0);
    // The three views: the table, sessions, people.
    const views = page.getByTestId('tea-table-views');
    await expect(views.getByRole('link', { name: 'Sessions' })).toHaveAttribute('href', '/events');
    await expect(views.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/people');
    await expectQuietAndFitting(page);
  });

  test('the old address forwards to the Tea Table', async ({ page }) => {
    await prepare(page, fresh());
    await page.goto('/tea-feed');
    await expect(page).toHaveURL(/\/tea-table$/);
    await expect(page.getByRole('heading', { level: 1, name: 'The Tea Table' })).toBeVisible();
  });

  test('a held piece sits above the days', async ({ page }) => {
    await prepare(page, { ...fresh(), held: true });
    await page.goto('/tea-table');
    const held = page.getByTestId('tea-table-held');
    await expect(held.getByTestId('tea-table-piece')).toHaveCount(1);
    await expect(held).toContainText('The long table');
    const first = page.getByTestId('tea-table-piece').first();
    await expect(first).toContainText('The long table');
    await expect(held).not.toContainText(/held|pinned|featured/i);
  });

  test('a hold moves into ordinary time order at expiry while the page stays open', async ({ page }) => {
    await page.clock.install();
    const state = fresh();
    await prepare(page, state);
    const heldUntil = new Date(Date.now() + 60_000).toISOString();
    let expired = false;
    await page.route(/\/api\/tea-table$/, route => {
      state.requests.push('');
      return route.fulfill({ json: {
        held: expired ? [] : [{ ...HELD, held_until: heldUntil }],
        items: expired ? [TASTING, RECAP, HELD] : [TASTING, RECAP],
        earlier: null,
      } });
    });
    await page.goto('/tea-table');
    await expect(page.getByTestId('tea-table-held')).toContainText('The long table');
    const initialReads = state.requests.length;
    expired = true;
    await page.clock.fastForward(61_000);
    await expect(page.getByTestId('tea-table-held')).toHaveCount(0);
    await expect(page.getByTestId('tea-table-piece').last()).toContainText('The long table');
    expect(state.requests.length).toBeGreaterThan(initialReads);
  });

  test('"Earlier" is a step: back returns to where you were; the view is a refinement', async ({ page }) => {
    const state = fresh();
    await prepare(page, state);
    await page.goto('/tea-table');
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(2);
    await page.getByTestId('tea-table-earlier').click();
    await expect(page).toHaveURL(/before=/);
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(1);
    await expect(page.getByTestId('tea-table-piece')).toContainText('Spring Dancong');
    await page.goBack();
    await expect(page).toHaveURL(/\/tea-table$/);
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(2);

    await page.getByTestId('tea-table-show').getByRole('button', { name: 'Tastings' }).click();
    await expect(page).toHaveURL(/show=tastings/);
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(1);
    expect(state.requests).toContain('?show=tastings');
    // A refinement replaced the entry: back leaves the page rather than undoing the view.
    await page.goBack();
    await expect(page).not.toHaveURL(/show=tastings/);
  });

  test('signed out, Keep leads to sign in and back', async ({ page }) => {
    await prepare(page, fresh());
    await page.goto('/tea-table');
    await page.getByTestId('tea-table-keep').first().click();
    await expect(page).toHaveURL(/\/signin\?returnTo=%2Ftea-table/);
  });

  test('signed in, a piece is kept privately, and the author takes their own off', async ({ page, isMobile }) => {
    const state = { ...fresh(), mine: ['tasting:journal-1'] };
    await prepare(page, state, { signedIn: true });
    await page.goto('/tea-table');
    const recap = page.getByTestId('tea-table-piece').nth(1);
    const keep = recap.getByTestId('tea-table-keep');
    await expect(keep).toHaveText('Keep');
    const box = await keep.boundingBox();
    // 44 by 44 on a touch screen; a mouse keeps the smaller size (--tap-min in tokens.css).
    if (isMobile) expect(box && box.width >= 44 && box.height >= 44).toBe(true);
    await keep.click();
    await expect(keep).toHaveText('Kept');
    await expect(keep).toHaveAttribute('aria-pressed', 'true');
    expect(state.kept).toEqual(['recap:event-1']);
    // Nothing on the piece says how many kept it.
    await expect(recap).not.toContainText(/\d+ (people|keeps?)/);

    const own = page.getByTestId('tea-table-piece').first();
    await expect(own.getByTestId('tea-table-report')).toHaveCount(0);
    await own.getByTestId('tea-table-take-off').click();
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(1);
    expect(state.tookOff).toEqual(['journal-1']);
    await expectQuietAndFitting(page);
  });

  test('on a desktop the page fits and reads the same', async ({ page }) => {
    await prepare(page, fresh(), { width: 1280, height: 800 });
    await page.goto('/tea-table');
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(2);
    await expectQuietAndFitting(page);
  });
});
