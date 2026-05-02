import { test } from '@playwright/test';

test('capture full profile page for review', async ({ page }) => {
  await page.goto('/people/chen');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/people-chen-full.png', fullPage: true });

  // Also a screenshot scrolled to the Words section if present
  const wordsHeading = page.getByRole('heading', { name: 'Words' });
  if (await wordsHeading.count() > 0) {
    await wordsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/people-chen-words.png' });
  }
});
