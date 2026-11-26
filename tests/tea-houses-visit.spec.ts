import { expect, test } from './fixtures';
import { CORS } from './shared/media-stub';
import { openTeaHouses } from './helpers/launch4Switches';

// The Visit list: one list from GET /api/network/stores, each house opening
// its own page. Mocked directory of three houses, and of none, on a phone.
// Visit opens with the rest of Tea Houses (TEA_HOUSES_OPEN, A4 review, finding
// 12), so these serve the switch open (tests/helpers/launch4Switches.ts); the
// closed case is in tests/tea-house-portfolio.spec.ts.
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => { await openTeaHouses(page); });

const ahead = new Date(Date.now() + 5 * 86_400_000).toISOString();

const THREE = [
  {
    id: 'a', slug: 'bamboo-house', name: 'Bamboo House', tagline: 'Oolong by the rice fields',
    location_city: 'Ubud', location_country: 'Indonesia',
    cover_image_url: 'https://images.test/bamboo.jpg', logo_url: null,
    next_session: { slug: 'morning-oolongs', title: 'Morning oolongs', event_date: ahead },
  },
  {
    id: 'b', slug: 'cedar-room', name: 'Cedar Room', tagline: null,
    location_city: 'Taipei', location_country: 'Taiwan',
    cover_image_url: null, logo_url: null, next_session: null,
  },
  {
    id: 'c', slug: 'stone-table', name: 'Stone Table', tagline: 'A long table in the hills',
    location_city: null, location_country: 'Japan',
    cover_image_url: 'https://images.test/stone.jpg', logo_url: null, next_session: null,
  },
];

async function directory(page: import('@playwright/test').Page, rows: unknown[]) {
  await page.route(/\/api\/network\/stores$/, route => route.fulfill({ headers: CORS, json: rows }));
  await page.route(/images\.test\//, route => route.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
  }));
}

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test('three houses: name, place, photograph when there is one, the coming session, each opening its page', async ({ page }) => {
  await directory(page, THREE);
  await page.goto('/tea-houses/visit');

  await expect(page.getByRole('heading', { level: 1, name: 'Find a tea house' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Tea houses' });
  const rows = list.getByRole('listitem');
  await expect(rows).toHaveCount(3);

  const bamboo = rows.nth(0);
  await expect(bamboo.getByRole('heading', { name: 'Bamboo House' })).toBeVisible();
  await expect(bamboo.getByText('Ubud, Indonesia')).toBeVisible();
  await expect(bamboo.locator('img')).toHaveCount(1);
  await expect(bamboo.getByTestId('house-next-session')).toContainText('Morning oolongs');
  await expect(bamboo.getByRole('link')).toHaveAttribute('href', '/store/bamboo-house');

  const cedar = rows.nth(1);
  await expect(cedar.getByText('Taipei, Taiwan')).toBeVisible();
  await expect(cedar.locator('img')).toHaveCount(0);
  await expect(cedar.getByTestId('house-next-session')).toHaveCount(0);
  await expect(cedar.getByRole('link')).toHaveAttribute('href', '/store/cedar-room');

  await expect(rows.nth(2).getByText('Japan', { exact: true })).toBeVisible();
  await expect(rows.nth(2).getByRole('link')).toHaveAttribute('href', '/store/stone-table');

  // Houses, not tables; and nothing that looks like a store locator.
  await expect(page.getByTestId('tea-houses-visit')).not.toContainText(/near you|distance|\bkm\b/i);
  await expect(page.getByText(/Find a table/)).toHaveCount(0);
  await noHorizontalOverflow(page);

  await rows.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/store\/bamboo-house$/);
});

test('no houses: one plain sentence and a link to the sessions', async ({ page }) => {
  await directory(page, []);
  await page.goto('/tea-houses/visit');

  const empty = page.getByTestId('visit-empty');
  await expect(empty).toContainText('No tea houses are open to visitors yet.');
  await expect(empty.getByRole('link', { name: 'See the sessions' })).toHaveAttribute('href', '/events');
  await expect(page.getByRole('list', { name: 'Tea houses' })).toHaveCount(0);
  await noHorizontalOverflow(page);
});
