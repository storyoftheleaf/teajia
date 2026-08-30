// tests/read-button.spec.ts
// The "Read" control in whichever navigation the width is showing must land on
// /read (the unified Read section), not the legacy /magazine listing.
import { test, expect } from '@playwright/test';

test('the Read nav button navigates to /read', async ({ page }) => {
  await page.goto('/');
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  const nav = page.getByTestId(wide ? 'left-sidebar' : 'bottom-tab-bar');
  // The sidebar spells Read as a real link, the phone bar as a button.
  const readBtn = nav.getByRole(wide ? 'link' : 'button', { name: 'Read', exact: true });
  await expect(readBtn).toBeVisible();
  await readBtn.click();
  await expect(page).toHaveURL(/\/read$/);
  await expect(page.getByRole('heading', { name: 'The Art of Tea' })).toBeVisible();
});
