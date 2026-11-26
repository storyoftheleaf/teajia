import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { CORS } from './shared/media-stub';

// Tea houses as Adrian's portfolio (Launch 4, K5 part two), with mocked
// routes, on a phone. Closed until Adrian ships Launch 4: with
// VITE_TEA_HOUSES_OPEN=true on the site these walk a house's page and Work;
// without it they prove the addresses lead to Visit.
test.use({ viewport: { width: 390, height: 844 } });

const open = process.env.VITE_TEA_HOUSES_OPEN === 'true';

const UBUD = { slug: 'ubud-house', name: 'Ubud House', place: 'Ubud, Indonesia' };
const CANGGU = { slug: 'canggu-house', name: 'Canggu House', place: 'Canggu, Indonesia' };
const PAGE = {
  house: UBUD,
  parts: [
    { part: 'room', words: 'I drew the room around one long table, with the kettle where every guest can see it.', photographs: ['https://media.teajia.co/uploads/room-1.jpg', 'https://media.teajia.co/uploads/room-2.jpg'] },
    { part: 'sourcing', words: 'I still send the oolong each spring.', photographs: [] },
  ],
};
const WORK = {
  houses: [
    { ...CANGGU, photograph: null },
    { ...UBUD, photograph: 'https://media.teajia.co/uploads/room-1.jpg' },
  ],
};

async function prepare(page: Page) {
  await page.route(/\/api\/tea-houses\/work$/, route => route.fulfill({ headers: CORS, json: WORK }));
  await page.route(/\/api\/tea-houses\/work\/ubud-house$/, route => route.fulfill({ headers: CORS, json: PAGE }));
  await page.route(/\/api\/tea-houses\/work\/[^/]+$/, route => route.request().url().endsWith('/ubud-house')
    ? route.fallback()
    : route.fulfill({ status: 404, headers: CORS, json: { error: 'Not found', code: 'not_found' } }));
  await page.route(/\/api\/network\/stores$/, route => route.fulfill({ headers: CORS, json: [] }));
}

async function noHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

const NOTHING_COUNTED = /\b\d+\s+(houses?|parts?|likes?|views?)\b|curated|master|rank|score/i;

test.describe('the tea house portfolio, closed', () => {
  test.skip(open, 'The portfolio is open on this site');

  test('its addresses lead to Visit', async ({ page }) => {
    await prepare(page);
    for (const path of ['/tea-houses', '/tea-houses/work', '/tea-houses/work/ubud-house', '/tea-houses/build']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/tea-houses\/visit$/);
    }
  });
});

test.describe('the tea house portfolio, open', () => {
  test.skip(!open, 'The portfolio is closed; run with VITE_TEA_HOUSES_OPEN=true');

  test('a house page leads with his parts in his words, with photographs, only the parts he named', async ({ page }) => {
    await prepare(page);
    await page.goto('/tea-houses/work/ubud-house');
    await expect(page.getByRole('heading', { level: 1, name: 'Ubud House' })).toBeVisible();
    await expect(page.getByText('Ubud, Indonesia')).toBeVisible();
    const parts = page.getByTestId('house-part');
    await expect(parts).toHaveCount(2);
    await expect(parts.nth(0).getByRole('heading', { name: 'The room and its layout' })).toBeVisible();
    await expect(parts.nth(0)).toContainText('one long table');
    await expect(parts.nth(0).locator('img')).toHaveCount(2);
    await expect(parts.nth(1).getByRole('heading', { name: 'The sourcing since' })).toBeVisible();
    await expect(parts.nth(1).locator('img')).toHaveCount(0);
    // The parts he did not name are not there at all.
    for (const missing of ['The teaware', 'The tea menu', 'Training those who pour', 'The opening sessions']) {
      await expect(page.getByRole('heading', { name: missing })).toHaveCount(0);
    }
    await expect(page.getByRole('link', { name: 'Visit Ubud House' })).toHaveAttribute('href', '/store/ubud-house');
    await expect(page.getByTestId('tea-house-page')).not.toContainText(NOTHING_COUNTED);
    await noHorizontalOverflow(page);
  });

  test('a house with no shown page says so plainly and points to Visit', async ({ page }) => {
    await prepare(page);
    await page.goto('/tea-houses/work/somewhere-else');
    await expect(page.getByText('This house has no page here.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a tea house to visit' })).toHaveAttribute('href', '/tea-houses/visit');
  });

  test('Work lists the houses in his order, each opening its page, with nothing counted', async ({ page }) => {
    await prepare(page);
    await page.goto('/tea-houses/work');
    const houses = page.getByTestId('work-house');
    await expect(houses).toHaveCount(2);
    await expect(houses.nth(0)).toContainText('Canggu House');
    await expect(houses.nth(1)).toContainText('Ubud House');
    await expect(houses.nth(0)).toHaveAttribute('href', '/tea-houses/work/canggu-house');
    await expect(houses.nth(0).locator('img')).toHaveCount(0);
    await expect(houses.nth(1).locator('img')).toHaveCount(1);
    await expect(page.getByTestId('tea-houses-work')).not.toContainText(NOTHING_COUNTED);
    await noHorizontalOverflow(page);

    await houses.nth(1).click();
    await expect(page).toHaveURL(/\/tea-houses\/work\/ubud-house$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ubud House' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/tea-houses\/work$/);
  });

  test('Work with nothing shown says one sentence and points to Visit', async ({ page }) => {
    await prepare(page);
    await page.route(/\/api\/tea-houses\/work$/, route => route.fulfill({ headers: CORS, json: { houses: [] } }));
    await page.goto('/tea-houses/work');
    await expect(page.getByTestId('work-empty')).toContainText('Nothing is shown here yet.');
    await expect(page.getByTestId('work-house')).toHaveCount(0);
  });

  test('Visit links a house to its portfolio page only when it has one', async ({ page }) => {
    await prepare(page);
    await page.route(/\/api\/network\/stores$/, route => route.fulfill({ headers: CORS, json: [
      { id: 'a', slug: 'ubud-house', name: 'Ubud House', tagline: null, location_city: 'Ubud', location_country: 'Indonesia', cover_image_url: null, logo_url: null, next_session: null },
      { id: 'b', slug: 'cedar-room', name: 'Cedar Room', tagline: null, location_city: 'Taipei', location_country: 'Taiwan', cover_image_url: null, logo_url: null, next_session: null },
    ] }));
    await page.goto('/tea-houses/visit');
    const links = page.getByTestId('house-portfolio-link');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute('href', '/tea-houses/work/ubud-house');
    await noHorizontalOverflow(page);
  });
});
