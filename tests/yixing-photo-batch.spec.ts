import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const base = '/admin/yixing';
const path = base + '/photo-batch';
const photo = (role: string, value: string) => ({
  role, sha256: value.repeat(64), originalSha256: 'f'.repeat(64),
});
const changes = [
  { potId: 'pots-12', slot: 0, before: photo('Front', 'a'), after: photo('Front', 'b') },
  { potId: 'pots-23', slot: 1, before: photo('Side', 'c'), after: photo('Side', 'd') },
  { potId: 'pots-33', slot: 0, before: photo('Front', 'e'), after: photo('Underside', 'f'), needsReview: true },
];
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==', 'base64');

test('applies routine photo replacements together and keeps the flagged photo pending across reload', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await injectAuth(page);
  await mockInventoryApi(page);

  const id = '9'.repeat(64);
  let pending = changes;
  let galleryReads = 0;
  await page.route('**/api/admin/yixing', route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (request.method() === 'HEAD') return route.fulfill({ status: 200 });
    galleryReads++;
    return route.fulfill({ json: { pots: [], reference: { title: '', scope: '', entries: [] }, decisions: {} } });
  });
  await page.route('**/api/admin/yixing/media/*.jpg', route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    return route.fulfill({ contentType: 'image/png', body: image });
  });
  await page.route('**/api/admin/yixing/photo-batch', route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (request.method() !== 'PUT') return route.fulfill({ json: { id, changes: pending } });
    expect(request.postDataJSON()).toEqual({
      id, selections: [{ potId: 'pots-12', slot: 0 }, { potId: 'pots-23', slot: 1 }],
    });
    pending = pending.filter(change => change.needsReview);
    return route.fulfill({ json: { applied: 2 } });
  });

  await page.goto(base);
  await page.getByRole('link', { name: 'Review photo replacements' }).click();
  await expect(page).toHaveURL(url => url.pathname === path);
  await expect(page.getByRole('heading', { name: 'Compare photo replacements' })).toBeVisible();
  const flagged = page.getByRole('checkbox', { name: 'Select replacement for Pot 33, photo 1' });
  await expect(flagged).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Apply selected photos' })).toBeDisabled();
  const photoButton = page.getByRole('button', { name: 'Enlarge Pot 12, photo 1, proposed front' });
  await expect(photoButton).toBeEnabled();
  await photoButton.click();
  await expect(page.getByRole('dialog', { name: 'Image of Pot 12, photo 1, proposed front' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photoButton).toBeFocused();

  await page.getByRole('button', { name: 'Select routine changes' }).click();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2);
  await expect(flagged).not.toBeChecked();
  const readsBeforeApply = galleryReads;
  await page.getByRole('button', { name: 'Apply 2 replacements' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Applied 2 replacements.' })).toBeVisible();
  await expect.poll(() => galleryReads).toBeGreaterThan(readsBeforeApply);
  await expect(page.getByRole('checkbox')).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(flagged).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Select routine changes' })).toBeDisabled();
  await flagged.check();
  await expect(page.getByRole('button', { name: 'Apply 1 replacement' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
