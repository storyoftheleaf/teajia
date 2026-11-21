import { test, expect, type Page } from './fixtures';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 6: the owner's side, in Guest notes, in the practice shop. Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-guest-notes.spec.ts`
 * (outside the sandbox). A new member, a sold-out tea, three photographs, a
 * report and a restock request are made each run and taken out at the end.
 */
const SHOTS = 'test-results/practice/guest-notes';
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

async function cleanUp(userId: string, email: string, goneId: string) {
  const db = await practiceDb();
  const photoIds = (db.prepare('SELECT id FROM member_photographs WHERE author_user_id = ?').all(userId) as Array<{ id: string }>).map(r => r.id);
  for (const id of photoIds) {
    db.prepare(`DELETE FROM family_hides WHERE target_kind = 'photograph' AND target_id = ?`).run(id);
    db.prepare(`DELETE FROM family_reports WHERE target_id = ?`).run(id);
  }
  const ids = (db.prepare('SELECT id FROM contributors WHERE user_id = ?').all(userId) as Array<{ id: string }>).map(row => row.id);
  for (const id of ids) {
    db.prepare(`DELETE FROM family_hides WHERE target_kind = 'page' AND target_id = ?`).run(id);
    db.prepare(`DELETE FROM family_reports WHERE target_id = ?`).run(id);
    db.prepare('DELETE FROM contributor_profile_drafts WHERE contributor_id = ?').run(id);
    db.prepare('DELETE FROM contributor_accounts WHERE contributor_id = ?').run(id);
    db.prepare('DELETE FROM contributors WHERE id = ?').run(id);
  }
  const journalIds = (db.prepare('SELECT id FROM customer_tasting_journal WHERE user_id = ?').all(email) as Array<{ id: string }>).map(r => r.id);
  for (const id of journalIds) db.prepare(`DELETE FROM family_hides WHERE target_kind = 'tasting' AND target_id = ?`).run(id);
  db.prepare('DELETE FROM member_tea_covers WHERE author_user_id = ?').run(userId);
  db.prepare('DELETE FROM member_photographs WHERE author_user_id = ?').run(userId);
  db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').run(userId);
  db.prepare('DELETE FROM restock_requests WHERE requester_user_id = ?').run(userId);
  db.prepare('DELETE FROM customer_tasting_journal WHERE user_id = ?').run(email);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM products WHERE id = ?').run(goneId);
  db.close();
}

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

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

