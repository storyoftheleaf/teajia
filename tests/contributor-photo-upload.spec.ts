import { expect, test, type Page } from './fixtures';

// Creating a contributor with photos placed, not linked: the portrait and two
// gallery photos go through the real upload path (POST /api/upload-image),
// the portrait gets a focal point, and the saved payloads carry both. Run on
// Desktop Chrome and Mobile Chrome (390px), since the editor is a phone
// surface too. See docs/CONTRIBUTOR_EDITOR.md.

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'owner-1', email: 'owner@example.test', role: 'owner', active_account_id: 'acct-bali',
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.signature`;

/** A real PNG, so the browser decodes it the way it decodes a phone photo. */
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** What the media route shows for any uploaded key: a tall frame with a mark near the top, like a portrait. */
const SHOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#3a3530"/><circle cx="240" cy="180" r="70" fill="#a8874d"/></svg>`;

async function install(page: Page) {
  const writes: Array<{ method: string; path: string; body: any }> = [];
  let uploads = 0;
  let rows: any[] = [];
  await page.addInitScript(jwt => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }] } }));
  }, token);
  await page.route(/\/api\/media\//, route => route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: SHOWN }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/media/')) return route.fallback();
    if (path === '/api/upload-image' && request.method() === 'POST') {
      uploads += 1;
      return route.fulfill({ status: 201, json: { url: `https://media.teajia.co/accounts/acct-bali/products/upload-${uploads}.jpg?v=1`, key: `upload-${uploads}` } });
    }
    const body = request.postData() ? JSON.parse(request.postData()!) : null;
    if (path === '/api/admin/contributors' && request.method() === 'GET') return route.fulfill({ json: { contributors: rows } });
    if (path === '/api/admin/contributors' && request.method() === 'POST') {
      writes.push({ method: 'POST', path, body });
      const created = { ...body, account_id: 'acct-bali', is_published: 0, links: [], created_at: '2026-09-28', updated_at: '2026-09-28' };
      rows = [created];
      return route.fulfill({ status: 201, json: { contributor: created } });
    }
    if (/\/gallery-images$/.test(path) && request.method() === 'PUT') {
      writes.push({ method: 'PUT', path, body });
      return route.fulfill({ json: { gallery_images: body.gallery_images } });
    }
    if (/\/accounts$/.test(path)) return route.fulfill({ json: { accounts: [] } });
    return route.fulfill({ json: {} });
  });
  return { writes, uploads: () => uploads };
}

test('a contributor is created with an uploaded portrait, its focal point, and gallery photos', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const network = await install(page);

  await page.goto('/admin/contributors');
  await page.getByRole('button', { name: 'Create contributor' }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Create contributor' });
  await expect(dialog).toBeVisible();

  // The page address follows the name until it is edited by hand.
  await dialog.getByLabel('Display name').fill('Shangyin Qiwu');
  await expect(dialog.getByLabel('Page address')).toHaveValue('shangyin-qiwu');

  // The portrait: picked from a file, uploaded, then shown whole with its crops.
  await expect(dialog.getByText('No portrait yet')).toBeVisible();
  await dialog.getByTestId('photo-portrait-file').setInputFiles({ name: 'seated.png', mimeType: 'image/png', buffer: PHOTO });
  const ring = dialog.getByRole('button', { name: /Focal point, 50% across and 50% down/ });
  await expect(ring).toBeVisible();
  await expect(dialog.getByLabel('How the page crops it').first().locator('img')).toHaveCount(3);
  // The whole photo keeps its own width beside the crops. At a 1204px laptop
  // window it once collapsed to a sliver, too narrow to find a face in.
  const whole = dialog.getByRole('img', { name: 'Portrait, whole photo' });
  await expect.poll(async () => (await whole.boundingBox())?.width ?? 0).toBeGreaterThan(150);

  // Move the focal point up and left, by keyboard, the way that works everywhere.
  await ring.focus();
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(dialog.getByRole('button', { name: /Focal point, 40% across and 30% down/ })).toBeVisible();

  // The cover proof redraws from what is in the editor, at the focal point.
  const coverImage = page.getByTestId('page-proof').locator('img').first();
  await expect(coverImage).toHaveAttribute('src', /\/api\/media\/accounts\/acct-bali\/products\/upload-1\.jpg/);
  await expect(coverImage).toHaveCSS('object-position', '40% 30%');

  // Two gallery photos at once, laid out as the page lays them out.
  await dialog.getByTestId('gallery-file').setInputFiles([
    { name: 'hands.png', mimeType: 'image/png', buffer: PHOTO },
    { name: 'cup.png', mimeType: 'image/png', buffer: PHOTO },
  ]);
  await expect(dialog.getByRole('button', { name: /^Photo 1\b/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Photo 2\b/ })).toBeVisible();
  await dialog.getByRole('button', { name: /^Photo 2\b/ }).click();
  await dialog.getByLabel('Gallery photo 2 caption').fill('The second pour.');
  await dialog.getByRole('button', { name: 'Move gallery photo 2 earlier' }).click();
  await expect(dialog.getByRole('button', { name: /^Photo 1, The second pour\./ })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('contributor-photo-upload.png'), fullPage: false });

  await dialog.getByRole('button', { name: 'Save draft' }).click();
  await expect(dialog).toHaveCount(0);

  expect(network.uploads()).toBe(3);
  const created = network.writes.find(write => write.method === 'POST')!.body;
  expect(created).toMatchObject({
    id: 'shangyin-qiwu',
    display_name: 'Shangyin Qiwu',
    portrait_url: 'https://media.teajia.co/accounts/acct-bali/products/upload-1.jpg?v=1',
    portrait_focus: '40% 30%',
  });
  const gallery = network.writes.find(write => write.method === 'PUT' && write.path.endsWith('/gallery-images'))!.body.gallery_images;
  expect(gallery.map((image: any) => image.caption)).toEqual(['The second pour.', null]);
  expect(gallery).toHaveLength(2);
  // Nothing was published: the create saved a draft only.
  expect(network.writes.some(write => write.path.endsWith('/publish'))).toBe(false);
  expect(errors.filter(message => !/401|403/.test(message))).toEqual([]);
});

test('the whole photo stays wide enough to find a face at laptop width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome', 'a laptop window is a desktop case');
  await page.setViewportSize({ width: 1204, height: 900 });
  await install(page);
  await page.goto('/admin/contributors');
  await page.getByRole('button', { name: 'Create contributor' }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Create contributor' });
  await dialog.getByTestId('photo-portrait-file').setInputFiles({ name: 'seated.png', mimeType: 'image/png', buffer: PHOTO });
  const whole = dialog.getByRole('img', { name: 'Portrait, whole photo' });
  await expect.poll(async () => (await whole.boundingBox())?.width ?? 0).toBeGreaterThan(150);
  await page.screenshot({ path: testInfo.outputPath('laptop-width.png') });
});

test('a failed upload says so and can be tried again without choosing the file twice', async ({ page }) => {
  const network = await install(page);
  let failed = false;
  await page.route('**/api/upload-image', route => {
    if (!failed) { failed = true; return route.fulfill({ status: 500, json: { error: 'fixture failure' } }); }
    return route.fallback();
  });
  await page.goto('/admin/contributors');
  await page.getByRole('button', { name: 'Create contributor' }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Create contributor' });
  await dialog.getByTestId('photo-portrait-file').setInputFiles({ name: 'seated.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(dialog.getByText('The photo did not arrive.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByRole('button', { name: /Focal point/ })).toBeVisible();
  expect(network.uploads()).toBe(1);
});
