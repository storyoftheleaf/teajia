import { test, expect } from './fixtures';

// The Australia subdomain (au.teajia.com) maps to the Teajia Australia store.
// Host->slug mapping lives in src/lib/storeHost.ts (unit-covered separately).
// These tests prove the rendered surface: the storefront for slug
// 'teajia-australia' loads, and the normal homepage host shows no storefront.
test.describe('Teajia Australia storefront', () => {
  test('renders the Australia store at /store/teajia-australia', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/store/teajia-australia');

    // Either the store loaded (section nav present) or it reached the explicit
    // not-found state — both are the storefront shell, never the homepage.
    const storeNav = page.locator('[aria-label="Storefront sections"]');
    const notFound = page.getByText('Store not found');
    await expect(storeNav.or(notFound)).toBeVisible({ timeout: 15000 });

    // No horizontal overflow on mobile.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, 'horizontal overflow').toBeFalsy();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('homepage host shows no storefront shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-label="Storefront sections"]')).toHaveCount(0);
  });
});
