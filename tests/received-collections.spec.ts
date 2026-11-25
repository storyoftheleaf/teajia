import { test, expect, tapFloor, type Page } from './fixtures';

const shelf = {
  id: 'collection-1',
  slug: 'spring-teas',
  title: 'Spring teas from another curator',
  source: 'received',
  curator_display_name: 'Li',
  item_count: 2,
  thumbnails: [],
};
const fullPage = '/account/collections';
const embeddedPage = '/account/collection';
const collectionAPI = /\/api\/me\/collections$/;
const session = {
  sub: 'recipient',
  email: 'recipient@example.com',
  name: 'Recipient',
  role: 'member',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
};

function tokenFor(userId: string) {
  const payload = Buffer.from(JSON.stringify({ ...session, sub: userId })).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.fake`;
}

async function stubApp(page: Page, signedIn = true) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: session });
    if (path === '/api/products/public') return route.fulfill({ json: { products: [] } });
    if (path === '/api/rates') return route.fulfill({ json: { rates: [] } });
    return route.fulfill({ json: {} });
  });
  if (signedIn) {
    await page.addInitScript(token => localStorage.setItem('teajia_token', token), tokenFor(session.sub));
  }
}

test.use({ viewport: { width: 390, height: 844 } });

for (const path of [fullPage, embeddedPage]) {
  test(`shows a failed authorized load and recovers on retry at ${path}`, async ({ page }, testInfo) => {
    await stubApp(page);
    let reads = 0;
    await page.route(collectionAPI, route => {
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      reads++;
      return reads === 1
        ? route.fulfill({ status: 500, json: { error: 'Fixture unavailable', retryable: false } })
        : route.fulfill({ json: { collections: [shelf] } });
    });
    await page.goto(path);
    const section = page.getByRole('region', { name: 'Shared with you' });
    await expect(section.getByRole('alert')).toHaveText('Could not load your collections.');
    await expect(section.getByText('No collections yet')).toHaveCount(0);
    await expect(section.getByText('0 collections shared with you')).toHaveCount(0);
    const retry = section.getByRole('button', { name: 'Try again' });
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(tapFloor());
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await section.screenshot({ path: testInfo.outputPath('failed-state.png') });

    await retry.click();
    await expect(section.getByRole('button', { name: new RegExp(shelf.title) }).first()).toBeVisible();
    await expect(section.getByRole('alert')).toHaveCount(0);
    expect(reads).toBe(2);
  });
}

test('keeps a genuinely empty shelf quiet in the embedded view', async ({ page }) => {
  await stubApp(page);
  await page.route(collectionAPI, route => route.fulfill({ json: { collections: [] } }));
  await page.goto(fullPage);
  await expect(page.getByRole('heading', { name: 'No collections yet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);

  const response = page.waitForResponse(collectionAPI);
  await page.goto(embeddedPage);
  await response;
  await expect(page.getByRole('region', { name: 'Shared with you' })).toHaveCount(0);
});

test('offers guests sign-in on the direct route and keeps the embedded view quiet', async ({ page }) => {
  await stubApp(page, false);
  let reads = 0;
  await page.route(collectionAPI, async route => {
    reads++;
    await route.fulfill({ status: 401, json: { code: 'auth_no_token' } });
  });
  await page.goto(fullPage);
  const section = page.getByRole('region', { name: 'Shared with you' });
  await expect(section.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin?returnTo=%2Faccount%2Fcollections');
  await expect(section.getByRole('button', { name: 'Try again' })).toHaveCount(0);

  await page.goto(embeddedPage);
  await expect(page.getByRole('navigation', { name: 'Your tea' })).toBeVisible();
  await expect(section).toHaveCount(0);
  expect(reads).toBe(0);
});

test('a denied session exposes neither cached nor returned collection content', async ({ page }) => {
  await stubApp(page);
  const deniedToken = tokenFor('different-recipient');
  await page.route(collectionAPI, route => route.request().headers().authorization === `Bearer ${deniedToken}`
    ? route.fulfill({ status: 403, json: { error: 'Forbidden', collections: [shelf] } })
    : route.fulfill({ json: { collections: [shelf] } }));
  await page.goto(embeddedPage);
  const section = page.getByRole('region', { name: 'Shared with you' });
  await expect(section.getByText(shelf.title)).toBeVisible();

  await page.evaluate(token => {
    localStorage.setItem('teajia_token', token);
    window.dispatchEvent(new Event('teajia:auth-token-changed'));
  }, deniedToken);
  await expect(section.getByRole('alert')).toHaveText('You don’t have access to these collections.');
  await expect(section.getByText(shelf.title)).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('a revoked publication still opens its existing unavailable screen', async ({ page }) => {
  await stubApp(page);
  await page.route(collectionAPI, route => route.fulfill({ json: { collections: [shelf] } }));
  await page.route('**/api/public/c/spring-teas', route => route.fulfill({
    status: 410, json: { error: 'Collection no longer available' },
  }));
  await page.goto(fullPage);
  await page.getByText(shelf.title, { exact: true }).click();
  await expect(page).toHaveURL('/c/spring-teas');
  await expect(page.getByText('This collection has been put away.')).toBeVisible();
});
