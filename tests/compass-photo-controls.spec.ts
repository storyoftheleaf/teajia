import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function uploadPhoto(page: import('@playwright/test').Page) {
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: 'tea.png', mimeType: 'image/png', buffer: image });
}

test('Source photos expose remove and square crop controls without opening a hidden menu', async ({ page }, testInfo) => {
  await installCompassHarness(page);
  await page.route('https://img.test/**', route => route.fulfill({ body: image, contentType: 'image/png' }));
  await openCompass(page);
  await uploadPhoto(page);
  await expect(page.getByRole('button', { name: 'Remove photo 1', exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crop photo 1', exact: true }).filter({ visible: true })).toHaveText('Crop');
  await uploadPhoto(page);
  await expect(page.getByRole('button', { name: 'Remove photo 2', exact: true }).filter({ visible: true })).toBeVisible();
  const thumb = page.getByRole('button', { name: 'View photo 1', exact: true }).filter({ visible: true });
  const box = await thumb.boundingBox();
  expect(box!.width).toBeCloseTo(box!.height, 0);
  await page.screenshot({ path: `/tmp/teajia-photo-controls-${testInfo.project.name.replaceAll(' ', '-').toLowerCase()}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Remove photo 1', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Remove photo 2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove photo 1', exact: true }).filter({ visible: true })).toBeVisible();
});

test('failed square crop upload retains the editor and original photo for retry', async ({ page }) => {
  await installCompassHarness(page);
  await page.route('https://img.test/**', route => route.fulfill({ body: image, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
  await openCompass(page);
  await uploadPhoto(page);
  await page.getByRole('button', { name: 'Crop photo 1', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Crop square photo' })).toBeVisible();
  let refuse = true;
  await page.route('**/api/curate/capture/*/photos/*', route => refuse ? route.fulfill({ status: 503, json: { error: 'Photo upload temporarily unavailable' } }) : route.fallback());
  const save = page.getByRole('button', { name: 'Save square photo', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Photo upload temporarily unavailable', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crop square photo' })).toBeVisible();
  refuse = false;
  await save.click();
  await expect(page.getByRole('heading', { name: 'Crop square photo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove photo 1', exact: true }).filter({ visible: true })).toBeVisible();
});
