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

    // 1. Nobody has added anything: a signed-out reader sees the page exactly as it was.
    await visitorPage.goto(teaPath);
    await expect(visitorPage.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
    await expect(visitorPage.locator('[data-plate-picture]')).toHaveCount(0);
    await expect(visitorPage.getByTestId('plate-picture')).toHaveCount(0);
    await expect(visitorPage.getByTestId('from-the-family')).toHaveCount(0);
    await expect(visitorPage.getByTestId('own-photographs')).toHaveCount(0);
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

    // 3. Signed out: "From the family" shows Bo's photograph, small copy only, credited. No picture on the plate.
    const mediaRequests: string[] = [];
    visitorPage.on('request', r => { if (r.url().includes('/api/media/')) mediaRequests.push(r.url()); });
    await visitorPage.goto(teaPath);
    const strip = visitorPage.getByTestId('from-the-family');
    await expect(strip).toBeVisible({ timeout: 30_000 });
    await expect(strip.getByTestId('family-photograph')).toHaveCount(1);
    await expect(strip.getByRole('link', { name: members[1].name })).toHaveAttribute('href', `/people/${boPageId}`);
    await expect(visitorPage.getByTestId('plate-picture')).toHaveCount(0);
    await expect(visitorPage.getByTestId('own-photographs')).toHaveCount(0);
    await visitorPage.waitForLoadState('networkidle');
    expect(mediaRequests.filter(url => url.includes('-full.jpg'))).toEqual([]);
    expect(await noOverflow(visitorPage)).toBe(true);
    await strip.scrollIntoViewIfNeeded();
    await visitorPage.screenshot({ path: `${SHOTS}-2-from-the-family.png` });

    // 4. Ana, signed in: her own thumbnails under the plate. Tap one: it is her cover.
    await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ana.token);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(teaPath);
    const row = page.getByTestId('own-photographs');
    await expect(row).toBeVisible({ timeout: 30_000 });
    const thumbs = row.getByTestId('own-photograph');
    await expect(thumbs).toHaveCount(2);
    await expect(page.getByTestId('plate-picture')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}-3-own-thumbnails.png` });
    const tapped = page.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT');
    await thumbs.nth(0).click();
    expect((await tapped).status()).toBe(200);
    const picture = page.getByTestId('plate-picture');
    await expect(picture).toBeVisible();
    await expect(page.locator('[data-plate-picture="cover"]')).toHaveCount(1);
    await expect(picture.locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[0]}-full`));
    await expect(page.getByTestId('own-cover-note')).toContainText('seen only by you');
    await expect(page.getByTestId('plate-credit')).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `${SHOTS}-4-cover-by-tap.png` });

    // It stays on a reload, and nobody else sees it.
    await page.reload();
    await expect(page.getByTestId('plate-picture').locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[0]}-full`), { timeout: 30_000 });
    await visitorPage.reload();
    await expect(visitorPage.getByTestId('from-the-family')).toBeVisible({ timeout: 30_000 });
    await expect(visitorPage.getByTestId('plate-picture')).toHaveCount(0);

    // Dragging the other thumbnail onto the plate swaps the cover.
    // A drag needs a mouse, which the phone emulation does not have, so this step
    // runs in a desktop window (which also shows the wide layout with the strip).
    const desk = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    try {
      const deskPage = await desk.newPage();
      deskPage.on('pageerror', e => errors.push(e.message));
      await deskPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ana.token);
      await deskPage.goto(teaPath);
      await expect(deskPage.getByTestId('plate-picture').locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[0]}-full`), { timeout: 30_000 });
      await deskPage.screenshot({ path: `${SHOTS}-5a-desktop-before-drag.png` });
      await deskPage.getByTestId('own-photograph').nth(1).scrollIntoViewIfNeeded();
      const dragged = deskPage.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT', { timeout: 15_000 });
      const from = await deskPage.getByTestId('own-photograph').nth(1).boundingBox();
      const to = await deskPage.locator('.label-plate').boundingBox();
      await deskPage.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
      await deskPage.mouse.down();
      await deskPage.mouse.move(from!.x + 40, from!.y - 40, { steps: 5 });
      await deskPage.mouse.move(to!.x + to!.width / 2, to!.y + 200, { steps: 15 });
      await deskPage.mouse.up();
      expect((await dragged).status()).toBe(200);
      await expect(deskPage.getByTestId('plate-picture').locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[1]}-full`));
      await deskPage.screenshot({ path: `${SHOTS}-5b-desktop-after-drag.png` });
      expect(await noOverflow(deskPage)).toBe(true);
    } finally {
      await desk.close();
    }
    await page.reload();
    await expect(page.getByTestId('plate-picture').locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[1]}-full`), { timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}-5-cover-by-drag.png` });

    // 5. The owner makes Bo's photograph the lead picture. Signed out, the plate shows it, credited, linking to Bo.
    const ownerPage = await owner.newPage();
    const ownerToken = await tokenFor(ownerPage, OWNER);
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const lead = await ownerPage.request.post(`/api/admin/family/photographs/${boPhoto}/lead`, { headers: ownerHeaders });
    expect(lead.status()).toBe(200);
    await visitorPage.reload();
    const leadPicture = visitorPage.getByTestId('plate-picture');
    await expect(leadPicture).toBeVisible({ timeout: 30_000 });
    await expect(visitorPage.locator('[data-plate-picture="lead"]')).toHaveCount(1);
    await expect(visitorPage.getByTestId('plate-credit')).toContainText('Photograph by');
    await expect(visitorPage.getByTestId('plate-credit').getByRole('link', { name: members[1].name })).toHaveAttribute('href', `/people/${boPageId}`);
    // The lead is not repeated in the family strip.
    await expect(visitorPage.getByTestId('family-photograph')).toHaveCount(0);
    expect(await noOverflow(visitorPage)).toBe(true);
    await visitorPage.evaluate(() => window.scrollTo(0, 0));
    await visitorPage.screenshot({ path: `${SHOTS}-6-lead-with-credit.png` });
    await visitorPage.getByTestId('plate-credit').getByRole('link').click();
    await expect(visitorPage).toHaveURL(new RegExp(`/people/${boPageId}`));

    // Ana's own cover still outranks the lead for her.
    await page.reload();
    await expect(page.getByTestId('plate-picture').locator('img')).toHaveAttribute('src', new RegExp(`${anaOrder[1]}-full`), { timeout: 30_000 });
    await expect(page.getByTestId('plate-credit')).toHaveCount(0);

    // 6. One tap restores the earlier state: no lead; Ana clears her cover; the page is plain again.
    const restored = await ownerPage.request.post(`/api/admin/family/photographs/${boPhoto}/restore`, { headers: ownerHeaders });
    expect(restored.status()).toBe(200);
    const cleared = page.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Back to the original' }).click();
    expect((await cleared).status()).toBe(200);
    // A reload, because the public answer is kept for a few minutes and still holds the lead.
    await page.reload();
    await expect(page.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('plate-picture')).toHaveCount(0);
    await expect(page.getByTestId('own-photograph')).toHaveCount(2);
    await visitorPage.goto(teaPath);
    await expect(visitorPage.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
    await expect(visitorPage.getByTestId('plate-picture')).toHaveCount(0);
    await expect(visitorPage.getByTestId('from-the-family')).toBeVisible();

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
