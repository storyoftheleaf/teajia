import { expect, test, type Page } from './fixtures';

async function openAdvise(page: Page) {
  await page.goto('/advise', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'The Spaces to Share' })).toBeVisible();
}

test('shows the three services and the sub-ledger, live rows linked and soon rows not', async ({ page }) => {
  await openAdvise(page);

  await expect(page.getByRole('heading', { name: 'The Spaces to Share' })).toBeVisible();
  await expect(page.getByText('Tea House Design & Curation', { exact: true })).toBeVisible();
  await expect(page.getByText('Tea Curation & Sourcing', { exact: true })).toBeVisible();
  await expect(page.getByText('Sessions & Guidance', { exact: true })).toBeVisible();

  await expect(page.getByRole('link', { name: /For Your Space/i })).toHaveAttribute('href', '/for-your-space');

  await expect(page.getByText('Selected Projects', { exact: true })).toBeVisible();
  await expect(page.getByText('Sourcing Journeys', { exact: true })).toBeVisible();
  await expect(page.getByText('Upcoming Sessions', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/advise?v=projects"]')).toHaveCount(0);
  await expect(page.locator('a[href="/events"]')).toHaveCount(0);
});

test('stays within mobile width and leaves the locked bottom bar unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdvise(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);

  const bottomBar = page.getByTestId('bottom-tab-bar');
  await expect(bottomBar).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Read' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Craft' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Advise' })).toHaveAttribute('aria-current', 'page');
  await expect(bottomBar.getByRole('button', { name: 'Shop' })).toBeVisible();
});

test('opens the inquiry form with the sourcing interest pre-ticked from a sub-ledger row', async ({ page }) => {
  await openAdvise(page);
  await page.getByText('For a Collection', { exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await page.getByRole('button', { name: 'Tell us more (optional)' }).click();
  await expect(page.getByLabel('Tea sourcing')).toBeChecked();
});

test('the lead cover opens the inquiry form', async ({ page }) => {
  await openAdvise(page);
  await page.getByRole('button', { name: 'Start a conversation', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
});
