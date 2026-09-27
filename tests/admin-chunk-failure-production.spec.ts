import { expect, test } from './fixtures';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { installCompassHarness } from './helpers/compassHarness';

test('a missing production AdminApp chunk settles without a reload loop', async ({ page }) => {
  test.setTimeout(60_000);
  await installCompassHarness(page);

  let adminChunkRequests = 0;
  let apiRequests = 0;
  let authMeRequests = 0;
  let adminNavigations = 0;
  let boot = 0;
  const apiRequestsByBoot: Record<string, Record<string, number>> = {};

  // Both spellings of the same module. A build serves it as
  // /assets/AdminApp-<hash>.js; the dev server serves it unbundled as
  // /src/admin/AdminApp.tsx. With only the built pattern the abort never
  // matched here, the admin loaded perfectly, and the test waited thirty
  // seconds for an error boundary that had no reason to appear.
  for (const pattern of ['**/assets/AdminApp-*.js', '**/src/admin/AdminApp.tsx*']) {
    await page.route(pattern, route => {
      adminChunkRequests += 1;
      return route.abort('failed');
    });
  }
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/')) {
      apiRequests += 1;
      const key = String(boot);
      apiRequestsByBoot[key] ??= {};
      apiRequestsByBoot[key][path] = (apiRequestsByBoot[key][path] ?? 0) + 1;
    }
    if (path === '/api/auth/me') authMeRequests += 1;
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/admin/compass') {
      adminNavigations += 1;
      boot = adminNavigations;
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
  // Both spellings again: leaving the dev one in place kept the recovery
  // failing for the same reason the first load did.
  await page.unroute('**/assets/AdminApp-*.js');
  await page.unroute('**/src/admin/AdminApp.tsx*');
  await page.getByRole('button', { name: 'Reload Application' }).click();
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  await page.waitForTimeout(2_000);
  expect(adminNavigations).toBeLessThanOrEqual(settledNavigations + 1);

  const failedBootCounts = apiRequestsByBoot[String(settledNavigations)] ?? {};
  const recoveryBoot = settledNavigations + 1;
  const recoveredCounts = apiRequestsByBoot[String(recoveryBoot)] ?? {};
  const count = (counts: Record<string, number>, path: string) => counts[path] ?? 0;
  const bootTotal = (counts: Record<string, number>) => Object.values(counts).reduce((sum, value) => sum + value, 0);

  // The failed shell makes 17 reads and user-triggered Admin recovery makes
  // 34 on Desktop; Mobile CI reproduced the same 51-call total. On recovery,
  // samples runs 4 times, sample sets 3 times, products 6 times, and every
  // other endpoint at most twice. These per-boot budgets
  // allow normal hydration while catching a repeated boot or endpoint retry;
  // the old single 48-call ceiling mixed the two different phases and failed
  // at a stable 50–51 with no navigation, auth or chunk retry loop.
  expect(bootTotal(failedBootCounts)).toBeLessThanOrEqual(20);
  expect(bootTotal(recoveredCounts)).toBeLessThanOrEqual(40);
  expect(apiRequests).toBeLessThanOrEqual(60);
  expect(count(recoveredCounts, '/api/auth/refresh')).toBeLessThanOrEqual(2);
  expect(count(recoveredCounts, '/api/auth/me')).toBeLessThanOrEqual(1);
  expect(count(recoveredCounts, '/api/admin/samples')).toBeLessThanOrEqual(4);
  expect(count(recoveredCounts, '/api/admin/sample-sets')).toBeLessThanOrEqual(3);
  expect(count(recoveredCounts, '/api/products')).toBeLessThanOrEqual(6);
  expect(count(recoveredCounts, '/api/rates')).toBeLessThanOrEqual(2);
  expect(count(recoveredCounts, '/api/customers')).toBeLessThanOrEqual(2);
  expect(count(recoveredCounts, '/api/accounts/acct-bali')).toBeLessThanOrEqual(2);
  expect(count(recoveredCounts, '/api/admin/events')).toBeLessThanOrEqual(2);

  // A completed recovery must settle. A hidden reload/refetch loop continues
  // growing traffic even when its individual requests fit one boot's budget.
  const settledApiRequests = apiRequests;
  // Longer than React Query's 1/2/4-second retry backoff so delayed retries
  // have time to show up before the no-growth assertion.
  await page.waitForTimeout(10_000);
  expect(apiRequests).toBe(settledApiRequests);
});

test('production retires existing service workers without registering new ones', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#vite-plugin-pwa\\:register-sw')).toHaveCount(0);

  const registrations = await page.evaluate(async () =>
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
  );
  expect(registrations).toBe(0);

  // The worker only exists in a build: the dev server has no /sw.js and answers
  // this request with the application shell, so fetching it over HTTP asserted
  // against index.html. Read what the build actually produced, the way the
  // China policy check next door already does.
  const body = await readFile(path.resolve('dist/sw.js'), 'utf8');
  expect(body).toContain('self.registration.unregister()');
  expect(body).toContain('self.caches.keys()');
});
