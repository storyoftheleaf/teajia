import { expect, test, type Page } from './fixtures';
import { injectAuth } from './helpers/inventoryMocks';

/**
 * Curator's notes (Adrian, 2026-11-24): in the tea's own editor, each of the
 * shop's notes can be chosen to show on the tea page, signed Tjia, curator.
 * The choice is saved with the tasting.
 */
const NOTE = 'Picked from one old tree above the village, the leaf hand rolled.';
const TEA = {
  id: 'tea-1', type: 'White', product_name: 'Moonlight White', year: '2024', origin_country: 'China',
  origin_region: 'Fujian', retail_price_per_gram_usd: 0.15, stock_grams: 200, status: 'Active', is_curated: 1,
  description: 'Soft florals with a clean finish.', tasting_source: 'owner',
  tasting: { flavor: ['floral'], notes: [{ id: 'own-1', text: NOTE, section: 'general' }] },
};

async function mockShop(page: Page, saved: Array<Record<string, unknown>>) {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/media/')) return route.fallback();
    if (request.method() === 'PUT' && url.pathname.startsWith('/api/products/tea-1')) {
      saved.push(request.postDataJSON());
      return route.fulfill({ json: { ...TEA, ...request.postDataJSON() } });
    }
    if (url.pathname === '/api/auth/me') return route.fulfill({ json: { id: 'test-admin-uid', name: 'Adrian', role: 'owner' } });
    if (url.pathname === '/api/products/public' || url.pathname === '/api/products') return route.fulfill({ json: [TEA] });
    if (url.pathname.includes('/rates')) return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }] });
    if (url.pathname.includes('/network/stores')) return route.fulfill({ json: { stores: [] } });
    return route.fulfill({ json: [] });
  });
}

test("the owner chooses a note for Curator's notes and it is saved starred", async ({ page }) => {
  const saved: Array<Record<string, unknown>> = [];
  await mockShop(page, saved);
  await injectAuth(page);
  await page.goto('/shop/product/tea-1');
  await page.locator('.tea-product-nav-end').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Open your impression', exact: true }).click();

  const choice = page.getByTestId('curator-choice');
  await expect(choice).toContainText(NOTE);
  const toggle = choice.getByRole('button', { name: 'Show on the tea page' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(choice.getByRole('button', { name: 'On the tea page' })).toHaveAttribute('aria-pressed', 'true');
  await choice.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('curator-choice.png') });

  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect.poll(() => saved.length).toBeGreaterThan(0);
  const tasting = saved.at(-1)!.tasting as { notes: Array<{ id: string; text: string; starred?: boolean }> };
  expect(tasting.notes.find(note => note.text === NOTE)?.starred).toBe(true);
  expect(saved.at(-1)!.tasting_source).toBe('owner');
});
