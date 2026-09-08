// tests/read-publish-gate.spec.ts
// JOBC-2: a draft article page had no gate of its own, so a visitor with
// empty storage could read it in full at its own URL. Verifies the gate
// added in src/pages/read/publishGate.ts and wired through ArticleGate in
// App.tsx: a draft is not-found for a visitor, live for a signed-in owner,
// and a live piece stays public either way.

import { test, expect, type Page } from '@playwright/test';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const OWNER_TOKEN = makeFakeJWT({
  sub: 'test-owner-uid',
  email: 'owner@teajia.com',
  role: 'owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
  ],
});

async function injectOwnerAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, OWNER_TOKEN);
}

test.beforeEach(async ({ page }) => {
  // Mocked the same way read-index-articles.spec.ts mocks it: the page's own
  // retained articles query, not what the gate decides on.
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
});

test('a draft article is not found for a visitor with empty storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/read/rock-remembers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page).toHaveTitle('Not found · Teajia');
  await expect(page.getByText('Page not found', { exact: true })).toBeVisible();
  // The interview itself never reaches the page.
  await expect(page.getByText('Chén Wǔ', { exact: false })).toHaveCount(0);

  const real = errors.filter((e) => !/favicon|fonts\.g|woff|manifest/i.test(e));
  expect(real, `console errors: ${real.join(' | ')}`).toHaveLength(0);
});

test('a draft article renders for a signed-in owner', async ({ page }) => {
  await injectOwnerAuth(page);
  await page.goto('/read/rock-remembers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page).toHaveTitle('The Rock Remembers · Teajia');
  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
});

test('a live article stays public for a visitor with empty storage', async ({ page }) => {
  await page.goto('/read/ritual', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
});
