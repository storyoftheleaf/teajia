// tests/read-bottom-bar.spec.ts
// Navigation must stay reachable on the Read section, on the index and on the
// hand-built long-reads. Which navigation depends on the width: the floating
// bar is the phone's, and above 1024px the sidebar is the desk's. The bar used
// to carry both, which put navigation along the bottom edge of a desk screen.
import { test, expect, type Page } from '@playwright/test';

async function expectNavigation(page: Page) {
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  await expect(page.getByTestId(wide ? 'left-sidebar' : 'bottom-tab-bar')).toBeVisible();
  await expect(page.getByTestId(wide ? 'bottom-tab-bar' : 'left-sidebar')).toBeHidden();
}

test('navigation is present on the Read index', async ({ page }) => {
  await page.goto('/read');
  await expectNavigation(page);
});

test('navigation is present on a Read long-read', async ({ page }) => {
  await page.goto('/read/rock-remembers');
  await expectNavigation(page);
});
