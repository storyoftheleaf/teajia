import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';
import type { SquarePhotoFrame } from '../src/lib/cropImage';

type Photo = { original: Buffer; preview?: Buffer; frame: SquarePhotoFrame | null };
async function photoServer(page: Page) {
  await installCompassHarness(page);
  const photos = new Map<string, Photo>();
  const state = { refuse: false, uploads: 0, frameWrites: 0, originalReads: 0, readGate: null as Promise<void> | null, corrupt: false };
  await page.route('**/api/curate/capture/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const match = url.pathname.match(/^(\/api\/curate\/capture\/[^/]+\/photos\/[^/]+)(\/frame)?$/);
    if (!match) return route.fallback();
    const path = match[1], photo = photos.get(path);
    if (request.method() === 'POST') {
      const form = await new Response(new Uint8Array(request.postDataBuffer()!), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      photos.set(path, { original: Buffer.from(await (form.get('file') as File).arrayBuffer()), frame: null });
      state.uploads += 1;
      return route.fulfill({ status: 201, json: { url: path } });
    }
    if (!photo) return route.fulfill({ status: 404 });
    if (match[2]) {
      if (request.method() === 'GET') return route.fulfill({ json: { frame: photo.frame } });
      state.frameWrites += 1;
      if (state.refuse) return route.fulfill({ status: 503, json: { error: 'Framing could not be saved. Retry.' } });
      const form = await new Response(new Uint8Array(request.postDataBuffer()!), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      photo.frame = JSON.parse(String(form.get('frame')));
      photo.preview = Buffer.from(await (form.get('file') as File).arrayBuffer());
      return route.fulfill({ json: { ok: true } });
    }
    if (url.searchParams.has('original')) state.originalReads += 1;
    await state.readGate;
    if (state.corrupt) return route.fulfill({ body: 'invalid image bytes', contentType: 'image/jpeg' });
    return route.fulfill({ body: url.searchParams.has('original') ? photo.original : photo.preview ?? photo.original, contentType: 'image/jpeg' });
  });
  return { photos, state };
}

async function uploadWidePhoto(page: Page, portrait = false) {
  const data = await page.evaluate(portrait => {
    const canvas = document.createElement('canvas'); canvas.width = portrait ? 300 : 600; canvas.height = portrait ? 600 : 300;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#607050'; context.fillRect(0, 0, canvas.width / 3, canvas.height);
    context.fillStyle = '#c9b78a'; context.fillRect(canvas.width / 3, 0, canvas.width / 3, canvas.height);
    context.fillStyle = '#564530'; context.fillRect(canvas.width * 2 / 3, 0, canvas.width / 3, canvas.height);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  }, portrait);
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: 'tea.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') });
}

const frameButton = (page: Page, number = 1) => page.getByRole('button', { name: `Frame photo ${number}`, exact: true }).filter({ visible: true }).first();

