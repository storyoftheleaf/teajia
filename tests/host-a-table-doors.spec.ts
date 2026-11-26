import { expect, test, type Locator, type Page } from './fixtures';
import { openYourTable } from './helpers/navigation';

test.use({ viewport: { width: 390, height: 844 } });

const name = /^Host a table/;
const line = 'Free to host, and your record is yours.';
const hostPath = '/account/host';
const member = { sub: 'bo', email: 'bo@example.test', name: 'Bo', role: 'user', memberships: [], active_account_id: null };

async function mockSite(
  page: Page,
  { few = true, anyone = true, signedIn = true, stopped = false } = {},
) {
  // The Playwright Vite server can exercise all flag combinations in one run.
  await page.route(/\/src\/lib\/fewHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const FEW_HOSTS_OPEN = ${few}; export const fewHostsOpen = () => FEW_HOSTS_OPEN;`,
  }));
  await page.route(/\/src\/lib\/anyoneHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const ANYONE_HOSTS_OPEN = ${anyone}; export const anyoneHostsOpen = () => ANYONE_HOSTS_OPEN;`,
  }));
  if (signedIn) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = [
      encode({ alg: 'HS256', typ: 'JWT' }),
      encode({ ...member, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 }),
      'signature',
    ].join('.');
    await page.addInitScript(token => localStorage.setItem('teajia_token', token), token);
  }

  const hostingRequests: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: member });
    if (path === '/api/me/hosting') {
      hostingRequests.push(path);
      return route.fulfill({
        json: { approved: false, account_id: null, doors: stopped ? null : ['request'], ...(stopped ? { stopped } : {}) },
      });
    }
    return route.fulfill({ json: [] });
  });
  return hostingRequests;
}

async function openLaunchpad(page: Page) {
  await openYourTable(page);
  await expect(page.getByRole('heading', { name: 'Your Table', exact: true })).toBeVisible();
  const existingTile = page.getByRole('button', { name: /^journal/ });
  await expect(existingTile).toBeVisible();
  return existingTile.locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
}

async function noSidewaysScroll(page: Page, panel?: Locator) {
  const overflow = (node: Element) => node.scrollWidth - node.clientWidth;
  expect(await page.locator('html').evaluate(overflow)).toBeLessThanOrEqual(0);
  if (panel) expect(await panel.evaluate(overflow)).toBeLessThanOrEqual(0);
}

test('an eligible host can open the existing host page from Home and Your Table', async ({ page }) => {
  await mockSite(page);
  await page.goto('/');

  const plate = page.getByRole('link', { name });
  await expect(plate).toHaveCount(1);
  await expect(plate.getByText(line, { exact: true })).toBeVisible();
  await expect(plate).toHaveAttribute('href', hostPath);
  await noSidewaysScroll(page);
  await plate.click();
  await expect(page).toHaveURL(/\/account\/host$/);
  await expect(page.getByRole('heading', { name: 'Host a table', exact: true })).toBeVisible();

  await page.goBack();
  await expect(plate).toBeVisible();
  const panel = await openLaunchpad(page);
  const tile = panel.getByRole('button', { name });
  await expect(tile.getByText(line, { exact: true })).toBeVisible();
  await noSidewaysScroll(page, panel);
  await tile.click();
  await expect(page).toHaveURL(/\/account\/host$/);
  await expect(page.getByRole('heading', { name: 'Host a table', exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test('a stopped host sees neither door', async ({ page }) => {
  await mockSite(page, { stopped: true });
  const hosting = page.waitForResponse(response => new URL(response.url()).pathname === '/api/me/hosting');
  await page.goto('/');
  expect(await (await hosting).json()).toMatchObject({ stopped: true, doors: null });
  const panel = await openLaunchpad(page);
  await expect(page.getByRole('link', { name })).toHaveCount(0);
  await expect(panel.getByRole('button', { name })).toHaveCount(0);
  await noSidewaysScroll(page, panel);
});

for (const [flag, flags] of [['Launch 2', { few: false }], ['Launch 3', { anyone: false }]] as const) {
  test(`Home and Your Table keep their existing content with ${flag} off`, async ({ page }) => {
    const hostingRequests = await mockSite(page, flags);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Tea deepens/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'On the table' }).getByRole('link')).toHaveCount(3);
    await expect(page.getByRole('link', { name })).toHaveCount(0);
    const panel = await openLaunchpad(page);
    await expect(panel.getByRole('button', { name })).toHaveCount(0);
    await expect(page.getByText(line, { exact: true })).toHaveCount(0);
    expect(hostingRequests).toEqual([]);
    await noSidewaysScroll(page, panel);
  });
}

test('signed-out Home visitors are sent to sign in with the host page as their return', async ({ page }) => {
  const hostingRequests = await mockSite(page, { signedIn: false });
  await page.goto('/');
  const plate = page.getByRole('link', { name });
  await expect(plate.getByText(line, { exact: true })).toBeVisible();
  await noSidewaysScroll(page);
  await plate.click();
  await expect(page).toHaveURL(url => url.pathname === '/signin' && url.searchParams.get('returnTo') === hostPath);
  expect(hostingRequests).toEqual([]);
});
