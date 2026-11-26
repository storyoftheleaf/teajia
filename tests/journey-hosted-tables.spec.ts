// Launch 3, slice J3 (todo/plans/guests-and-tea-masters-launch-3-run.md, hard
// question 1): while anyone may host, the door that made a private sit makes
// a hosted table (the Launch 2 "Host a table" page, by request), and Journey
// lists the old private sits beside the person's hosted tables. With the
// Launch 3 switch off, Journey is exactly as before.
import { expect, test, type Page } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

const journey = '/account/journey';
const oldSit = { id: 'old-sit', role: 'host', date: '2026-11-20', title: 'Morning by the window', description: null,
  tea: { id: null, name: 'Rock tea' }, note: null, invitePending: false };
const hostedTable = {
  id: 'table-1', slug: 'friday-at-bo-s-table-abc', title: "Friday at Bo's table",
  event_date: '2026-12-11T08:00:00.000Z', timezone: 'Asia/Makassar', door: 'request', seats: 4,
  lifecycle_status: 'published', guests: { confirmed: 1, requested: 2, waitlist: 0 },
  link: 'https://www.teajia.com/event/friday-at-bo-s-table-abc',
};

async function signedIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
    sub: 'bo', email: 'bo@example.test', name: 'Bo', role: 'user', memberships: [], active_account_id: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }), 'signature'].join('.');
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), token);
}

/** Set both launch switches for the site only, in one Vite run. */
async function switches(page: Page, { few, anyone }: { few: boolean; anyone: boolean }) {
  await page.route(/\/src\/lib\/fewHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const FEW_HOSTS_OPEN = ${few}; export const fewHostsOpen = () => FEW_HOSTS_OPEN;`,
  }));
  await page.route(/\/src\/lib\/anyoneHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const ANYONE_HOSTS_OPEN = ${anyone}; export const anyoneHostsOpen = () => ANYONE_HOSTS_OPEN;`,
  }));
}

async function mockApi(page: Page, hosting: Record<string, unknown>) {
  const asked: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    asked.push(`${request.method()} ${path}`);
    if (path === '/api/me/journey') return route.fulfill({ status: 403, json: { error: 'Account access denied' } });
    if (path === '/api/me/hosting') return route.fulfill({ json: hosting });
    if (path === '/api/me/tables' && request.method() === 'GET') return route.fulfill({ json: { tables: [hostedTable] } });
    if (path === '/api/me/private-sits') return route.fulfill({ json: { sits: [oldSit] } });
    if (path === `/api/me/private-sits/${oldSit.id}`) return route.fulfill({ json: oldSit });
    if (path === `/api/me/private-sits/${oldSit.id}/photos`) return route.fulfill({ json: { photos: [] } });
    if (['/api/me/kept-setups', '/api/me/personal-kept-setups'].includes(path)) return route.fulfill({ json: { setups: [] } });
    return route.fulfill({ json: [] });
  });
  return asked;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('while anyone may host, the sit door makes a table by request and Journey lists both kinds', async ({ page }) => {
  await signedIn(page);
  await switches(page, { few: true, anyone: true });
  const asked = await mockApi(page, { approved: false, account_id: null, doors: ['request'] });
  await page.goto(journey);

  const section = page.locator('section[aria-labelledby="member-sits-title"]');
  await expect(section.getByRole('heading', { name: 'Sits and tables' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Start a sit' })).toHaveCount(0);
  const list = section.getByTestId('journey-sits-and-tables');
  const items = list.getByRole('listitem');
  await expect(items).toHaveCount(2);
  // Newest first: the table in December, then the old sit in November.
  await expect(items.nth(0)).toContainText("Friday at Bo's table");
  await expect(items.nth(0)).toContainText('1 guest coming, 2 asking');
  await expect(items.nth(0)).toContainText('2026-12-11');
  await expect(items.nth(1)).toContainText('Morning by the window');
  await expect(items.nth(1)).toContainText('2026-11-20');
  await expect(list.getByRole('link', { name: /Friday at Bo's table/ })).toHaveAttribute('href', '/account/host/table-1');
  await noSidewaysScroll(page);

  // The old sit opens where it always did, unchanged.
  await list.getByRole('link', { name: /Morning by the window/ }).click();
  await expect(page).toHaveURL(/\/account\/journey\/sits\/old-sit$/);
  await expect(page.getByRole('heading', { name: 'Morning by the window' })).toBeVisible();
  await page.goBack();

  // The door: the Launch 2 table page, with the by-request door only.
  await section.getByRole('link', { name: 'Host a table' }).click();
  await expect(page).toHaveURL(/\/account\/host$/);
  await expect(page.getByRole('heading', { name: 'Host a table' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'I say yes to each guest' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Anyone with the link has a seat' })).toHaveCount(0);
  await noSidewaysScroll(page);
  expect(asked).not.toContain('POST /api/me/private-sits');
});

test('a stopped host sees their tables and old sits, and no door to make another', async ({ page }) => {
  await signedIn(page);
  await switches(page, { few: true, anyone: true });
  await mockApi(page, { approved: false, account_id: 'bo-chest', doors: null, stopped: true });
  await page.goto(journey);
  const section = page.locator('section[aria-labelledby="member-sits-title"]');
  await expect(section.getByTestId('journey-sits-and-tables').getByRole('listitem')).toHaveCount(2);
  await expect(section.getByRole('link', { name: 'Host a table' })).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Start a sit' })).toHaveCount(0);
  await noSidewaysScroll(page);
});

test('with the Launch 3 switch off, Journey keeps the private sit door and lists sits only', async ({ page }) => {
  await signedIn(page);
  await switches(page, { few: true, anyone: false });
  const asked = await mockApi(page, { approved: true, account_id: 'bo-chest', doors: ['request', 'link'] });
  await page.goto(journey);
  const section = page.locator('section[aria-labelledby="member-sits-title"]');
  await expect(section.getByRole('heading', { name: 'Private sits' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Start a sit' })).toBeVisible();
  await expect(section.getByRole('link', { name: 'Host a table' })).toHaveCount(0);
  await expect(section.getByTestId('journey-sits-and-tables').getByRole('listitem')).toHaveCount(1);
  expect(asked).not.toContain('GET /api/me/tables');
  await noSidewaysScroll(page);
});
