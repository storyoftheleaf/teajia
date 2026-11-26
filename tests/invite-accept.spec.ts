// Launch 1, slice S2: an account or tea master invite at /invite/<token> is
// accepted by choosing a password; a session plus-guest invite at the same
// address still opens its claim form. Proven against the sandbox too (run sheet).
import { expect, test } from './fixtures';

const accountToken = 'c'.repeat(64);
const plusGuestToken = 'd'.repeat(64);

test.describe('the invite address', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('an account invite sets a password and joins', async ({ page }) => {
    const resets: unknown[] = [];
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === `/api/guest-invite/${accountToken}`) return route.fulfill({ status: 404, json: { error: 'Invite not found' } });
      if (url.pathname === '/api/auth/reset-password') {
        resets.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(`/invite/${accountToken}`);
    await expect(page.getByRole('heading', { name: 'You are invited' })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password').fill('short');
    await page.getByRole('button', { name: 'Accept invite' }).click();
    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible();
    expect(resets).toEqual([]);
    await page.getByLabel('Password', { exact: true }).fill('a good password');
    await page.getByLabel('Confirm password').fill('a good password');
    await page.getByRole('button', { name: 'Accept invite' }).click();
    await expect(page.getByTestId('invite-accepted')).toBeVisible();
    expect(resets).toEqual([{ token: accountToken, newPassword: 'a good password' }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('a token nobody knows ends on a plain not found', async ({ page }) => {
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/guest-invite/')) return route.fulfill({ status: 404, json: { error: 'Invite not found' } });
      if (url.pathname === '/api/auth/reset-password') return route.fulfill({ status: 400, json: { error: 'Invalid or expired reset token' } });
      return route.fulfill({ json: {} });
    });
    await page.goto(`/invite/${accountToken}`);
    await page.getByLabel('Password', { exact: true }).fill('a good password');
    await page.getByLabel('Confirm password').fill('a good password');
    await page.getByRole('button', { name: 'Accept invite' }).click();
    await expect(page.getByTestId('invite-unknown')).toBeVisible();
  });

  test('a session plus-guest invite still opens its claim form', async ({ page }) => {
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === `/api/guest-invite/${plusGuestToken}`) {
        return route.fulfill({ json: {
          id: 'gi-1', invite_token: plusGuestToken, name_hint: 'A friend', status: 'pending',
          event_title: 'A test sit', event_date: '2026-12-01', event_slug: 'a-test-sit',
        } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(`/invite/${plusGuestToken}`);
    await expect(page.getByRole('button', { name: /Claim Your Seat/i })).toBeVisible();
    await expect(page.getByTestId('invite-accept')).toHaveCount(0);
  });
});
