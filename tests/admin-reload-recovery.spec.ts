import { expect, test } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness } from './helpers/compassHarness';

test('authenticated admin does not reload repeatedly on stale-build recovery signals', async ({ page }) => {
  test.setTimeout(60_000);
  await installCompassHarness(page);
  let versionRequests = 0;
  await page.route('**/version.json*', route => {
    versionRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ buildId: 'intentionally-mismatched-build' }),
    });
  });

  let adminNavigations = 0;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/admin/compass') adminNavigations += 1;
  });

  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  const settledNavigations = adminNavigations;
  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
  await page.waitForTimeout(750);

  expect(versionRequests).toBe(0);
  expect(adminNavigations).toBe(settledNavigations);
  await expectNoUnhandledCompassApi(page);
});