test('the owner reads the notes, uses and restores photographs, hides, answers, and downloads the day sheet', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];

  const list = await (await page.request.get('/api/products/public')).json();
  const products = Array.isArray(list) ? list : (list?.products ?? []);
  const product = products[0];
  const productName = String(product.given_name || product.product_name || product.name);

  // A made-up member: words from three days ago and from this moment, a love and a nine.
  const db = await practiceDb();
  const tag = randomBytes(3).toString('hex');
  const email = `noor.${tag}.family@sandbox.local`;
  const userId = `sbx-notes-${tag}`;
  const name = `Noor ${tag}`;
  const goneId = `sbx-gone-${tag}`;
  const accountId = (db.prepare('SELECT account_id FROM products WHERE id = ?').get(product.id) as { account_id: string }).account_id;
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))`)
    .run(userId, email, name, createHash('sha256').update(PASSWORD).digest('hex'));
  db.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams, shown_in_shop)
    VALUES (?, ?, 'Oolong', ?, ?, 1, 'Sold Out', 0, 1)`).run(goneId, accountId, `Gone Tea ${tag}`, `Gone Tea ${tag}`);
  const now = new Date();
  const earlier = new Date(now.getTime() - 3 * 86_400_000);
  const todayWords = `Plum skin and slate ${tag}`;
  const earlierWords = `Thin on the first day ${tag}`;
  db.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES (?, NULL, ?, ?, ?, 9, ?, ?)`).run(`jn-${tag}`, email, product.id, productName,
    JSON.stringify({ rating: 9, verdict: 'love', tasting: { notes: [{ id: 'n-today', text: todayWords, capturedAt: now.toISOString() }] }, updatedAt: now.toISOString() }),
    JSON.stringify([
      { id: 's-old', createdAt: earlier.toISOString(), tasting: { notes: [{ id: 'n-old', text: earlierWords, capturedAt: earlier.toISOString() }] } },
      { id: 's-new', createdAt: now.toISOString(), tasting: { notes: [{ id: 'n-today', text: todayWords, capturedAt: now.toISOString() }] } },
    ]));
  db.close();

  try {
    const memberToken = await tokenFor(page, { identifier: email, password: PASSWORD });
    const memberHeaders = { Authorization: `Bearer ${memberToken}` };
    await page.goto('/');
    const photoIds: string[] = [];
    for (const hue of [20, 140, 260]) {
      const result = await uploadPhotograph(page, memberToken, product.id, hue);
      expect(result.status).toBe(201);
      photoIds.push(result.body.photograph.id);
    }
    // The member frames the first one: upright, the right-hand half of the picture.
    const framed = await page.request.put(`/api/family/photographs/${photoIds[0]}/shape`, {
      headers: memberHeaders,
      data: { shape: 'upright', frame: { crop: { x: 0, y: 0 }, zoom: 2, area: { x: 50, y: 0, width: 50, height: 100 } } },
    });
    expect(framed.status()).toBe(200);
    const shared = await page.request.put(`/api/family/teas/${product.id}/share`, { headers: memberHeaders, data: { share_state: 'offered' } });
    expect(shared.status()).toBe(200);
    const slug = (await shared.json()).page_id as string;
    expect(slug).toBeTruthy();
    // A request for a tea that has gone, and a visitor's report on the page.
    expect((await page.request.post(`/api/family/teas/${goneId}/restock-request`, { headers: memberHeaders, data: { note: 'Please find more' } })).status()).toBe(201);
    expect((await page.request.post('/api/family/reports', { data: { target_kind: 'page', target_id: slug, reason: 'Looks wrong to me' } })).status()).toBe(201);

    // A member cannot read the owner's list.
    expect((await page.request.get('/api/admin/family/feedback', { headers: memberHeaders })).status()).toBe(403);

    const owner = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const ownerPage = await owner.newPage();
    ownerPage.on('pageerror', e => errors.push(e.message));
    const ownerToken = await tokenFor(ownerPage, OWNER);
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    await ownerPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ownerToken);
    await ownerPage.goto('/admin/tasting-notes');
    await expect(ownerPage.getByRole('heading', { name: 'Guest notes' })).toBeVisible({ timeout: 30_000 });

    const photos = ownerPage.getByRole('region', { name: 'Photographs offered' });
    const row = (id: string) => photos.locator(`[data-photograph-id="${id}"]`);
    // The practice shop may hold other people's offered photographs; only this run's three are counted.
    for (const id of photoIds) await expect(row(id)).toHaveCount(1, { timeout: 20_000 });
    await expect(photos.getByText(/\d+ photographs? waiting\./)).toBeVisible();
    // The owner sees the member's own crop, not the middle of the picture: the
    // framed one is upright and its picture is drawn twice as wide, shifted left.
    const framedBox = row(photoIds[0]).locator('.offered-photo');
    await expect(framedBox).toHaveAttribute('data-shape', 'upright');
    const drawn = await framedBox.evaluate(box => {
      const image = box.querySelector('img')!.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      return { ratio: image.width / frame.width, left: (image.left - frame.left) / frame.width, shape: frame.width / frame.height };
    });
    expect(drawn.ratio).toBeCloseTo(2, 1);
    expect(drawn.left).toBeCloseTo(-1, 1);
    expect(drawn.shape).toBeCloseTo(2 / 3, 1);
    // One nobody framed still shows the middle, square.
    const plain = await row(photoIds[1]).locator('.offered-photo').evaluate(box => {
      const image = box.querySelector('img')!.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      return { ratio: image.width / frame.width, shape: frame.width / frame.height };
    });
    expect(plain.ratio).toBeCloseTo(1, 1);
    expect(plain.shape).toBeCloseTo(1, 1);
    await ownerPage.screenshot({ path: `${SHOTS}-1-top.png` });
    await row(photoIds[0]).scrollIntoViewIfNeeded();
    // The thumbnails really load (a broken picture is not a decision the owner can make).
    const thumb = row(photoIds[0]).locator('img');
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await ownerPage.screenshot({ path: `${SHOTS}-2-photographs.png` });

    const teaPhotos = async () => (await (await page.request.get(`/api/family/teas/${product.id}/photographs`)).json());

    // Make the first the lead picture: credited to the person, on the public read.
    const [first, second, third] = photoIds;
    await row(first).getByRole('button', { name: 'Make lead picture' }).click();
    await expect(row(first).getByText('Lead picture', { exact: true })).toBeVisible();
    let publicRead = await teaPhotos();
    expect(publicRead.lead).toMatchObject({ id: first, author: { name, page_id: slug } });
    await ownerPage.screenshot({ path: `${SHOTS}-3-lead.png` });

    // One tap restores the earlier state.
    await row(first).getByRole('button', { name: 'Restore earlier picture' }).click();
    await expect(row(first).getByText('Lead picture', { exact: true })).toHaveCount(0);
    publicRead = await teaPhotos();
    expect(publicRead.lead).toBeNull();

    // Use puts the second on the tea; Pass tucks the third away until asked for.
    await row(second).getByRole('button', { name: 'Use', exact: true }).click();
    await expect(row(second).getByText('On the tea', { exact: true })).toBeVisible();
    expect((await teaPhotos()).placed.map((p: any) => p.id)).toEqual([second]);
    await row(third).getByRole('button', { name: 'Pass', exact: true }).click();
    await expect(row(third)).toHaveCount(0);
    await photos.getByRole('button', { name: /^Show \d+ passed$/ }).click();
    await expect(row(third).getByText('Passed', { exact: true })).toBeVisible();
    await row(third).getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(row(third).getByText('Passed', { exact: true })).toHaveCount(0);

    // One-tap hide on a photograph: gone from the family strip, then back.
    const inStrip = async (id: string) => (await teaPhotos()).family.some((p: any) => p.id === id);
    expect(await inStrip(first)).toBe(true);
    await row(first).getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(row(first).getByText('Hidden', { exact: true })).toBeVisible();
    expect(await inStrip(first)).toBe(false);
    await row(first).getByRole('button', { name: 'Show again' }).click();
    await expect(row(first).getByText('Hidden', { exact: true })).toHaveCount(0);
    expect(await inStrip(first)).toBe(true);

    // A photograph the member removes from their page stays here for the shop.
    expect((await page.request.post(`/api/family/photographs/${third}/remove`, { headers: memberHeaders })).status()).toBe(200);
    await ownerPage.reload();
    await expect(row(third).getByText('Off their page')).toBeVisible({ timeout: 20_000 });
    await ownerPage.screenshot({ path: `${SHOTS}-4-removed-by-author.png` });

    // Reports and "find me more" are on the screen, and each can be acted on.
    const reports = ownerPage.getByRole('region', { name: 'Reports' });
    await expect(reports.getByText(`${name}'s page`)).toBeVisible();
    await expect(reports.getByText('Looks wrong to me')).toBeVisible();
    const restock = ownerPage.getByRole('region', { name: 'Find me more' });
    await expect(restock.getByText(`Gone Tea ${tag}`)).toBeVisible();
    await expect(restock.getByText('Please find more')).toBeVisible();
    await reports.scrollIntoViewIfNeeded();
    await ownerPage.screenshot({ path: `${SHOTS}-5-reports-and-requests.png` });
    await restock.getByRole('button', { name: 'Answered' }).click();
    await expect(restock.getByText(`Gone Tea ${tag}`)).toHaveCount(0);
    await reports.getByRole('button', { name: 'Hide it' }).click();
    await expect(reports.getByText(`${name}'s page`)).toHaveCount(0);
    expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(404);

    // Feedback: every note with the member's own rating, owner only.
    const feedback = ownerPage.getByRole('region', { name: 'Feedback' });
    await feedback.getByRole('button', { name: 'Read every note with its rating' }).click();
    const todayRow = feedback.locator('li').filter({ hasText: todayWords });
    await expect(todayRow).toHaveCount(1);
    await expect(todayRow.getByText('Love, 9 of 10')).toBeVisible();
    await expect(feedback.locator('li').filter({ hasText: earlierWords }).getByText('Love, 9 of 10')).toBeVisible();
    await feedback.scrollIntoViewIfNeeded();
    await ownerPage.screenshot({ path: `${SHOTS}-6-feedback.png` });
    // The page was hidden by the report: the list says so and can show it again.
    await expect(todayRow.getByText('Page hidden')).toBeVisible();
    await todayRow.getByRole('button', { name: 'Show their page' }).click();
    await expect(todayRow.getByText('Page hidden')).toHaveCount(0);
    expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(200);
    // Hide the tasting alone: the page and its photographs stay, the tasting's words go from it.
    const tastedWords = async () => ((await (await page.request.get(`/api/people/${slug}`)).json()).tastings as any[])
      .filter(t => t.product_id === product.id).flatMap(t => t.words.map((w: any) => w.text));
    expect(await tastedWords()).toContain(todayWords);
    await todayRow.getByRole('button', { name: 'Hide this tasting' }).click();
    await expect(todayRow.getByText('Tasting hidden')).toBeVisible();
    expect(await tastedWords()).toEqual([]);
    expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(200);
    await todayRow.getByRole('button', { name: 'Show this tasting' }).click();
    await expect(todayRow.getByText('Tasting hidden')).toHaveCount(0);
    expect(await tastedWords()).toContain(todayWords);
    // The score never reaches the public page.
    const publicPage = await (await page.request.get(`/api/people/${slug}`)).text();
    expect(publicPage).not.toMatch(/"rating"|"verdict"|"impression"/);

    // Today's sheet: a download of today's notes and ratings only.
    await ownerPage.evaluate(() => window.scrollTo(0, 0));
    const [download] = await Promise.all([
      ownerPage.waitForEvent('download'),
      ownerPage.getByRole('button', { name: "Download today's sheet" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^teajia-notes-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await download.path())!, 'utf8').replace(/^﻿/, '');
    console.log('sheet header:', csv.split('\r\n')[0]);
    expect(csv.startsWith('Written,Tea,Person,Note,Impression,Rating out of ten\r\n')).toBe(true);
    expect(csv).toContain(todayWords);
    expect(csv).toContain(name);
    expect(csv).toMatch(new RegExp(`${todayWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},Love,9`));
    expect(csv).not.toContain(earlierWords);
    await expect(ownerPage.getByText('Saved to your downloads.')).toBeVisible();
    await ownerPage.screenshot({ path: `${SHOTS}-7-sheet-saved.png` });

    // No horizontal scroll at phone width, and the owner-only list is closed to the member.
    expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const memberRead = await page.request.get('/api/admin/family/sheet?day=2026-11-19', { headers: memberHeaders });
    expect(memberRead.status()).toBe(403);
    expect(ownerHeaders.Authorization).toBeTruthy();

    expect(errors).toEqual([]);
    await owner.close();
  } finally {
    await cleanUp(userId, email, goneId);
  }
});
