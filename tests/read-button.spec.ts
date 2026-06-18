// tests/read-button.spec.ts
// The bottom-nav "Read" button must land on /read (the unified Read section),
// not the legacy /magazine listing.
import { test, expect } from '@playwright/test';

test('the Read nav button navigates to /read', async ({ page }) => {
  await page.goto('/');
  const readBtn = page.getByRole('button', { name: 'Read', exact: true });
  await expect(readBtn).toBeVisible();
  await readBtn.click();
  await expect(page).toHaveURL(/\/read$/);
  await expect(page.getByRole('heading', { name: 'The Craft of Tea' })).toBeVisible();
});
