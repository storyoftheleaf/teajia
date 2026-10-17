import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } }));
});

test('shared sign-in keeps methods and recovery compact above mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/signin');
  const code = page.getByRole('button', { name: 'Use email code instead' });
  const forgot = page.getByRole('button', { name: 'Forgot password?' });
  await expect(code).toBeVisible();
  const a = await code.boundingBox();
  const b = await forgot.boundingBox();
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(5);
  const signup = await page.getByRole('button', { name: /Create an account/ }).boundingBox();
  const nav = await page.getByTestId('bottom-tab-bar').boundingBox();
  expect(signup!.y + signup!.height).toBeLessThan(nav!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/teajia-signin-ui/compact-${test.info().project.name.replaceAll(' ', '-')}.png` });
});

test('sign-in names the pending reservation and exposes accessible reset feedback', async ({ page }) => {
  await page.goto(`/signin?returnTo=${encodeURIComponent('/event/tea-evening?rsvp=1')}`);
  await expect(page.getByText('After signing in, you’ll return to your reservation.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Recovery email').fill('reader@example.com');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
  await expect(page.getByLabel('Recovery email')).toHaveValue('reader@example.com');
});

for (const theme of ['dark', 'light']) {
  test(`sign-in stays readable in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(theme => localStorage.setItem('teajia_theme', theme), theme);
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/teajia-signin-ui/${theme}-${testInfo.project.name.replaceAll(' ', '-')}.png`, fullPage: true });
  });
}
