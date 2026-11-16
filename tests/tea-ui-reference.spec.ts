import { test, expect } from './fixtures';

test('opens the real Library card and full tasting in the local reference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/tea-ui/');
  await expect(page.getByRole('heading', { name: 'Tea UI reference' })).toBeVisible();
  const library = page.getByRole('region', { name: 'Curate Library tea cards' });
  await expect(library.getByRole('article')).toHaveCount(3);
  const card = library.getByTestId('library-entry-e1');
  await expect(card.getByText('Oil-Paper Tea Brick')).toBeVisible();
  await expect(card.getByRole('group', { name: 'Prices in CNY' })).toBeVisible();

  await card.getByRole('button', { name: 'Edit details for Oil-Paper Tea Brick' }).click();
  const details = page.getByRole('dialog', { name: 'Tea details' });
  await expect(details.getByTestId('library-entry-detail')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Tea name' })).toBeDisabled();
  await details.getByRole('button', { name: 'Close', exact: true }).click();

  await card.getByRole('button', { name: 'Taste Oil-Paper Tea Brick' }).click();
  const tasting = page.locator('[data-tasting-session-overlay]');
  await expect(tasting.getByRole('region', { name: 'Your impression' })).toBeVisible();
  const sections = tasting.getByRole('navigation', { name: 'Tasting sections' });
  for (const name of ['Texture', 'Effect', 'Taste', 'Storage']) {
    await sections.getByRole('button', { name, exact: true }).click();
    await expect(sections.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await tasting.getByRole('button', { name: 'Open your impression' }).click();
  await tasting.getByRole('textbox', { name: 'Your notes' }).fill('Roasted peach');
  await tasting.getByRole('button', { name: 'Save notes' }).click();
  await expect(tasting.getByRole('button', { name: 'Tasting saved' })).toBeVisible();
  await tasting.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Light mode' }).click();
  await expect(page.locator('html')).toHaveClass('light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Open full tasting' }).click();
  await expect(tasting.getByRole('textbox', { name: 'Your notes' })).toHaveValue('Roasted peach');
});
