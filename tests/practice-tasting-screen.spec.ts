import { test, expect, type Page } from './fixtures';

/**
 * Stage 2: the tasting screen, in the practice shop. Run with
 * `npx playwright test --config playwright.practice.config.ts tests/practice-tasting-screen.spec.ts`.
 * Signs in through the API and stores the token before the page loads (never the login UI).
 */
const MEMBER = { identifier: 'wei.chen.fixture@sandbox.local', password: 'creator-fixture' };
const SHOTS = 'test-results/practice/tasting-screen';

async function jpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(([w, h]) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#6b4f2a'); gradient.addColorStop(1, '#c9a96a');
    context.fillStyle = gradient; context.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i += 1) { context.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255})`; context.fillRect((i * 97) % w, (i * 61) % h, 40, 40); }
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [width, height] as const);
  return Buffer.from(base64, 'base64');
}

async function signIn(page: Page): Promise<{ token: string; productId: string; productName: string }> {
  const login = await page.request.post('/api/auth/login', { data: MEMBER });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const list = await (await page.request.get('/api/products/public')).json();
  const products = Array.isArray(list) ? list : (list?.products ?? []);
  // A tea this member has not tasted yet (a saved tasting stays), so every run starts from "Add your tasting".
  let product = products[0];
  for (const candidate of products) {
    const mine = await (await page.request.get(`/api/family/teas/${candidate.id}/mine`, { headers: { Authorization: `Bearer ${token}` } })).json();
    if (mine.tasting_share_state === null) { product = candidate; break; }
  }
  await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, token);
  return { token, productId: product.id, productName: String(product.given_name || product.product_name || product.name) };
}

/**
 * The fixture member is the same person on every run, and a person may add only
 * so many photographs in a day. Earlier runs today would use the day up, so the
 * practice database's rows for this fixture are moved two days back first.
 * Local practice database only.
 */
async function freeTheDay(email: string) {
  const { DatabaseSync } = await import('node:sqlite');
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(dir).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
    .map(name => join(dir, name)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 5000');
  db.prepare(`UPDATE member_photographs SET created_at = datetime(created_at, '-2 days')
    WHERE created_at >= datetime('now', '-1 day') AND author_user_id IN (SELECT id FROM users WHERE email = ?)`).run(email);
  db.close();
}

async function clearMine(page: Page, token: string, productId: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const mine = await (await page.request.get(`/api/family/teas/${productId}/mine`, { headers })).json();
  for (const photo of mine.photographs ?? []) await page.request.post(`/api/family/photographs/${photo.id}/remove`, { headers });
}

test('camera beside the microphone, photographs above notes, one tasting, then the Share step', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await freeTheDay(MEMBER.identifier);
  const { token, productId, productName } = await signIn(page);
  await clearMine(page, token, productId);

  await page.goto(`/shop/product/${productId}`);
  await expect(page.getByText(productName).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Add your tasting|your tasting/i }).first().click();

  // The header: microphone and camera side by side.
  const mic = page.getByRole('button', { name: 'Record into your notes' });
  const camera = page.getByRole('button', { name: 'Add a photograph' });
  await expect(mic).toBeVisible();
  await expect(camera).toBeVisible();
  const micBox = (await mic.boundingBox())!; const cameraBox = (await camera.boundingBox())!;
  expect(Math.abs(micBox.y - cameraBox.y), 'camera sits level with the microphone').toBeLessThan(2);
  expect(cameraBox.x).toBeGreaterThan(micBox.x);
  expect(cameraBox.x - (micBox.x + micBox.width), 'camera is beside the microphone').toBeLessThan(4);

  await page.getByRole('button', { name: 'Open your impression' }).click();
  const row = page.getByRole('group', { name: 'Your photographs' });
  await expect(row).toBeVisible();
  const notesLabel = page.getByText('Your notes', { exact: true });
  expect((await row.boundingBox())!.y, 'Your photographs sits above Your notes').toBeLessThan((await notesLabel.boundingBox())!.y);
  await expect(page.getByRole('group', { name: 'Your photographs' }).locator('.tasting-photo-box').getByRole('link', { name: 'How we use photographs' })).toBeVisible();
  await expect(page.getByText('may be shown on Teajia')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'How we use photographs' })).toBeVisible();
  await expect(page.getByText('Notes may be used to help describe the tea and help others learn about it.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}-1-impression-empty.png` });

  // A large picture from the phone: shrunk and re-encoded before it goes up.
  const big = await jpeg(page, 3600, 2400);
  const input = page.getByTestId('tasting-photo-input');
  const upload = page.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST');
  await input.setInputFiles({ name: 'tea.jpg', mimeType: 'image/jpeg', buffer: big });
  const response = await upload;
  expect(response.status()).toBe(201);
  const created = await response.json();
  console.log(`original ${big.length} bytes, stored ${created.photograph.full_width}x${created.photograph.full_height} full, ${created.photograph.small_width}x${created.photograph.small_height} small`);
  expect(Math.max(created.photograph.full_width, created.photograph.full_height)).toBeLessThanOrEqual(2000);
  expect(Math.max(created.photograph.small_width, created.photograph.small_height)).toBeLessThanOrEqual(480);
  await expect(row.locator('img')).toHaveCount(1);

  // The taste page: the same camera, then back to the row.
  await page.getByRole('button', { name: /^Taste/ }).first().click();
  await expect(page.getByRole('group', { name: 'Your photographs' })).toHaveCount(0);
  await input.setInputFiles({ name: 'tea2.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 800, 600) });
  await expect.poll(async () => (await (await page.request.get(`/api/family/teas/${productId}/mine`, { headers: { Authorization: `Bearer ${token}` } })).json()).photographs.length).toBe(2);
  const mine = await (await page.request.get(`/api/family/teas/${productId}/mine`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(mine.photographs.map((p: { page: string }) => p.page).sort()).toEqual(['impression', 'taste']);
  await page.getByRole('button', { name: 'Open your impression' }).click();
  await expect(page.getByRole('group', { name: 'Your photographs' }).locator('img')).toHaveCount(2);

  // A seventh is refused in a plain sentence.
  for (let i = 0; i < 4; i += 1) {
    const done = page.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST');
    await input.setInputFiles({ name: `more${i}.jpg`, mimeType: 'image/jpeg', buffer: await jpeg(page, 640, 480) });
    expect((await done).status()).toBe(201);
  }
  await expect(page.getByRole('group', { name: 'Your photographs' }).locator('img')).toHaveCount(6);
  await input.setInputFiles({ name: 'seventh.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 640, 480) });
  await expect(page.getByRole('alert').filter({ hasText: 'You have six photographs of this tea. Remove one from your page to add another.' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}-2-six-photographs-refused.png` });

  // Remove one from my page; the place is freed.
  // Nothing is written under a thumbnail; tapping one opens it, and the zoom offers the one action.
  await expect(page.getByRole('group', { name: 'Your photographs' })).not.toContainText('Remove from my page');
  await page.getByTestId('tasting-photograph').first().click();
  const firstThumb = page.getByTestId('tasting-photograph').first();
  await expect(firstThumb).toHaveAttribute('data-shape', 'square');
  const shaped = page.waitForResponse(r => r.url().includes('/shape') && r.request().method() === 'PUT');
  // The practice shop's own photographs are files on this machine, so the editor may load them for real.
  await page.route(/\/api\/media\/family-photos\//, route => route.continue());
  await page.getByTestId('photograph-zoom').getByTestId('photograph-crop').click();
  const editor = page.getByRole('dialog', { name: 'Crop photograph' });
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 15_000 });
  await editor.getByRole('button', { name: 'Landscape 3:2' }).click();
  await editor.getByRole('slider', { name: 'Zoom' }).fill('1.5');
  await expect.poll(() => editor.locator('.reactEasyCrop_Image').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(100);
  await page.screenshot({ path: `${SHOTS}-2a-crop-in-the-tasting.png` });
  await editor.getByRole('button', { name: 'Save' }).click();
  expect((await shaped).status()).toBe(200);
  await expect(editor).toHaveCount(0);
  await expect(firstThumb).toHaveAttribute('data-shape', 'across');
  await page.screenshot({ path: `${SHOTS}-2b-zoom-in-the-tasting.png` });
  await page.getByTestId('photograph-zoom').getByRole('button', { name: 'Remove from my page' }).click();
  await expect(page.getByTestId('photograph-zoom')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Your photographs' }).locator('img')).toHaveCount(5);

  // A note, saved, then the Share step with private as the default.
  await page.getByRole('textbox', { name: 'Your notes' }).fill('Soft and sweet after the third steep.');
  await page.getByRole('button', { name: 'Save tasting' }).click();
  const share = page.getByRole('dialog', { name: 'Share this tasting' });
  await expect(share).toBeVisible();
  await expect(share.getByRole('button', { name: 'Keep private' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `${SHOTS}-3-share-step.png` });
  await share.getByRole('button', { name: /offer my photographs/ }).click();
  await share.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(share.getByText('On your page. Your photographs are offered to Teajia.')).toBeVisible({ timeout: 20_000 });
  const after = await (await page.request.get(`/api/family/teas/${productId}/mine`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(after.tasting_share_state).toBe('offered');
  expect(after.photographs.every((p: { share_state: string }) => p.share_state === 'offered')).toBe(true);
  await page.screenshot({ path: `${SHOTS}-4-shared.png` });

  expect(errors).toEqual([]);
  await clearMine(page, token, productId);
});
