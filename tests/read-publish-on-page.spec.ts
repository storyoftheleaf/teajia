// tests/read-publish-on-page.spec.ts
// Publish and Unpublish from the story itself (migration 0030). Adrian,
// 2026-10-01: "if I'm reading one not published, there's a button at the end
// of it when I finish it that says published. Then it goes." Plus Unpublish on
// a live story, behind a confirm.
//
// The worker's two routes are mocked with one shared state, so pressing a
// button here changes what the next page load reads, exactly as the real
// read after a real write would. Who may press is held by the worker test
// (worker/tests/read-publish-from-the-page.test.ts); this file holds what the
// page shows and does.

import { test, expect, type Page } from './fixtures';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  return `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify(payload))}.fakesig`;
}

const OWNER_TOKEN = makeFakeJWT({
  sub: 'test-owner-uid', email: 'owner@teajia.com', exp: Math.floor(Date.now() / 1000) + 86400,
  active_account_id: 'acct-bali',
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali', account_kind: 'platform', is_platform_account: true }],
});

const CURATOR_TOKEN = makeFakeJWT({
  sub: 'test-curator-uid', email: 'curator@example.com', exp: Math.floor(Date.now() / 1000) + 86400,
  active_account_id: 'acct-curator',
  memberships: [{ account_id: 'acct-curator', account_name: 'A Curator', role: 'owner', slug: 'a-curator', account_kind: 'master' }],
});

/** One shared stored state, read and written through the two mocked routes. */
async function mockPublishApi(page: Page, initial: Record<string, 'live' | 'draft'> = {}) {
  const states: Record<string, 'live' | 'draft'> = { ...initial };
  const posts: Array<{ path: string; state: string }> = [];
  await page.route(/\/api\/public\/read\/publish-state$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ states }) }));
  await page.route(/\/api\/read\/publish-state$/, async (route) => {
    const body = route.request().postDataJSON() as { path: string; state: 'live' | 'draft' };
    posts.push(body);
    states[body.path] = body.state;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...body, changed: true, states }) });
  });
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  return { states, posts };
}

async function signIn(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('teajia_token', t), token);
}

test('a signed-in owner reading a draft presses Publish at the end, and a visitor can then read it', async ({ page, browser }) => {
  const api = await mockPublishApi(page);
  await signIn(page, OWNER_TOKEN);
  await page.goto('/read/history', { waitUntil: 'domcontentloaded' });

  const control = page.getByTestId('read-publish');
  await control.scrollIntoViewIfNeeded();
  await expect(control).toHaveAttribute('data-state', 'draft');
  await page.getByTestId('read-publish-button').click();
  await expect(control).toHaveAttribute('data-state', 'live');
  await expect(page.getByText('Live. Anyone can read this story.')).toBeVisible();
  await expect(page.getByTestId('read-publish-button')).toHaveCount(0);
  expect(api.posts).toEqual([{ path: '/read/history', state: 'live' }]);
  await control.screenshot({ path: 'test-results/publish-on-page/after-publish.png' });

  // A stranger, in a fresh browser, now reads the same story the same store answers for.
  const visitor = await browser.newPage();
  await visitor.route(/\/api\/public\/read\/publish-state$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ states: api.states }) }));
  await visitor.goto('/read/history', { waitUntil: 'domcontentloaded' });
  await expect(visitor).toHaveTitle('Ten Thousand Mornings · Teajia');
  await expect(visitor.getByText('Page not found', { exact: true })).toHaveCount(0);
  // And never the button.
  await expect(visitor.getByTestId('read-publish')).toHaveCount(0);
  await visitor.close();
});

test('Unpublish asks first, then a live story is not found for a visitor', async ({ page, browser }) => {
  const api = await mockPublishApi(page);
  await signIn(page, OWNER_TOKEN);
  await page.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });

  const control = page.getByTestId('read-publish');
  await control.scrollIntoViewIfNeeded();
  await expect(control).toHaveAttribute('data-state', 'live');
  await page.getByTestId('read-unpublish').click();
  // The confirm: nothing has been sent yet.
  await expect(page.getByText('Take it down? Visitors will see a not-found page until you publish it again.')).toBeVisible();
  expect(api.posts).toEqual([]);
  await control.screenshot({ path: 'test-results/publish-on-page/unpublish-confirm.png' });
  await page.getByTestId('read-unpublish-confirm').click();
  await expect(control).toHaveAttribute('data-state', 'draft');
  expect(api.posts).toEqual([{ path: '/read/porcelain-and-tea', state: 'draft' }]);

  const visitor = await browser.newPage();
  await visitor.route(/\/api\/public\/read\/publish-state$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ states: api.states }) }));
  await visitor.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });
  await expect(visitor).toHaveTitle('Not found · Teajia');
  await visitor.close();
});

test('the index marks a story taken down as a draft for the owner and drops it for a visitor', async ({ page, browser }) => {
  await mockPublishApi(page, { '/read/porcelain-and-tea': 'draft', '/read/history': 'live' });
  await signIn(page, OWNER_TOKEN);
  await page.goto('/read', { waitUntil: 'domcontentloaded' });
  const porcelainRow = page.locator('a.tj-index-row[href="/read/porcelain-and-tea"]');
  await expect(porcelainRow).toContainText('Draft');
  await expect(page.locator('a.tj-index-row[href="/read/history"]')).not.toContainText('Draft');

  const visitor = await browser.newPage();
  await visitor.route(/\/api\/public\/read\/publish-state$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ states: { '/read/porcelain-and-tea': 'draft', '/read/history': 'live' } }) }));
  await visitor.route('**/api/articles?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await visitor.goto('/read', { waitUntil: 'domcontentloaded' });
  await expect(visitor.locator('a.tj-index-row[href="/read/history"]')).toBeVisible();
  await expect(visitor.locator('a.tj-index-row[href="/read/porcelain-and-tea"]')).toHaveCount(0);
  await visitor.close();
});

test('a failed read of the stored states leaves every live story live', async ({ page }) => {
  await page.route(/\/api\/public\/read\/publish-state$/, (route) => route.fulfill({ status: 503, body: 'down' }));
  await page.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Porcelain and Tea · Teajia$/);
  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
});

test('a visitor and a curator never see the button', async ({ page }) => {
  await mockPublishApi(page);
  await page.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Porcelain and Tea · Teajia$/);
  await expect(page.getByTestId('read-publish')).toHaveCount(0);

  await signIn(page, CURATOR_TOKEN);
  await page.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Porcelain and Tea · Teajia$/);
  await expect(page.getByTestId('read-publish')).toHaveCount(0);
});