test('clicking a photo opens reversible square framing; a small corner X removes the photo', async ({ page }, testInfo) => {
  const server = await photoServer(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Reversible photo framing');
  await uploadWidePhoto(page);
  const photo = frameButton(page);
  const deletion = page.getByRole('button', { name: 'Delete photo 1', exact: true }).filter({ visible: true });
  await expect(photo).toBeVisible(); await expect(deletion).toHaveText('');
  const imageBox = await photo.boundingBox(), deleteBox = await deletion.boundingBox();
  expect(imageBox!.width).toBeCloseTo(imageBox!.height, 0);
  expect(imageBox!.height).toBe(64);
  expect(deleteBox!.width).toBe(20);
  expect(deleteBox!.height).toBe(20);
  expect(deleteBox!.y).toBeLessThan(imageBox!.y);
  expect(deleteBox!.x + deleteBox!.width).toBeGreaterThan(imageBox!.x + imageBox!.width);
  await expect(page.getByRole('button', { name: /Remove photo|Crop photo/ })).toHaveCount(0);
  await uploadWidePhoto(page);
  await page.getByRole('button', { name: 'Delete photo 2', exact: true }).filter({ visible: true }).click();
  await expect(frameButton(page, 2)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('small-corner-remove.png') });
  const [path, original] = [...server.photos.entries()][0];
  const originalBytes = Buffer.from(original.original);
  await page.getByRole('button', { name: 'Save changes to this tea' }).filter({ visible: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/, visible: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Files and change history', exact: true })).toHaveCount(0);
  await expect(page.getByText('1 photo saved', { exact: true })).toHaveCount(0);
  await photo.click();
  const dialog = page.getByRole('dialog', { name: 'Frame photo', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save framing' })).toBeEnabled();
  const cropArea = dialog.locator('.reactEasyCrop_CropArea');
  const initialSize = (await cropArea.boundingBox())!.width;
  const rotation = dialog.getByLabel('Rotation', { exact: true });
  await expect(rotation).toHaveAttribute('type', 'range');
  await rotation.focus();
  for (let i = 0; i < 20; i += 1) await rotation.press('ArrowRight');
  await expect(rotation).toHaveValue('2');
  const twoDegrees = (await cropArea.boundingBox())!.width;
  expect(twoDegrees).toBeLessThan(initialSize);
  for (let i = 0; i < 10; i += 1) await rotation.press('ArrowRight');
  await expect(rotation).toHaveValue('3');
  expect((await cropArea.boundingBox())!.width).toBeLessThan(twoDegrees);
  const crop = dialog.locator('.reactEasyCrop_Container');
  const box = (await crop.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  await dialog.getByRole('button', { name: 'Save framing' }).click();
  await expect(dialog).toHaveCount(0);
  expect(server.photos.get(path)!.original).toEqual(originalBytes);
  expect(server.photos.get(path)!.frame?.zoom).toBe(1);
  expect(server.photos.get(path)!.frame?.rotation).toBe(3);
  expect(server.photos.get(path)!.frame?.crop.x).not.toBe(0);
  expect(server.state.uploads).toBe(2);
  await expect.poll(() => photo.locator('img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1600, 1600]);
  await page.reload();
  await page.getByRole('tab', { name: 'Library', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Photos for Reversible photo framing', exact: true }).click();
  await expect(dialog.getByLabel('Zoom')).toHaveValue('1');
  await expect(dialog.getByLabel('Rotation', { exact: true })).toHaveValue('3');
  await expect(dialog.locator('.reactEasyCrop_Image')).toHaveJSProperty('naturalWidth', 600);
  expect(server.state.originalReads).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('reversible-square-frame.png') });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect([...server.photos.keys()][0]).toBe(path);
  expect(server.photos.get(path)!.original).toEqual(originalBytes);
});

test('a failed framing save keeps the original and square position for retry', async ({ page }) => {
  const server = await photoServer(page);
  await openCompass(page); await uploadWidePhoto(page); await frameButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Frame photo', exact: true });
  const save = dialog.getByRole('button', { name: 'Save framing', exact: true });
  await expect(save).toBeEnabled();
  await dialog.getByLabel('Zoom').focus(); await dialog.getByLabel('Zoom').press('End');
  server.state.refuse = true; await save.click();
  await expect(dialog.getByText('Framing could not be saved. Retry.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Zoom')).toHaveValue('4');
  expect([...server.photos.values()][0].frame).toBeNull();
  server.state.refuse = false; await save.click();
  await expect(dialog).toHaveCount(0);
  expect(server.state.frameWrites).toBe(2); expect(server.state.uploads).toBe(1);
  expect([...server.photos.values()][0].frame?.zoom).toBe(4);
});

test('square, portrait and landscape choices reopen after reload without changing the original', async ({ page }, testInfo) => {
  const server = await photoServer(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Aspect presets tea');
  await uploadWidePhoto(page);
  await expect(frameButton(page)).toBeVisible();
  const [path, photo] = [...server.photos.entries()][0];
  const original = Buffer.from(photo.original);
  await page.getByRole('button', { name: 'Save changes to this tea' }).filter({ visible: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/, visible: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Library', exact: true }).filter({ visible: true }).click();
  const open = page.getByRole('button', { name: 'Photos for Aspect presets tea', exact: true });
  for (const preset of [
    { label: 'Portrait 2:3', aspect: 2 / 3, dimensions: [1066, 1599] },
    { label: 'Landscape 3:2', aspect: 3 / 2, dimensions: [1599, 1066] },
    { label: 'Square', aspect: 1, dimensions: [1600, 1600] },
  ]) {
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Frame photo', exact: true });
    await expect(dialog.getByRole('button', { name: 'Save framing', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: preset.label, exact: true }).click();
    await expect(dialog.getByRole('button', { name: preset.label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => { const box = await dialog.locator('.reactEasyCrop_CropArea').boundingBox(); return box!.width / box!.height; }).toBeCloseTo(preset.aspect, 2);
    await page.screenshot({ path: testInfo.outputPath(`frame-${preset.aspect === 1 ? 'square' : preset.aspect < 1 ? 'portrait' : 'landscape'}.png`) });
    await dialog.getByRole('button', { name: 'Save framing', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => open.locator('img').evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual(preset.dimensions);
    expect(server.photos.get(path)!.original).toEqual(original);
    expect(server.photos.get(path)!.frame?.aspect).toBe(preset.aspect);
    await page.reload();
    await page.getByRole('tab', { name: 'Library', exact: true }).filter({ visible: true }).click();
    await open.click();
    await expect(dialog.getByRole('button', { name: preset.label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByLabel('Zoom')).toHaveValue('1');
    await expect(dialog.locator('.reactEasyCrop_Image')).toHaveJSProperty('naturalWidth', 600);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(server.state.uploads).toBe(1);
  expect(server.state.frameWrites).toBe(3);
});


test('new portrait uploads start square and mixed thumbnail shapes keep one height', async ({ page }, testInfo) => {
  const server = await photoServer(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Mixed thumbnail frames');
  await uploadWidePhoto(page, true);
  const first = frameButton(page);
  await expect(first).toBeVisible();
  await expect(first.locator('img')).toHaveJSProperty('naturalHeight', 600);
  const square = (await first.boundingBox())!;
  expect(square.width).toBeCloseTo(square.height, 1);
  expect(await first.locator('img').evaluate(image => getComputedStyle(image).objectFit)).toBe('cover');
  expect(server.state.frameWrites).toBe(0);
  await first.click();
  const dialog = page.getByRole('dialog', { name: 'Frame photo', exact: true });
  await expect(dialog.getByRole('button', { name: 'Square', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Save framing' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Portrait 2:3', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save framing' }).click();
  await expect(dialog).toHaveCount(0);
  await uploadWidePhoto(page);
  await frameButton(page, 2).click();
  await expect(dialog.getByRole('button', { name: 'Save framing' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Landscape 3:2', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save framing' }).click();
  await expect(dialog).toHaveCount(0);
  await uploadWidePhoto(page, true);
  await expect(frameButton(page, 3)).toBeVisible();
  await expect.poll(async () => {
    const boxes = await Promise.all([1, 2, 3].map(index => frameButton(page, index).boundingBox()));
    return boxes.map(box => Math.round(box!.width / box!.height * 100));
  }).toEqual([67, 150, 100]);
  const boxes = (await Promise.all([1, 2, 3].map(index => frameButton(page, index).boundingBox()))).map(box => box!);
  expect(Math.max(...boxes.map(box => box.height)) - Math.min(...boxes.map(box => box.height))).toBeLessThan(0.5);
  expect(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y))).toBeLessThan(0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mixed-same-height-thumbnails.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save changes to this tea' }).filter({ visible: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/, visible: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Library', exact: true }).filter({ visible: true }).click();
  const mini = page.getByRole('button', { name: 'Photos for Mixed thumbnail frames', exact: true }).getByTestId('library-photo-thumb');
  await expect.poll(async () => { const box = await mini.boundingBox(); return Math.round(box!.width / box!.height * 100); }).toBe(67);
});


test('photo loading and failed image decoding never expose a broken image', async ({ page }, testInfo) => {
  const server = await photoServer(page);
  let release!: () => void;
  server.state.readGate = new Promise<void>(resolve => { release = resolve; });
  await openCompass(page);
  await uploadWidePhoto(page, true);
  const first = frameButton(page).locator('img');
  await expect(frameButton(page)).toBeVisible();
  await expect.poll(() => first.evaluate(image => getComputedStyle(image).visibility)).toBe('hidden');
  await page.screenshot({ path: testInfo.outputPath('photo-loading-placeholder.png') });
  release();
  await expect(first).toBeVisible();
  await expect(first).toHaveJSProperty('naturalHeight', 600);
  server.state.corrupt = true;
  await uploadWidePhoto(page);
  const second = frameButton(page, 2).locator('img');
  await expect(frameButton(page, 2)).toBeVisible();
  await expect.poll(() => second.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 0)).toBe(true);
  await expect.poll(() => second.evaluate(image => getComputedStyle(image).visibility)).toBe('hidden');
  await expect(frameButton(page, 2)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('photo-failed-placeholder.png') });
});
