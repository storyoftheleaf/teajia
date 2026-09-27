/**
 * Admin account-context coverage.
 *
 * No backend required: API mocked via page.route, fake JWT via localStorage.
 */

import { test, expect, type Page, type BrowserContext } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/admin-header-switcher');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const BALI_ID = 'acct-bali';
const AUS_ID = 'acct-australia';

// Owner is a direct member of Bali only. Australia is reachable via the
// platform-owner "All Network Accounts" list, not via membership.
const MEMBERSHIPS = [
  { account_id: BALI_ID, account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
];

const NETWORK_ACCOUNTS = [
  { id: BALI_ID, name: 'Teajia Bali', slug: 'teajia-bali', location_city: 'Ubud', currency_default: 'USD' },
  { id: AUS_ID, name: 'Teajia Australia', slug: 'teajia-australia', location_city: '', currency_default: 'AUD' },
];

function tokenFor(activeId: string | null, memberships = MEMBERSHIPS): string {
  return makeFakeJWT({
    sub: 'test-owner-uid',
    email: 'owner@teajia.com',
    name: 'Platform Owner',
    role: 'owner',
    platform_role: 'platform_owner',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    active_account_id: activeId,
    memberships,
  });
}

async function injectAuth(page: Page, activeId = BALI_ID) {
  const token = tokenFor(activeId);
  await page.addInitScript((t) => {
    localStorage.setItem('teajia_token', t);
  }, token);
}

async function mockApi(context: BrowserContext) {
  await context.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Session check — keep the app authenticated (memberships come from the JWT).
    if (url.endsWith('/api/auth/me') && method === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-owner-uid', email: 'owner@teajia.com', name: 'Platform Owner',
          role: 'owner', platform_role: 'platform_owner',
          memberships: MEMBERSHIPS, active_account_id: BALI_ID,
        }),
      });
    }
    if (url.endsWith('/api/platform/accounts') && method === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ accounts: NETWORK_ACCOUNTS }),
      });
    }
    if (url.endsWith('/api/accounts/switch') && method === 'POST') {
      const body = route.request().postDataJSON?.() ?? {};
      const newId = body.account_id || BALI_ID;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ token: tokenFor(newId), active_account_id: newId }),
      });
    }
    if (url.endsWith(`/api/accounts/${AUS_ID}`) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: AUS_ID,
          name: 'Teajia Australia',
          slug: 'teajia-australia',
          location_city: '',
          currency_default: 'AUD',
        }),
      });
    }
    // Everything else: empty success so the admin shell renders.
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('platform owner without membership rows bypasses the invitation gate', async ({ page, context }) => {
  test.skip(!process.env.ADMIN_TEST_URL, 'needs an API-configured admin server (set ADMIN_TEST_URL)');

  await mockApi(context);
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, tokenFor(BALI_ID, []));

  const base = process.env.ADMIN_TEST_URL || '';
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Waiting for an invite')).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator('main')).toBeVisible();
});

test('keeps operated-account context inside Your Table', async ({ page, context }) => {
  test.skip(!process.env.ADMIN_TEST_URL, 'needs an API-configured admin server (set ADMIN_TEST_URL)');

  await mockApi(context);
  await injectAuth(page, AUS_ID);

  const base = process.env.ADMIN_TEST_URL || '';
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(1000);

  await expect(page.locator('body')).not.toContainText('every action is logged and visible to the account owner');

  await page.getByRole('button', { name: /Your Table Platform Owner/i }).click();
  await expect(page.getByText('Logged in to Teajia Australia')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'account-context-in-your-table.png') });
});
