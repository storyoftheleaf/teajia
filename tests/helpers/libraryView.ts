import { expect, type Page } from '@playwright/test';

/**
 * The Library's View & sort sheet. Since the 2026-10-25 redesign the List/Photos
 * switch and the Transferred view live in it, behind the sort button, instead of
 * sitting in the control bar. Each choice closes the sheet.
 */
export async function openViewAndSort(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'View & sort' });
  // A click that lands while the previous drawer's backdrop is still fading out
  // reaches the backdrop, not the button, so open until the sheet is really open.
  await expect(async () => {
    await page.getByTestId('library-controls').filter({ visible: true }).getByTitle('Sort within each supplier').click();
    await expect(sheet).toHaveAttribute('data-state', 'open', { timeout: 1500 });
  }).toPass({ timeout: 10_000 });
  await expect(sheet).toBeInViewport();
  return sheet;
}

/**
 * The sheet is a Vaul drawer: on close it reports data-state="closed" at once and
 * then slides away, staying in the DOM (and visible to Playwright) meanwhile.
 */
async function sheetClosed(sheet: ReturnType<Page['getByRole']>) {
  await expect(sheet).toHaveAttribute('data-state', 'closed');
  await expect(sheet).not.toBeInViewport();
}

/** Switch between List and Photos. */
export async function toggleLibraryPhotos(page: Page) {
  const sheet = await openViewAndSort(page);
  await sheet.getByRole('button', { name: /^(Photos|List)$/ }).click();
  await sheetClosed(sheet);
}

/** Show the Transferred teas (true) or go back to the active Library (false). */
export async function showTransferred(page: Page, transferred: boolean) {
  // The Transferred view announces itself with a line under the controls, so the
  // current view is read off the page and the sheet opens only to change it.
  const note = page.getByText(/^Transferred to Inventory\./).filter({ visible: true });
  if ((await note.count()) > 0 === transferred) return;
  const sheet = await openViewAndSort(page);
  await sheet.getByRole('button', { name: /^(Transferred · \d+|Back to all Library)$/ }).click();
  await sheetClosed(sheet);
  if (transferred) await expect(note).toBeVisible();
  else await expect(note).toHaveCount(0);
}

/**
 * Rejected teas have their own view since the redesign: the active views (All,
 * To taste, Chosen) leave them out, and the Rejected button shows only them.
 */
export async function showRejected(page: Page, rejected: boolean) {
  const toggle = page.getByTestId('library-controls').filter({ visible: true }).getByRole('button', { name: /^Rejected/ });
  if ((await toggle.getAttribute('aria-pressed')) !== String(rejected)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(rejected));
}
