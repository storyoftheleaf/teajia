// tests/site-menu.spec.ts
// The bottom bar has two doors. The left end is a three-line glyph that raises
// the site panel; the right end raises Your Table. The panel lists the places
// the bar has no slot for (search, sessions, people, places, tea wisdom, cart)
// and, for anyone with a Manage room, the same rooms the desktop column shows.
// A customer never sees that second band. Phone width only: the desktop rail
// already carries every one of these.
import { test, expect, type Page } from './fixtures';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const MEMBERSHIPS = [
  { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
];

async function signInAsOwner(page: Page) {
  const token = makeFakeJWT({
    sub: 'test-owner-uid', email: 'owner@teajia.com', name: 'Platform Owner',
    role: 'owner', platform_role: 'platform_owner',
    exp: Math.floor(Date.now() / 1000) + 86400,
    active_account_id: 'acct-bali', memberships: MEMBERSHIPS,
  });
  await page.context().route('**/api/**', async (route) => {
    if (route.request().url().endsWith('/api/auth/me')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-owner-uid', email: 'owner@teajia.com', name: 'Platform Owner',
          role: 'owner', platform_role: 'platform_owner',
          memberships: MEMBERSHIPS, active_account_id: 'acct-bali',
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.addInitScript((t) => localStorage.setItem('teajia_token', t), token);
}

test.describe('the site panel', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'phone bar only');

  test('the left end of the bar is the menu glyph, not search', async ({ page }) => {
    await page.goto('/shop');
    const bar = page.getByTestId('bottom-tab-bar');
    await expect(bar.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Search' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Your Table' })).toBeVisible();
  });

  test('a visitor gets the site band, search first, and no Manage band', async ({ page }) => {
    await page.goto('/shop');
    await page.getByTestId('bottom-tab-bar').getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByTestId('site-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(menu.getByRole('link')).toHaveText(['Sessions', 'People', 'Places', 'Tea Wisdom']);
    await expect(menu.getByText('Manage', { exact: true })).toHaveCount(0);
    // The panel sits above the bar, never over it.
    const menuBox = await menu.boundingBox();
    const barBox = await page.getByTestId('bottom-tab-bar').boundingBox();
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(barBox!.y);
    // No horizontal overflow with the panel open.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });

  test('a row navigates and closes the panel', async ({ page }) => {
    await page.goto('/shop');
    await page.getByTestId('bottom-tab-bar').getByRole('button', { name: 'Menu' }).click();
    await page.getByTestId('site-menu').getByRole('link', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByTestId('site-menu')).toHaveCount(0);
  });

  test('an owner gets the Manage band, with Members in it', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/shop');
    await page.getByTestId('bottom-tab-bar').getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByTestId('site-menu');
    await expect(menu.getByText('Manage', { exact: true })).toBeVisible();
    const rows = await menu.getByRole('link').allInnerTexts();
    expect(rows.map(r => r.toLowerCase())).toEqual(expect.arrayContaining(['dashboard', 'stock', 'orders', 'people', 'events', 'members', 'settings']));
    // One word per route: Orders and People are rooms; Business and its Activity child are gone.
    expect(rows.map(r => r.toLowerCase())).not.toContain('business');
    expect(rows.map(r => r.toLowerCase())).not.toContain('activity');
    await menu.getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/admin\/access$/);
  });
});
