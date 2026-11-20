import { test, expect, type Page } from './fixtures';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 5: the tea page, in the practice shop. Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-tea-page.spec.ts`
 * (outside the sandbox). Two made-up members and a sold-out tea are created each
 * run and taken out again at the end, so the practice shop is as it was.
 */
const SHOTS = 'test-results/practice/tea-page';
const PASSWORD = 'creator-fixture';
const OWNER = { identifier: 'sandbox', password: 'sandbox' };

async function practiceDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = join(process.cwd(), 'worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(dir).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
    .map(name => join(dir, name)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

async function cleanUp(members: Array<{ userId: string; email: string }>, goneId: string) {
  const db = await practiceDb();
  for (const { userId, email } of members) {
    const ids = (db.prepare('SELECT id FROM contributors WHERE user_id = ?').all(userId) as Array<{ id: string }>).map(row => row.id);
    for (const id of ids) {
      db.prepare(`DELETE FROM family_hides WHERE target_kind = 'page' AND target_id = ?`).run(id);
      db.prepare('DELETE FROM contributor_profile_drafts WHERE contributor_id = ?').run(id);
      db.prepare('DELETE FROM contributor_accounts WHERE contributor_id = ?').run(id);
      db.prepare('DELETE FROM contributors WHERE id = ?').run(id);
    }
    db.prepare('DELETE FROM member_tea_covers WHERE author_user_id = ?').run(userId);
    db.prepare('DELETE FROM member_photographs WHERE author_user_id = ?').run(userId);
    db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').run(userId);
    db.prepare('DELETE FROM restock_requests WHERE requester_user_id = ?').run(userId);
    db.prepare('DELETE FROM customer_tasting_journal WHERE user_id = ?').run(email);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
  db.prepare('DELETE FROM restock_requests WHERE product_id = ?').run(goneId);
  db.prepare('DELETE FROM products WHERE id = ?').run(goneId);
  db.close();
}

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

/** Both copies of one photograph, made in the browser as a real JPEG. */
async function uploadPhotograph(page: Page, token: string, productId: string, hue: number) {
  return page.evaluate(async ({ token, productId, hue }) => {
    const make = async (w: number, h: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hue} 40% 30%)`); grad.addColorStop(1, `hsl(${hue + 40} 50% 60%)`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.7));
    };
    const form = new FormData();
    form.append('product_id', productId);
    form.append('full', await make(2000, 1500), 'full.jpg');
    form.append('small', await make(480, 360), 'small.jpg');
    const response = await fetch('/api/family/photographs', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, body: await response.json() };
  }, { token, productId, hue });
}

test.use({ actionTimeout: 20_000, navigationTimeout: 45_000 });

