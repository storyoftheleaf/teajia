import { expect, test } from './fixtures';

// A story photograph is framed in the one shared photo editor, the same one
// Curate and the people editor open: the ruler, the quarter turn, the shapes.
// The old tools on the frame (a dot to drag, a zoom slider) are gone, and a
// photograph placed with them still shows exactly where it was put.

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'owner-1', email: 'owner@example.test', role: 'owner', active_account_id: 'acct-bali',
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.signature`;

/** A wide table photograph stand-in, with a mark off-centre. */
const SHOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#3a3530"/><circle cx="380" cy="300" r="110" fill="#a8874d"/></svg>`;
const SEED = '/api/media/story/table.jpg';
const OLD = { url: SEED, crop: { scale: 1.4, x: 0.3, y: 0.2 } };

test('a story photograph is framed in the shared photo editor', async ({ page }, testInfo) => {
  const drafts: any[] = [];
  let uploads = 0;
  await page.addInitScript(jwt => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }] } }));
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/media/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: SHOWN });
    if (path === '/api/upload-image' && request.method() === 'POST') {
      uploads += 1;
      return route.fulfill({ status: 201, json: { url: `/api/media/story/framed-${uploads}.jpg` } });
    }
    if (/\/api\/story-content\/[^/]+\/draft$/.test(path) && request.method() === 'PUT') {
      drafts.push(JSON.parse(request.postData()!).content);
      return route.fulfill({ json: { ok: true } });
    }
    if (path.startsWith('/api/story-content/')) return route.fulfill({ json: { photos: { table: OLD } } });
    if (path.startsWith('/api/products/public') || path.startsWith('/api/rates')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });

  await page.goto('/');
  const frame = page.locator('[data-frame-slot="table"]');
  const picture = frame.locator('img');
  // Placed with the old tools, it still shows where it was put.
  await expect(picture).toHaveAttribute('src', SEED);
  await expect(picture).toHaveCSS('object-position', '30% 20%');
  expect(await picture.evaluate(img => (img as HTMLElement).style.transform)).toBe('scale(1.4)');

  await page.getByTitle('Owner editing').click();
  const edit = page.getByTestId('story-photo-edit');
  await expect(edit).toBeVisible();
  // The old tools are gone from the frame.
  await expect(page.locator('[data-focal-dot]')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(0);

  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Edit photo' });
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 15_000 });
  await expect(editor.getByTestId('crop-dial-rotation')).toBeVisible();
  await expect(editor.getByRole('group', { name: 'Photo frame shape' }), 'a frame that fills its space offers the shapes').toBeVisible();
  await editor.getByRole('slider', { name: 'Rotation' }).fill('3');
  await page.screenshot({ path: testInfo.outputPath('story-photo-editor.png') });
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toHaveCount(0);

  // What is saved: the framed picture, resting at the middle, with the
  // untouched picture and the editor's settings kept beside it.
  await expect(picture).toHaveAttribute('src', '/api/media/story/framed-1.jpg');
  await expect.poll(() => drafts.length, { timeout: 5_000 }).toBeGreaterThan(0);
  const saved = drafts.at(-1).photos.table;
  expect(saved).toMatchObject({ url: '/api/media/story/framed-1.jpg', crop: { scale: 1, x: 0.5, y: 0.5 }, original: SEED });
  expect(saved.frame.rotation).toBe(3);
  expect(uploads).toBe(1);

  // Opened again, the editor is on the untouched picture, where it was left.
  await edit.click();
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 15_000 });
  await expect(editor.getByRole('slider', { name: 'Rotation' })).toHaveValue('3');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await page.screenshot({ path: testInfo.outputPath('story-photo-framed.png') });
});
