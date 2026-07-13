import { expect, test } from '@playwright/test';
import { installCompassHarness } from './helpers/compassHarness';

test('a missing production AdminApp chunk settles without a reload loop', async ({ page }) => {
  test.setTimeout(60_000);
  await installCompassHarness(page);

  let adminChunkRequests = 0;
  let apiRequests = 0;
  let authMeRequests = 0;
  let adminNavigations = 0;

  await page.route('**/assets/AdminApp-*.js', route => {
    adminChunkRequests += 1;
    return route.abort('failed');
  });
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/')) apiRequests += 1;
    if (path === '/api/auth/me') authMeRequests += 1;
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/admin/compass') {
      adminNavigations += 1;
    }
  });

  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  const settledNavigations = adminNavigations;

  // New browsers must never register the cleanup worker. Existing workers
  // still update from /sw.js and self-destruct, but registration itself would
  // create a fresh activation/navigation cycle on every new browser.
  await expect(page.locator('#vite-plugin-pwa\\:register-sw')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);

  expect(adminNavigations).toBe(settledNavigations);
  expect(adminChunkRequests).toBeLessThanOrEqual(8);
  expect(apiRequests).toBeLessThanOrEqual(40);
  expect(authMeRequests).toBeLessThanOrEqual(2);

  // Once the network/chunk is available again, the user-controlled recovery
  // must converge to Admin. Do not keep aborting the chunk after the bounded
  // automatic attempts above.
  await page.unroute('**/assets/AdminApp-*.js');
  await page.getByRole('button', { name: 'Reload Application' }).click();
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  expect(adminNavigations).toBeLessThanOrEqual(settledNavigations + 1);
  // Two normal app boots (initial failure + user-requested recovery) currently
  // perform 24 bounded sync/API reads. Leave a small regression margin while
  // ensuring this can never grow into loop-scale traffic.
  expect(apiRequests).toBeLessThanOrEqual(30);
});

test('production retires existing service workers without registering new ones', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#vite-plugin-pwa\\:register-sw')).toHaveCount(0);

  const registrations = await page.evaluate(async () =>
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
  );
  expect(registrations).toBe(0);

  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  const body = await sw.text();
  expect(body).toContain('self.registration.unregister()');
  expect(body).toContain('self.caches.keys()');
});
