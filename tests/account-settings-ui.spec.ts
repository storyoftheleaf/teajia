import { test, expect, type Page } from './fixtures';
import { mkdir } from 'node:fs/promises';
import { findScreenEdgeOverruns } from './helpers/screenEdge';

const member = { id: 'settings-member', email: 'reader@example.com', name: 'Tea Reader', username: 'teareader', phone: '+886912345678', role: 'user', has_password: false, google_connected: true, email_verified: true };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ ...member, sub: member.id, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })).toString('base64url'), 'test'].join('.');
async function setup(page: Page, theme = 'dark') {
  await page.addInitScript(({ token, theme }) => { localStorage.setItem('teajia_token', token); localStorage.setItem('teajia_theme', theme); }, { token: jwt, theme });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(member) }));
}

for (const theme of ['dark', 'light']) {
  test(`account settings is compact, truthful and usable in ${theme}`, async ({ page }, testInfo) => {
    await setup(page, theme);
    await page.goto('/account/settings');
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
    await expect(page.getByLabel('WhatsApp / Phone')).toHaveValue(member.phone);
    await expect(page.getByRole('heading', { name: 'Sign-in & security' })).toBeVisible();
    const security = page.getByRole('region', { name: 'Sign-in & security' });
    await expect(security.getByText('Connected', { exact: true })).toBeVisible();
    await expect(security.getByText('Verified', { exact: true })).toBeVisible();
    await expect(security.getByText('Not set', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await expect(page.getByLabel('New password', { exact: true })).not.toBeVisible();
    await expect(page.getByLabel('Type DELETE to confirm')).not.toBeVisible();
    await expect(page.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
    expect(await findScreenEdgeOverruns(page)).toEqual([]);
    await mkdir('/tmp/teajia-account-ui', { recursive: true });
    await page.screenshot({ path: `/tmp/teajia-account-ui/account-settings-${theme}-${testInfo.project.name.replaceAll(' ', '-')}.png`, fullPage: true });
    await page.getByRole('radio', { name: theme === 'dark' ? 'Light' : 'Dark', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('teajia_theme'))).toBe(theme === 'dark' ? 'light' : 'dark');
  });
}

test('late profile hydration fills missing details and preserves a name being edited', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/me', async route => { await gate; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(member) }); });
  await page.goto('/account/settings');
  await page.getByLabel('Name', { exact: true }).fill('My new name');
  release();
  await expect(page.getByLabel('WhatsApp / Phone')).toHaveValue(member.phone);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My new name');
  let saved: unknown;
  await page.route('**/api/auth/profile', async route => { saved = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }); });
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...member, name: 'My new name' }) }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved.')).toBeVisible();
  expect(saved).toEqual({ name: 'My new name' });
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});

test('failed security lookup offers retry without guessing connected or verified', async ({ page }) => {
  await setup(page);
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) }));
  await page.goto('/account/settings');
  const security = page.getByRole('region', { name: 'Sign-in & security' });
  await expect(security.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(security.getByText('Connected', { exact: true })).toHaveCount(0);
  await expect(security.getByText('Verified', { exact: true })).toHaveCount(0);
  await expect(security.getByText('Status unavailable')).toHaveCount(3);
  await security.locator('summary').click();
  await expect(security.getByRole('button', { name: 'Update password' })).toBeDisabled();
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...member, has_password: true, google_connected: false, email_verified: false }) }));
  await security.getByRole('button', { name: 'Try again' }).click();
  await expect(security.getByText('Not connected', { exact: true })).toBeVisible();
  await expect(security.getByText('Not verified', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
});
