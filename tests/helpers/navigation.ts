import { expect, type Page, type Locator } from '@playwright/test';

/**
 * The primary navigation for the current viewport.
 *
 * There are two, and only one is ever on screen: the floating bar is the
 * phone's, and from 1024px up the sidebar is the desk's. The bar used to carry
 * both widths, so tests could reach its controls anywhere; it no longer does,
 * and a test that reaches straight for the bar now hangs on the desk clicking
 * something with display: none.
 */
export function primaryNav(page: Page): Locator {
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  return page.getByTestId(wide ? 'left-sidebar' : 'bottom-tab-bar');
}

/** Opens Your Table from whichever navigation this width is showing. */
export async function openYourTable(page: Page): Promise<void> {
  const trigger = primaryNav(page).locator('button[title="Your Table"], button[aria-label="Your Table"]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
}
