// tests/read-bottom-bar.spec.ts
// The bottom nav bar must stay visible on the Read section — both the index
// and the hand-built long-reads.
import { test, expect } from '@playwright/test';

test('bottom nav bar is present on the Read index', async ({ page }) => {
  await page.goto('/read');
  await expect(page.getByTestId('bottom-tab-bar')).toBeVisible();
});

test('bottom nav bar is present on a Read long-read', async ({ page }) => {
  await page.goto('/read/rock-remembers');
  await expect(page.getByTestId('bottom-tab-bar')).toBeVisible();
});
