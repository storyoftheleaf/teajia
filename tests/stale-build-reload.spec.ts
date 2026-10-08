import { expect, test } from './fixtures';

// After a deploy, a tab opened on the old build asks for page files that no
// longer exist. On 2026-10-06 that put "Something went wrong" in front of a
// reader on /read/porcelain-and-tea, who had to press Reload. Now the page
// loads the newer build itself, once, and the error screen never shows.

test('a page whose files were replaced by a deploy reloads into the new build', async ({ page }) => {
  let blocked = 0;

  const sawErrorScreen: string[] = [];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The deploy lands while the tab is open: only now does the server say newer.
  await page.route(/\/version\.json/, route => route.fulfill({ json: { buildId: 'a-newer-build' } }));
  await page.evaluate(() => { sessionStorage.removeItem('versionReloadAt'); });

  // The home page may have fetched it already; the next request for the page's
  // own module fails, as a replaced file does.
  await page.route(/\/src\/pages\/ContributorsIndexPage\.tsx/, async route => {
    if (blocked === 0) {
      blocked += 1;
      return route.abort('failed');
    }
    return route.continue();
  });
  const reloaded = page.waitForEvent('load', { timeout: 20_000 });
  await page.evaluate(() => { window.history.pushState({}, '', '/people'); window.dispatchEvent(new PopStateEvent('popstate')); });

  // Poll for the error screen while the recovery happens.
  const watch = setInterval(async () => {
    try {
      if (await page.getByText('Something went wrong').count()) sawErrorScreen.push('shown');
    } catch { /* page is mid-reload */ }
  }, 100);
  await reloaded;
  clearInterval(watch);

  expect(blocked).toBe(1);
  expect(sawErrorScreen).toEqual([]);
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});
