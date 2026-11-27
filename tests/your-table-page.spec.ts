import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { primaryNav } from './helpers/navigation';

// Launch 4, Your Table as a page (todo/plans/guests-and-tea-masters-launch-4-run.md,
// K8; todo/plans/your-table.md). At 390 by 844 and on the desk, with mocked
// routes. The page is closed until Adrian says yes at the gate: with
// VITE_YOUR_TABLE_PAGE_OPEN=true on the site these walk the page and each of
// its views once; without it they prove /account is the overlay it was.

const pageOpen = process.env.VITE_YOUR_TABLE_PAGE_OPEN !== 'false';

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1280, height: 900 },
] as const;

function fakeJWT(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const MEMBERSHIPS = [
  { account_id: 'acct-home', account_name: 'Home Table', role: 'member', slug: 'home-table', bundles: [] },
  { account_id: 'acct-second', account_name: 'Second Table', role: 'member', slug: 'second-table', bundles: [] },
];

const token = fakeJWT({
  sub: 'reader', email: 'reader@example.test', name: 'Mei Reader', role: 'member',
  exp: Math.floor(Date.now() / 1000) + 86_400,
  active_account_id: 'acct-home',
  memberships: MEMBERSHIPS,
});

type State = {
  shares: Record<string, 'private' | 'page' | 'offered'>;
  shareWrites: Array<{ productId: string; share_state: string }>;
  shareReads: number;
};

async function prepare(page: Page, size: { width: number; height: number }, { signedIn = true } = {}) {
  await page.setViewportSize({ width: size.width, height: size.height });
  const state: State = { shares: { 'tea-shared': 'page' }, shareWrites: [], shareReads: 0 };
  if (signedIn) {
    await page.addInitScript(({ value, memberships }) => {
      localStorage.setItem('teajia_token', value);
      if (!sessionStorage.getItem('your-table-seeded')) {
        localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
          memberships, activeAccountId: 'acct-home', activeUserId: 'reader',
          tastingJournal: [
            { id: 'journal-tea-quiet', accountId: 'acct-home', productId: 'tea-quiet', productName: 'Quiet Oolong', productType: 'Oolong',
              createdAt: '2026-11-21T00:00:00.000Z', synced: true, note: { tasting: {}, updatedAt: '2026-11-21T00:00:00.000Z' },
              tastings: [{ id: 'sit-quiet', createdAt: '2026-11-21T00:00:00.000Z', tasting: {} }] },
            { id: 'journal-tea-shared', accountId: 'acct-home', productId: 'tea-shared', productName: 'Shared Red', productType: 'Red',
              createdAt: '2026-11-20T00:00:00.000Z', synced: true, note: { tasting: {}, updatedAt: '2026-11-20T00:00:00.000Z' },
              tastings: [{ id: 'sit-shared', createdAt: '2026-11-20T00:00:00.000Z', tasting: {} }] },
          ],
        } }));
        sessionStorage.setItem('your-table-seeded', '1');
      }
    }, { value: token, memberships: MEMBERSHIPS });
  }
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === '/api/auth/refresh') return route.fulfill({ json: { token } });
    if (pathname === '/api/auth/me') return route.fulfill({ json: { id: 'reader', email: 'reader@example.test', name: 'Mei Reader', role: 'member' } });
    if (pathname === '/api/family/tasting-shares') {
      state.shareReads += 1;
      if (!pageOpen) return route.fulfill({ status: 404, json: { error: 'Not found' } });
      return route.fulfill({ json: { shares: Object.entries(state.shares).map(([product_id, share_state]) => ({ product_id, share_state })) } });
    }
    const mine = pathname.match(/^\/api\/family\/teas\/([^/]+)\/mine$/);
    if (mine) {
      return route.fulfill({ json: { product_id: mine[1], photographs: [], cover_photograph_id: null, tasting_share_state: state.shares[mine[1]] ?? 'private', remaining: 6 } });
    }
    const share = pathname.match(/^\/api\/family\/teas\/([^/]+)\/share$/);
    if (share && method === 'PUT') {
      const body = request.postDataJSON() as { share_state: 'private' | 'page' | 'offered' };
      state.shareWrites.push({ productId: share[1], share_state: body.share_state });
      state.shares[share[1]] = body.share_state;
      return route.fulfill({ json: { product_id: share[1], journal_entry_id: `journal-${share[1]}`, share_state: body.share_state, photographs_updated: 0, page_id: 'p1', page_path: '/people/p1', page_created: false } });
    }
    if (pathname === '/api/tasting-journal' || pathname === '/api/tasting-journal/sync') return route.fulfill({ json: { entries: [] } });
    if (/^\/api\/s\/[^/]+\/events$/.test(pathname)) return route.fulfill({ json: [] });
    if (pathname === '/api/me/cellar') return route.fulfill({ json: { items: [] } });
    if (pathname === '/api/me/shelf') return route.fulfill({ json: { enabled: false, slug: null, title: null, whatsapp: null } });
    if (pathname === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    if (pathname.startsWith('/api/accounts/')) return route.fulfill({ json: { id: 'acct-home', name: 'Home Table' } });
    return route.fulfill({ json: {} });
  });
  return state;
}

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function tapGlyph(page: Page) {
  await primaryNav(page).locator('button[aria-label="Your Table"], button[title="Your Table"]').first().click();
}

