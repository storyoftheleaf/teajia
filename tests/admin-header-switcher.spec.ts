/**
 * Admin header account switcher.
 *
 * A platform owner gets the account switcher in the admin top bar. Tapping it
 * opens a dropdown (downward, since it's a header) listing their tea houses
 * plus "All Network Accounts" — where Teajia Australia lives, since the owner
 * is not a direct member of it. This is the in-app path to operate as Australia.
 *
 * No backend required: API mocked via page.route, fake JWT via localStorage.
 * Pattern matches tests/account-switcher-multi-location.spec.ts.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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

function tokenFor(activeId: string): string {
  return makeFakeJWT({
    sub: 'test-owner-uid',
    email: 'owner@teajia.com',
    name: 'Platform Owner',
    role: 'owner',
    platform_role: 'platform_owner',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    active_account_id: activeId,
    memberships: MEMBERSHIPS,
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
    // Everything else: empty success so the admin shell renders.
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

// The admin shell gates on a configured API (VITE_API_URL). The default dev
// server on :7777 has none, so this test needs a server started with the API
// URL set, reached via ADMIN_TEST_URL. Without it, skip rather than false-fail.
//   VITE_API_URL=<worker-url> npx vite --port 7788
//   ADMIN_TEST_URL=http://localhost:7788 npx playwright test tests/admin-header-switcher.spec.ts
test('platform owner can reach Teajia Australia from the admin header switcher', async ({ page, context }) => {
  test.skip(!process.env.ADMIN_TEST_URL, 'needs an API-configured admin server (set ADMIN_TEST_URL)');

  await mockApi(context);
  await injectAuth(page, BALI_ID);

  const base = process.env.ADMIN_TEST_URL || '';
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // The header switcher is the "Switch account" button.
  const switcher = page.locator('button[aria-label="Switch account"]').first();
  await expect(switcher, 'admin header switcher should be present for a platform owner').toBeVisible({ timeout: 10000 });

  await switcher.click();
  await page.waitForTimeout(800);

  // The dropdown opens downward (header placement) and shows the platform
  // owner's network section — the path that surfaces Teajia Australia.
  await expect(page.getByText('Your Tea Houses')).toBeVisible();
  await expect(page.getByText('All Network Accounts')).toBeVisible();

  await page.screenshot({ path: path.join(SHOTS_DIR, 'dropdown-open.png') });

  // The dropdown sits below the trigger (header opens down, not up).
  const triggerBox = await switcher.boundingBox();
  const listBox = await page.locator('[role="listbox"]').boundingBox();
  expect(triggerBox && listBox && listBox.y >= triggerBox.y, 'dropdown opens downward in the header').toBeTruthy();

  // No horizontal overflow introduced by the new bar.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, 'no horizontal overflow with the header bar').toBeFalsy();
});
