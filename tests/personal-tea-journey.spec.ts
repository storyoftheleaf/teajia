import { expect, test, type Page } from '@playwright/test';

function makeFakeJWT(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const token = makeFakeJWT({
  sub: 'personal-tea-user',
  email: 'tea@example.com',
  name: 'Tea Keeper',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86_400,
  active_account_id: 'acct-bali',
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
});

const journalTea = 'Journal-only Sencha';
const favoriteTea = 'Favorite-only Oolong';
const cellarTea = 'Cellar-only Sheng';

async function prepare(page: Page) {
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/tasting-journal') {
      return route.fulfill({ json: { entries: [{
        id: 'journal-1', product_id: 'journal-product', product_name: journalTea,
        product_type: 'Green', tasting: '{}', created_at: '2026-07-12T08:00:00.000Z',
      }] } });
    }
    if (pathname === '/api/user/favorites') {
      return route.fulfill({ json: { favorites: ['favorite-product'], favorite_names: [favoriteTea] } });
    }
    if (pathname === '/api/me/cellar') {
      return route.fulfill({ json: { items: [{
        id: 'cellar-1', name: cellarTea, type: 'Puer', origin: 'Yunnan', year: 2018,
        grams: 180, placementStatus: 'private', placementAccountId: null,
        linkedProductId: null, shelfPublished: false,
        createdAt: '2026-07-12T08:00:00.000Z', updatedAt: '2026-07-12T08:00:00.000Z',
      }] } });
    }
    if (pathname === '/api/me/shelf') {
      return route.fulfill({ json: { enabled: false, slug: null, title: null, whatsapp: null } });
    }
    if (pathname === '/api/products/public') return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
}

test.describe('personal tea journeys', () => {
  test('Remember and the three distinct tea models stay correctly connected', async ({ page }) => {
    await prepare(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Your Table', exact: true }).click();
    await page.getByRole('button', { name: /remember/i }).click();
    await expect(page).toHaveURL(/\/account\/collection$/);
    await expectNoOverflow(page);

    await page.goto('/account/journal');
    await expect(page.getByText(journalTea)).toBeVisible();
    await expect(page.getByText(cellarTea)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Favorites/ })).toHaveAttribute('href', '/account/collection');
    await expect(page.getByRole('link', { name: /Cellar/ })).toHaveAttribute('href', '/account/cellar');
    await expectNoOverflow(page);

    await page.getByRole('link', { name: /Cellar/ }).click();
    await expect(page).toHaveURL(/\/account\/cellar$/);
    await expect(page.getByText(cellarTea)).toBeVisible();
    await expect(page.getByText(favoriteTea)).toHaveCount(0);
    await expectNoOverflow(page);

    const links = page.getByRole('navigation', { name: 'Your tea' });
    await links.scrollIntoViewIfNeeded();
    if ((await page.viewportSize())?.width === 390) {
      const linksBox = await links.boundingBox();
      const bottomNavBox = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
      expect(linksBox && bottomNavBox && linksBox.y + linksBox.height <= bottomNavBox.y).toBe(true);
    }
  });
});
