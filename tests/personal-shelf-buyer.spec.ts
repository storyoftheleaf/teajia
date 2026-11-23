import { expect, test, type Page } from '@playwright/test';

const lin = 'lin-chen-fixture';
const shelf = 'lin-shelf-fixture';
const autumn = { id: 'autumn-lot', name: 'Autumn oolong', type: 'Oolong', origin: 'Taiwan', year: 2025, grams: 50, image_url: null };
const spring = { ...autumn, id: 'spring-lot', name: 'Spring oolong', year: 2026, grams: 25, image_url: '/favicon.svg' };
const whatsapp = '12025550123';

// orderable_shelf_slug is emitted only by the Offers eligibility reader at
// integration. These browser responses are synthetic, including all names.
async function fixtures(page: Page, shelfContributor = () => lin) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/people') {
      await route.fulfill({ json: { contributors: [
        { id: lin, display_name: 'Lin Chen', role: 'Tea Master', page_tier: 'master' },
      ] } });
    } else if (path.startsWith('/api/people/')) {
      const id = path.split('/').at(-1);
      await route.fulfill({ json: {
        id, display_name: id === lin ? 'Lin Chen' : 'Other Person', role: 'Tea Master',
        beginnings: 'I buy oolong to share at my table. I have kept a tea journal for many years.',
        collection: { slug: 'lin-collection', title: 'Four teas I return to', item_count: 4 },
        hosting: { slug: 'spring-sit', title: 'Spring tea sit', event_date: '2027-03-20T10:00:00Z' },
        shelf_slug: shelf,
        ...(id === lin && { orderable_shelf_slug: shelf }),
      } });
    } else if (path.startsWith('/api/shelf/')) {
      const slug = path.split('/').at(-1);
      const standalone = slug !== shelf;
      await route.fulfill({ json: {
        slug, title: standalone ? 'Hill Tea Shelf' : 'Lin’s teas',
        seller_name: standalone ? 'Hannah Hill' : 'Lin Chen',
        whatsapp: slug === 'missing-contact' ? 'not-a-number' : whatsapp,
        items: slug === 'empty-shelf' ? [] : [spring, autumn],
        ...(standalone ? {} : { contributor_slug: shelfContributor() }),
      } });
    } else {
      await route.fulfill({ json: {} });
    }
  });
}

test('opens the exact reviewed profile offer and keeps collection, hosting and Back', async ({ page }, testInfo) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/people');
  await page.getByRole('link', { name: /Lin Chen/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/people/${lin}$`));
  const sale = page.getByRole('region', { name: 'Teas for sale' });
  await expect(sale.getByText('50 g available')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the collection Four teas I return to' })).toHaveAttribute('href', '/c/lin-collection');
  await expect(page.getByRole('link', { name: /Hosting Spring tea sit/ })).toHaveAttribute('href', '/event/spring-sit');
  await page.screenshot({ path: testInfo.outputPath('profile.png'), fullPage: true });
  const listing = sale.getByRole('link', { name: /Autumn oolong/ });
  await expect(listing).toHaveAttribute('href', `/u/${shelf}#offer-autumn-lot`);
  await listing.click();
  await expect(page).toHaveURL(new RegExp(`/u/${shelf}#offer-autumn-lot$`));
  const tea = page.getByRole('heading', { name: 'Autumn oolong' });
  await expect(tea).toBeFocused();
  const order = page.getByRole('article').filter({ has: tea }).getByRole('link', { name: 'Order from Lin Chen' });
  const orderURL = new URL((await order.getAttribute('href'))!);
  expect(orderURL.origin + orderURL.pathname).toBe(`https://wa.me/${whatsapp}`);
  expect(orderURL.searchParams.get('text')).toContain('Autumn oolong (2025)');
  await expect(page.getByText('Ask about price').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('shelf.png'), fullPage: true });
  await page.goBack();
  await expect(sale).toBeVisible();
  await sale.getByRole('link', { name: 'View all teas for sale' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${shelf}$`));
  await expect(page.getByRole('heading', { name: 'Lin’s teas' })).toBeVisible();
});

test('keeps an unreviewed mapping off the profile and handles stale links and missing contacts', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => localStorage.setItem('teajia_theme', 'light'));
  await page.goto('/people/unreviewed');
  await expect(page.getByRole('heading', { name: 'Other Person' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Teas for sale' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the collection Four teas I return to' })).toBeVisible();

  await page.goto(`/u/${shelf}#offer-withdrawn`);
  await expect(page.getByRole('status').filter({ hasText: 'This offer is no longer available' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spring oolong' })).toBeVisible();

  await page.goto('/u/missing-contact#offer-autumn-lot');
  await expect(page.getByRole('heading', { name: 'Autumn oolong' })).toBeFocused();
  await expect(page.getByText('WhatsApp orders are currently unavailable.')).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);

  await page.goto('/u/independent-seller');
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.getByRole('heading', { name: 'Hill Tea Shelf' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Order from Hannah Hill' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Tea Master profile/ })).toHaveCount(0);

  await page.goto('/u/empty-shelf');
  await expect(page.getByText('No teas are currently for sale.')).toBeVisible();
});

test('withholds the handoff if a linked shelf resolves to another seller', async ({ page }) => {
  let contributor = lin;
  await fixtures(page, () => contributor);
  await page.goto(`/people/${lin}`);
  const offer = page.getByRole('link', { name: /Autumn oolong/ });
  await expect(offer).toBeVisible();
  contributor = 'wrong-seller';
  await offer.click();
  await expect(page.getByRole('heading', { name: 'Shelf not found' })).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to profile' })).toHaveAttribute('href', `/people/${lin}`);
});