test('the tea page: plain when nobody has added anything, then the family strip, the lead picture with its credit, the member\'s own cover, and the restock request', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  const list = await (await page.request.get('/api/products/public')).json();
  const products: Array<Record<string, unknown>> = Array.isArray(list) ? list : (list?.products ?? []);
  const product = products.find(p => p.status !== 'Sold Out' && Number(p.stock_grams) > 0 && p.category !== 'ware') ?? products[0];
  const productId = String(product.id);
  const teaPath = `/shop/product/${encodeURIComponent(String(product.slug || product.id))}`;

  const tag = randomBytes(3).toString('hex');
  const members = [
    { userId: `sbx-tea-a-${tag}`, email: `ana.${tag}.tea@sandbox.local`, name: `Ana ${tag}` },
    { userId: `sbx-tea-b-${tag}`, email: `bo.${tag}.tea@sandbox.local`, name: `Bo ${tag}` },
  ];
  const goneId = `sbx-tea-gone-${tag}`;
  const db = await practiceDb();
  const accountId = (db.prepare('SELECT account_id FROM products WHERE id = ?').get(productId) as { account_id: string }).account_id;
  for (const member of members) {
    db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))`)
      .run(member.userId, member.email, member.name, createHash('sha256').update(PASSWORD).digest('hex'));
  }
  db.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams, shown_in_shop)
    VALUES (?, ?, 'Oolong', ?, ?, 1, 'Sold Out', 0, 1)`).run(goneId, accountId, `Gone Tea ${tag}`, `Gone Tea ${tag}`);
  db.close();

  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const visitorPage = await visitor.newPage();
    visitorPage.on('pageerror', e => errors.push(e.message));
    const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

    // 1. Nobody has added anything: the plaque stands alone, with three lines at most
    //    and no photograph in it. The tea's class is set into its border line.
    await visitorPage.goto(teaPath);
    const plaque = visitorPage.locator('.label-plate');
    await expect(plaque).toBeVisible({ timeout: 30_000 });
    await expect(plaque.locator('img')).toHaveCount(0);
    // The tea's class ("Dark tea") sits in the plaque's bottom border line, not among its lines.
    const classMark = plaque.getByTestId('tea-classification');
    const teaClass = (await classMark.innerText()).trim();
    expect(teaClass).toMatch(/ tea$/i);
    const plaqueLines = (await plaque.locator('h1, p:not(.label-plate__class)').allInnerTexts()).map(t => t.trim()).filter(Boolean);
    expect(plaqueLines.length, 'the plaque holds three lines at most').toBeLessThanOrEqual(3);
    expect(plaqueLines.map(t => t.toLowerCase())).not.toContain(teaClass.toLowerCase());
    const emptyPlaqueBox = (await plaque.boundingBox())!;
    expect(emptyPlaqueBox.height, 'the plaque is short on a phone').toBeLessThan(260);
    // The word is centred on the line: the line runs 12px in from the plaque's foot.
    const markBox = (await classMark.locator('span').boundingBox())!;
    const lineY = emptyPlaqueBox.y + emptyPlaqueBox.height - 12;
    expect(Math.abs(markBox.y + markBox.height / 2 - lineY), 'the class sits on the border line').toBeLessThan(3);
    // The line stops for the word: its bottom edge is not drawn under it.
    expect(await plaque.evaluate(el => getComputedStyle(el, '::after').borderBottomColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(visitorPage.getByTestId('tea-photographs')).toHaveCount(0);
    await expect(visitorPage.getByTestId('sold-out-line')).toHaveCount(0);
    await visitorPage.screenshot({ path: `${SHOTS}-1-plain.png` });

    // 2. Ana has two photographs of this tea (private). Bo has one, offered to Teajia.
    await page.goto('/');
    const ana = { ...members[0], token: await tokenFor(page, { identifier: members[0].email, password: PASSWORD }) };
    const bo = { ...members[1], token: await tokenFor(page, { identifier: members[1].email, password: PASSWORD }) };
    const anaPhotos: string[] = [];
    for (const hue of [20, 140]) {
      const result = await uploadPhotograph(page, ana.token, productId, hue);
      expect(result.status).toBe(201);
      anaPhotos.push(result.body.photograph?.id ?? result.body.id);
    }
    // The page lists them newest first; read that order from the server rather than assuming it.
    const mineNow = await (await page.request.get(`/api/family/teas/${productId}/mine`, { headers: { Authorization: `Bearer ${ana.token}` } })).json();
    const anaOrder: string[] = mineNow.photographs.map((p: { id: string }) => p.id);
    expect([...anaOrder].sort()).toEqual([...anaPhotos].sort());
    const boUpload = await uploadPhotograph(page, bo.token, productId, 260);
    expect(boUpload.status).toBe(201);
    const boPhoto: string = boUpload.body.photograph?.id ?? boUpload.body.id;
    const offered = await page.request.put(`/api/family/photographs/${boPhoto}/share`, {
      headers: { Authorization: `Bearer ${bo.token}` }, data: { share_state: 'offered' },
    });
    expect(offered.status()).toBe(200);
    const boPageId: string = (await offered.json()).page_id;
    expect(boPageId).toBeTruthy();

    // 3. Signed out: Bo's photograph is in the row under the plaque, small copy only,
    //    with nothing written on the page. Who took it shows only in the zoom.
    const mediaRequests: string[] = [];
    visitorPage.on('request', r => { if (r.url().includes('/api/media/')) mediaRequests.push(r.url()); });
    await visitorPage.goto(teaPath);
    const visitorRow = visitorPage.getByTestId('tea-photographs');
    await expect(visitorRow).toBeVisible({ timeout: 30_000 });
    await expect(visitorRow.getByTestId('tea-photograph')).toHaveCount(1);
    await expect(visitorPage.getByText('Photograph by')).toHaveCount(0);
    await expect(visitorPage.locator('.label-plate img')).toHaveCount(0);
    await visitorPage.waitForLoadState('networkidle');
    expect(mediaRequests.filter(url => url.includes('-full.jpg'))).toEqual([]);
    expect(await noOverflow(visitorPage)).toBe(true);
    // Every thumbnail is one of the three shapes, and the row sits under the plaque.
    const shapes = await visitorRow.getByTestId('tea-photograph').evaluateAll(els => els.map(el => {
      const box = el.getBoundingClientRect();
      return { shape: el.getAttribute('data-shape'), ratio: Math.round((box.width / box.height) * 100) / 100 };
    }));
    for (const one of shapes) expect([{ shape: 'square', ratio: 1 }, { shape: 'upright', ratio: 0.67 }, { shape: 'across', ratio: 1.5 }]).toContainEqual(one);
    const plaqueBox = (await visitorPage.locator('.label-plate').boundingBox())!;
    expect((await visitorRow.boundingBox())!.y).toBeGreaterThanOrEqual(plaqueBox.y + plaqueBox.height);
    await visitorPage.screenshot({ path: `${SHOTS}-2-row-under-the-plaque.png` });
    await visitorRow.getByTestId('tea-photograph').first().click();
    const visitorZoom = visitorPage.getByTestId('photograph-zoom');
    await expect(visitorZoom).toBeVisible();
    await expect(visitorZoom.getByTestId('photograph-credit')).toContainText('Photograph by');
    await expect(visitorZoom.getByRole('link', { name: members[1].name })).toHaveAttribute('href', `/people/${boPageId}`);
    await expect(visitorZoom.getByTestId('cover-choose')).toHaveCount(0);
    await expect(visitorZoom.getByTestId('photograph-remove')).toHaveCount(0);
    await visitorPage.screenshot({ path: `${SHOTS}-2b-zoom-with-credit.png` });
    await visitorPage.keyboard.press('Escape');
    await expect(visitorZoom).toHaveCount(0);

    // 4. Ana, signed in: her own two sit in the same row as Bo's. Nothing is under a
    //    thumbnail. Tap one and the zoom offers "Use as my cover".
    await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ana.token);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(teaPath);
    const row = page.getByTestId('tea-photographs');
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByTestId('tea-photograph')).toHaveCount(3);
    await expect(row.locator('li[data-mine="true"]')).toHaveCount(2);
    await expect(row.locator('li[data-cover="true"]')).toHaveCount(0);
    await expect(row).not.toContainText(/remove|cover/i);
    await page.screenshot({ path: `${SHOTS}-3-own-in-the-row.png` });
    const rowIds = () => row.getByTestId('tea-photograph').locator('img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).src));
    const openMine = async (id: string) => { await row.locator(`img[src*="${id}-small"]`).click(); };
    await openMine(anaOrder[1]);
    const zoom = page.getByTestId('photograph-zoom');
    await expect(zoom.getByTestId('photograph-zoom-image')).toHaveAttribute('src', new RegExp(`${anaOrder[1]}-full`));
    await expect(zoom.getByTestId('photograph-credit')).toHaveCount(0);
    await expect(zoom.getByRole('button', { name: 'Remove from my page' })).toBeVisible();
    // Square is the default. The zoom offers 2:3 and 3:2; picking one reshapes the thumbnail.
    const thumbRatio = async (id: string) => {
      const box = (await row.locator(`li:has(img[src*="${id}-small"]) [data-testid="tea-photograph"]`).boundingBox())!;
      return Math.round((box.width / box.height) * 100) / 100;
    };
    expect(await thumbRatio(anaOrder[1])).toBe(1);
    // One tap under the photograph: the three shapes as icons. Square is pressed to begin with.
    await expect(zoom.getByTestId('photograph-shape-square')).toHaveAttribute('aria-pressed', 'true');
    const tapped = page.waitForResponse(r => r.url().includes(`/photographs/${anaOrder[1]}/shape`) && r.request().method() === 'PUT');
    await zoom.getByTestId('photograph-shape-upright').click();
    expect((await tapped).status()).toBe(200);
    expect(await thumbRatio(anaOrder[1])).toBe(0.67);
    const back = page.waitForResponse(r => r.url().includes(`/photographs/${anaOrder[1]}/shape`) && r.request().method() === 'PUT');
    await zoom.getByTestId('photograph-shape-square').click();
    expect((await back).status()).toBe(200);
    expect(await thumbRatio(anaOrder[1])).toBe(1);
    // "Crop" opens the editor Curate frames with: square first, 2:3 and 3:2 a tap away.
    // The practice shop's own photographs are files on this machine, so the editor may load them for real.
    await page.route(/\/api\/media\/family-photos\//, route => route.continue());
    await page.screenshot({ path: `${SHOTS}-4-zoom-own.png` });
    const cropTo = async (shapeName: string) => {
      await zoom.getByTestId('photograph-crop').click();
      const editor = page.getByRole('dialog', { name: 'Crop photograph' });
      await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 15_000 });
      // Cancel, the three shapes and Save are one row of icons under the photograph; Rotate sits above Zoom.
      const bar = editor.getByTestId('crop-bar');
      await expect(bar.getByRole('button')).toHaveCount(5);
      const rotateY = (await editor.getByRole('slider', { name: 'Rotation' }).boundingBox())!.y;
      const zoomY = (await editor.getByRole('slider', { name: 'Zoom' }).boundingBox())!.y;
      expect((await bar.boundingBox())!.y).toBeLessThan(rotateY);
      expect(rotateY, 'rotate comes before zoom').toBeLessThan(zoomY);
      await editor.getByRole('button', { name: shapeName }).click();
      await editor.getByRole('slider', { name: 'Zoom' }).fill('1.6');
      await editor.getByRole('slider', { name: 'Rotation' }).fill('4');
      return editor;
    };
    let editor = await cropTo('Landscape 3:2');
    await page.screenshot({ path: `${SHOTS}-4a-crop-editor.png` });
    const reshaped = page.waitForResponse(r => r.url().includes(`/photographs/${anaOrder[1]}/shape`) && r.request().method() === 'PUT');
    await editor.getByRole('button', { name: 'Save' }).click();
    const saved = await reshaped;
    expect(saved.status()).toBe(200);
    const frame = (await saved.json()).photograph.frame;
    expect(frame.zoom).toBe(1.6);
    expect(frame.rotation, 'the straightening is kept').toBe(4);
    // A turned picture sits in its stage, in the row and in the zoom.
    await expect(row.locator(`li:has(img[src*="${anaOrder[1]}-small"]) .photo-stage img`)).toHaveCSS('transform', /matrix/);
    await expect(zoom.locator('.photo-stage [data-testid="photograph-zoom-image"]')).toHaveCount(1);
    expect(frame.area.width, 'zoomed in, less than the whole picture shows').toBeLessThan(70);
    await expect(editor).toHaveCount(0);
    expect(await thumbRatio(anaOrder[1])).toBe(1.5);
    expect(await thumbRatio(anaOrder[0]), 'the other photograph stays square').toBe(1);
    // The thumbnail and the zoom show the framed part: the picture is larger than its box.
    const pictureWider = async (selector: string) => page.locator(selector).evaluate(img => img.getBoundingClientRect().width / img.closest('.photo-thumb, .photo-zoom__picture')!.getBoundingClientRect().width);
    expect(await pictureWider(`li:has(img[src*="${anaOrder[1]}-small"]) [data-testid="tea-photograph"] img`)).toBeGreaterThan(1.4);
    expect(await pictureWider('[data-testid="photograph-zoom-image"]')).toBeGreaterThan(1.4);
    await page.screenshot({ path: `${SHOTS}-4b-zoom-cropped.png` });
    // Opened again, the editor is where she left it, and 2:3 is one more tap.
    editor = await cropTo('Portrait 2:3');
    const again = page.waitForResponse(r => r.url().includes(`/photographs/${anaOrder[1]}/shape`) && r.request().method() === 'PUT');
    await editor.getByRole('button', { name: 'Save' }).click();
    expect((await again).status()).toBe(200);
    await expect(editor).toHaveCount(0);
    expect(await thumbRatio(anaOrder[1])).toBe(0.67);
    const chosen = page.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT');
    await zoom.getByRole('button', { name: 'Use as my cover' }).click();
    expect((await chosen).status()).toBe(200);
    await expect(zoom.getByRole('button', { name: 'Stop using as my cover' })).toBeVisible();
    await expect(zoom, 'no line says who sees a cover').not.toContainText('Only you');
    await page.keyboard.press('Escape');
    // Her cover is now first in her row.
    await expect(row.locator('li').first()).toHaveAttribute('data-cover', 'true');
    expect((await rowIds())[0]).toContain(`${anaOrder[1]}-small`);
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `${SHOTS}-4b-cover-first.png` });

    // It stays on a reload, and nobody else sees it.
    await page.reload();
    await expect(row.locator('li').first()).toHaveAttribute('data-cover', 'true', { timeout: 30_000 });
    await visitorPage.reload();
    await expect(visitorRow.getByTestId('tea-photograph')).toHaveCount(1, { timeout: 30_000 });
    await expect(visitorRow.locator('li[data-cover="true"]')).toHaveCount(0);

    // The wide layout: the same row under the plaque, no sideways scroll.
    const desk = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    try {
      const deskPage = await desk.newPage();
      deskPage.on('pageerror', e => errors.push(e.message));
      await deskPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ana.token);
      await deskPage.goto(teaPath);
      await expect(deskPage.getByTestId('tea-photographs').getByTestId('tea-photograph')).toHaveCount(3, { timeout: 30_000 });
      await expect(deskPage.locator('.label-plate img')).toHaveCount(0);
      expect(await noOverflow(deskPage)).toBe(true);
      await deskPage.screenshot({ path: `${SHOTS}-5-desktop.png` });
    } finally {
      await desk.close();
    }

    // 5. The owner makes Bo's photograph the shop's picture. Signed out it is first in
    //    the row, credited in the zoom, linking to Bo. Still nothing in the plaque.
    const ownerPage = await owner.newPage();
    const ownerToken = await tokenFor(ownerPage, OWNER);
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const lead = await ownerPage.request.post(`/api/admin/family/photographs/${boPhoto}/lead`, { headers: ownerHeaders });
    expect(lead.status()).toBe(200);
    await visitorPage.reload();
    await expect(visitorRow.locator('li[data-lead="true"]')).toHaveCount(1, { timeout: 30_000 });
    // The shop's picture shows once, not again further along the row.
    await expect(visitorRow.getByTestId('tea-photograph')).toHaveCount(1);
    await expect(visitorPage.locator('.label-plate img')).toHaveCount(0);
    expect(await noOverflow(visitorPage)).toBe(true);
    await visitorPage.evaluate(() => window.scrollTo(0, 0));
    await visitorPage.screenshot({ path: `${SHOTS}-6-shop-picture-first.png` });
    await visitorRow.getByTestId('tea-photograph').first().click();
    await visitorPage.getByTestId('photograph-credit').getByRole('link', { name: members[1].name }).click();
    await expect(visitorPage).toHaveURL(new RegExp(`/people/${boPageId}`));

    // Ana's own cover still comes ahead of the shop's picture, for her.
    await page.reload();
    await expect(row.locator('li').first()).toHaveAttribute('data-cover', 'true', { timeout: 30_000 });
    await expect(row.locator('li').nth(1)).toHaveAttribute('data-lead', 'true');

    // 6. One tap restores the earlier state: no shop picture; Ana stops using her cover.
    const restored = await ownerPage.request.post(`/api/admin/family/photographs/${boPhoto}/restore`, { headers: ownerHeaders });
    expect(restored.status()).toBe(200);
    await openMine(anaOrder[1]);
    const cleared = page.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT');
    await zoom.getByRole('button', { name: 'Stop using as my cover' }).click();
    expect((await cleared).status()).toBe(200);
    await page.keyboard.press('Escape');
    // A reload, because the public answer is kept for a few minutes and still holds the lead.
    await page.reload();
    await expect(row.getByTestId('tea-photograph')).toHaveCount(3, { timeout: 30_000 });
    await expect(row.locator('li[data-cover="true"]')).toHaveCount(0);

    // "Remove from my page" is in the zoom. It leaves her row at once.
    await openMine(anaOrder[0]);
    const removed = page.waitForResponse(r => r.url().includes(`/photographs/${anaOrder[0]}/remove`));
    await zoom.getByRole('button', { name: 'Remove from my page' }).click();
    expect((await removed).status()).toBe(200);
    await expect(zoom).toHaveCount(0);
    await expect(row.getByTestId('tea-photograph')).toHaveCount(2);
    await expect(row.locator('li[data-mine="true"]')).toHaveCount(1);
    await visitorPage.goto(teaPath);
    await expect(visitorPage.getByTestId('tea-photographs').getByTestId('tea-photograph')).toHaveCount(1, { timeout: 30_000 });

    // 7. A sold-out tea offers the restock request. Signed out it goes to sign in; signed in it files it.
    const gonePath = `/shop/product/${encodeURIComponent(goneId)}`;
    await visitorPage.goto(gonePath);
    const goneLine = visitorPage.getByTestId('sold-out-line');
    await expect(goneLine).toBeVisible({ timeout: 30_000 });
    await expect(goneLine.getByText('Gone from the shop.')).toBeVisible();
    expect(await noOverflow(visitorPage)).toBe(true);
    await visitorPage.screenshot({ path: `${SHOTS}-7-sold-out-signed-out.png` });
    await goneLine.getByTestId('find-me-more').click();
    await expect(visitorPage).toHaveURL(/\/signin/);

    await page.goto(gonePath);
    const memberLine = page.getByTestId('sold-out-line');
    await expect(memberLine).toBeVisible({ timeout: 30_000 });
    const asked = page.waitForResponse(r => r.url().includes('/restock-request'));
    await memberLine.getByTestId('find-me-more').click();
    expect((await asked).status()).toBe(201);
    await expect(memberLine.getByText('Asked. Teajia will look.')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-8-sold-out-asked.png` });
    const requests = await (await ownerPage.request.get('/api/admin/family/restock-requests?status=open', { headers: ownerHeaders })).json();
    expect(JSON.stringify(requests)).toContain(goneId);

    // An in-stock tea has no sold-out line.
    await page.goto(teaPath);
    await expect(page.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sold-out-line')).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    await visitor.close();
    await owner.close();
    await cleanUp(members, goneId);
  }
});
