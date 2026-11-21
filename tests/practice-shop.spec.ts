import { test, expect } from './fixtures';

/**
 * The practice shop runs on this checkout. Run with
 * `npx playwright test --config playwright.practice.config.ts`, which starts
 * the practice API (8798) and site (7813) itself. Nothing here reaches live.
 */
test('the practice API answers sign-in and the people list through the site', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { identifier: 'sandbox', password: 'sandbox' } });
  expect(login.status()).toBe(200);
  const people = await request.get('/api/people');
  expect(people.status()).toBe(200);
});

test('a tea page loads on the practice site', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const list = await page.request.get('/api/products/public');
  const body = list.ok() ? await list.json() : null;
  const products = Array.isArray(body) ? body : (body?.products ?? []);
  expect(products.length, 'the practice shop has at least one tea').toBeGreaterThan(0);
  const response = await page.goto(`/shop/product/${products[0].id}`);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  const name = String(products[0].given_name || products[0].product_name || products[0].name || '');
  expect(name, 'the tea has a name').not.toBe('');
  await expect(page.getByText(name).first(), 'the tea page shows the tea, not the loading mark').toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/practice/tea-page.png' });
});
