import { test, expect } from './fixtures';

const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'oauth-return-test', email: 'oauth@example.com', name: 'Google Reader',
    role: 'user', memberships: [], active_account_id: null,
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  })).toString('base64url'),
  'test-signature',
].join('.');

test('Google return keeps the signed-in identity when the profile request is temporarily unavailable', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporarily unavailable' }),
  }));
  await page.goto(`/?account=1#oauth_token=${token}`);
  await expect(page.getByText('Google Reader', { exact: true }).and(page.locator('div'))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/oauth_token/);
  expect(await page.evaluate(() => !!localStorage.getItem('teajia_token'))).toBe(true);
  await page.screenshot({ path: `test-results/google-return-${test.info().project.name.replaceAll(' ', '-')}.png` });
});

test('Google return discards a session explicitly rejected by the server', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }),
  }));
  await page.goto(`/?account=1#oauth_token=${token}`);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('teajia_token'))).toBeNull();
});