test.describe('Your Table as a page, open', () => {
  test.skip(!pageOpen, 'Your Table is not a page yet; run with VITE_YOUR_TABLE_PAGE_OPEN=true');

  for (const size of SIZES) {
    test(`${size.name}: the glyph opens /account as a page, the tiles keep their words under quiet headings, back leaves`, async ({ page }) => {
      await prepare(page, size);
      await page.goto('/shop');
      await tapGlyph(page);
      await expect(page).toHaveURL(/\/account$/);
      const table = page.getByTestId('your-table-page');
      await expect(table).toBeVisible();
      await expect(table.getByRole('heading', { level: 1, name: 'Your Table' })).toBeVisible();
      // Not the overlay: nothing is laid over the page.
      await expect(page.locator('.z-panel-modal')).toHaveCount(0);
      for (const heading of ['On your table', 'Your tea', 'Your path', 'Your page', 'Your tea houses']) {
        await expect(table.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      }
      // Every tile keeps its word, once.
      for (const word of ['journal', 'sessions', 'remember', 'Tea Chest', 'discover', 'profile', 'orders', 'journey', 'switch']) {
        await expect(table.getByRole('button', { name: new RegExp(`^${word}`) })).toHaveCount(1);
      }
      await expect(page.getByTestId('table-group-tea').getByRole('button')).toHaveCount(3);
      await noSideScroll(page);
      await page.goBack();
      await expect(page).toHaveURL(/\/shop$/);
    });

    test(`${size.name}: sessions and the table switcher are addresses of their own, and back walks them`, async ({ page }) => {
      await prepare(page, size);
      await page.goto('/account');
      const table = page.getByTestId('your-table-page');
      await table.getByRole('button', { name: /^sessions/ }).click();
      await expect(page).toHaveURL(/\/account\/sessions$/);
      await expect(table.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible();
      await table.getByRole('button', { name: 'Past', exact: true }).click();
      await expect(page).toHaveURL(/\/account\/sessions\?when=past$/);
      await expect(table.getByText('No past sessions yet.')).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/account\/sessions$/);
      await table.getByRole('button', { name: 'Back' }).click();
      await expect(page).toHaveURL(/\/account$/);

      await table.getByRole('button', { name: /^switch/ }).click();
      await expect(page).toHaveURL(/\/account\/tea-houses$/);
      await expect(table.getByRole('heading', { level: 1, name: 'Switch table' })).toBeVisible();
      await expect(table.getByRole('button', { name: /^Second Table/ })).toBeVisible();
      await noSideScroll(page);
      await page.goBack();
      await expect(page).toHaveURL(/\/account$/);
    });

    test(`${size.name}: journal and Tea Chest open their own pages, and each tasting says where it is`, async ({ page }) => {
      const state = await prepare(page, size);
      await page.goto('/account');
      await page.getByTestId('your-table-page').getByRole('button', { name: /^Tea Chest/ }).click();
      await expect(page).toHaveURL(/\/account\/cellar$/);
      await page.goBack();
      await page.getByTestId('your-table-page').getByRole('button', { name: /^journal/ }).click();
      await expect(page).toHaveURL(/\/account\/journal$/);

      const lines = page.getByTestId('journal-share-line');
      await expect(lines).toHaveCount(2);
      const quiet = page.getByRole('button', { name: /^Quiet Oolong: Private\./ });
      await expect(quiet).toHaveText('Private');
      await expect(page.getByRole('button', { name: /^Shared Red: On your page\./ })).toHaveText('On your page');
      // The tap floor: 44 on a touch screen, the mouse floor otherwise (--tap-min).
      const floor = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap-min')) || 44);
      const box = await quiet.boundingBox();
      expect(box && box.height >= floor - 0.5).toBe(true);
      // No counts on a line.
      for (const text of await lines.allInnerTexts()) expect(text).not.toMatch(/\d/);

      await quiet.click();
      await expect(page).toHaveURL(/share=tea-quiet/);
      const step = page.getByRole('dialog', { name: 'Share this tasting' });
      await expect(step).toBeVisible();
      await step.getByRole('button', { name: 'On my page', exact: true }).click();
      await step.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(step.getByRole('status')).toHaveText('On your page.');
      expect(state.shareWrites).toEqual([{ productId: 'tea-quiet', share_state: 'page' }]);
      await step.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('button', { name: /^Quiet Oolong: On your page\./ })).toBeVisible();
      await noSideScroll(page);
    });
  }

  test('signed out, /account is the reader view as a page', async ({ page }) => {
    await prepare(page, SIZES[0], { signedIn: false });
    await page.goto('/account');
    const table = page.getByTestId('your-table-page');
    await expect(table).toBeVisible();
    await expect(page.locator('.z-panel-modal')).toHaveCount(0);
    await expect(table.getByRole('heading', { level: 1, name: 'Your Table' })).toBeVisible();
    await noSideScroll(page);
  });
});

test.describe('Your Table as a page, closed', () => {
  test.skip(pageOpen, 'Your Table is a page on this server');

  for (const size of SIZES) {
    test(`${size.name}: /account is the overlay, as before, and the journal shows no share lines`, async ({ page }) => {
      const state = await prepare(page, size);
      await page.goto('/account');
      await expect(page.locator('.z-panel-modal')).toBeVisible();
      await expect(page.getByTestId('your-table-page')).toHaveCount(0);
      await expect(page.locator('.z-panel-modal').getByRole('heading', { name: 'Your Table' })).toBeVisible();
      for (const heading of ['On your table', 'Your path', 'Your tea houses']) {
        await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(0);
      }
      // The panel's own journal view still opens inside the overlay.
      await page.locator('.z-panel-modal').getByRole('button', { name: /^journal/ }).click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.locator('.z-panel-modal').getByRole('heading', { name: 'Tasting Journal' })).toBeVisible();

      await page.goto('/account/journal');
      await expect(page.getByText('Quiet Oolong').first()).toBeVisible();
      await expect(page.getByTestId('journal-share-line')).toHaveCount(0);
      expect(state.shareReads).toBe(0);

      await page.goto('/account/sessions');
      await expect(page.getByTestId('your-table-page')).toHaveCount(0);
    });
  }
});
