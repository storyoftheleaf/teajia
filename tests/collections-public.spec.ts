/**
 * Public collection page (/c/:slug) smoke.
 *
 * Phase 1 coverage: the route mounts, renders without JS errors, has no
 * horizontal overflow, and handles the missing-slug case gracefully (shows
 * the "Not found." editorial state, not the router's 404).
 *
 * Happy-path rendering with a seeded publication is a later-phase fixture.
 */

import { test, expect } from './fixtures';

const UNKNOWN_SLUG = 'definitely-not-a-real-slug-xyz9';

test.describe('/c/:slug — public collection page', () => {
  test('unknown slug renders the editorial not-found state without overflow or errors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // The page's answer to an unknown slug is driven by the API's 404. The
    // browser suite runs against a server whose API points at itself, so an
    // unmocked call answers with the application shell instead: the page saw a
    // 200 of HTML, could not read it, and rendered the error boundary the test
    // is specifically asserting against. Say what the API would say.
    await page.route('**/api/public/c/**', route => route.fulfill({
      status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }),
    }));

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`/c/${UNKNOWN_SLUG}`, { waitUntil: 'domcontentloaded' });
    // Let React render and the fetch settle.
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();

    // No router-level 404, no error boundary.
    expect(bodyText.toLowerCase()).not.toContain('page not found');
    expect(bodyText.toLowerCase()).not.toContain('something went wrong');

    // Should land on either the not-found or gone editorial state.
    const onEditorialState =
      bodyText.toLowerCase().includes('not found') ||
      bodyText.toLowerCase().includes('put away');
    expect(onEditorialState, 'Expected the editorial not-found / put-away copy').toBe(true);

    // No horizontal overflow.
    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(overflows, 'Horizontal overflow on /c/:slug').toBe(false);

    // No unexpected console errors — allow expected 404 API call.
    const filtered = consoleErrors.filter(e =>
      !e.includes('404') &&
      !e.includes('Not found') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('favicon')
    );
    expect(filtered, 'Unexpected console errors').toHaveLength(0);
    expect(pageErrors, 'Unhandled page errors').toHaveLength(0);
  });
});
