import { test, expect, type Page } from './fixtures';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 4: the person's page and the people list, in the practice shop. Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-person-page.spec.ts`
 * (outside the sandbox). A new member, a sold-out tea and the photographs are
 * made each run and taken out again at the end, so the practice shop is as it was.
 */
const SHOTS = 'test-results/practice/person-page';
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
  const ids = (db.prepare('SELECT id FROM contributors WHERE user_id = ?').all(userId) as Array<{ id: string }>).map(row => row.id);
  for (const id of ids) {
    db.prepare(`DELETE FROM family_hides WHERE target_kind = 'page' AND target_id = ?`).run(id);
    db.prepare(`DELETE FROM family_reports WHERE target_id = ?`).run(id);
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
  db.prepare('DELETE FROM products WHERE id = ?').run(goneId);
  db.close();
}

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

/** Both copies of one photograph, made in the browser as a real JPEG (the canvas drops camera data). */
async function uploadPhotograph(page: Page, token: string, productId: string, hue: number) {
  return page.evaluate(async ({ token, productId, hue }) => {
    const make = async (w: number, h: number, quality: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hue} 40% 30%)`); grad.addColorStop(1, `hsl(${hue + 40} 50% 60%)`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.0)';
      return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality));
    };
    const form = new FormData();
    form.append('product_id', productId);
    form.append('full', await make(2000, 1500, 0.7), 'full.jpg');
    form.append('small', await make(480, 360, 0.7), 'small.jpg');
    const response = await fetch('/api/family/photographs', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, body: await response.json() };
  }, { token, productId, hue });
}

test('a shared tasting shows on the person page, the family is listed, sold-out teas are kept, and a hide takes the page away', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  const list = await (await page.request.get('/api/products/public')).json();
  const products = Array.isArray(list) ? list : (list?.products ?? []);
  const product = products[0];
  const productName = String(product.given_name || product.product_name || product.name);

  // A made-up member with two sittings of words on one tea, and a sold-out tea they loved.
  const db = await practiceDb();
  const tag = randomBytes(3).toString('hex');
  const email = `rin.${tag}.family@sandbox.local`;
  const userId = `sbx-person-${tag}`;
  const name = `Rin ${tag}`;
  const goneId = `sbx-gone-${tag}`;
  const accountId = (db.prepare('SELECT account_id FROM products WHERE id = ?').get(product.id) as { account_id: string }).account_id;
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))`)
    .run(userId, email, name, createHash('sha256').update(PASSWORD).digest('hex'));
  db.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams, shown_in_shop)
    VALUES (?, ?, 'Oolong', ?, ?, 1, 'Sold Out', 0, 1)`).run(goneId, accountId, `Gone Tea ${tag}`, `Gone Tea ${tag}`);
  const journal = (id: string, productId: string, label: string, notes: unknown[][]) => db.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES (?, NULL, ?, ?, ?, 9, ?, ?)`).run(id, email, productId, label,
    JSON.stringify({ rating: 9, verdict: 'love', personalNote: 'PRIVATE-WORDS', tasting: {}, updatedAt: new Date().toISOString() }),
    JSON.stringify(notes.map((list, i) => ({ id: `s${i}`, createdAt: `2026-11-1${i}T08:00:00Z`, tasting: { rating: 9, notes: list } }))));
  journal(`j1-${tag}`, product.id, productName, [[{ id: 'n1', text: 'Orchid on the first cup', capturedAt: '2026-11-10T08:05:00Z' }], [{ id: 'n2', text: 'Warmer stone by the fifth', capturedAt: '2026-11-11T08:05:00Z' }]]);
  journal(`j2-${tag}`, goneId, `Gone Tea ${tag}`, [['Lovely while it lasted']]);
  db.close();

  try {
    const token = await tokenFor(page, { identifier: email, password: PASSWORD });
    const headers = { Authorization: `Bearer ${token}` };
    await page.goto('/');
    for (const hue of [20, 140]) {
      const result = await uploadPhotograph(page, token, product.id, hue);
      expect(result.status).toBe(201);
    }
    for (const id of [product.id, goneId]) {
      const shared = await page.request.put(`/api/family/teas/${id}/share`, { headers, data: { share_state: 'page' } });
      expect(shared.status()).toBe(200);
    }
    const slug = `rin-${tag}`;

    // A visitor, signed out, on a phone: the hub, the section, words, small photographs, no score.
    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const visitorPage = await visitor.newPage();
    const imageRequests: string[] = [];
    visitorPage.on('request', r => { if (r.url().includes('/api/media/')) imageRequests.push(r.url()); });
    await visitorPage.goto(`/people/${slug}`);
    await expect(visitorPage.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });
    await expect(visitorPage.getByTestId('hub-tastings')).toBeVisible();
    await expect(visitorPage.getByTestId('hub-pay')).toHaveCount(0);
    const section = visitorPage.getByTestId('profile-tastings');
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText('Orchid on the first cup')).toBeVisible();
    await expect(section.getByText('Warmer stone by the fifth')).toBeVisible();
    await expect(section.getByText('Lovely while it lasted')).toBeVisible();
    await expect(section.getByTestId('tasting-photographs').locator('img')).toHaveCount(2);
    await expect(visitorPage.getByText(/PRIVATE-WORDS|\b9 ?\/ ?10\b|\bLove\b/)).toHaveCount(0);
    await visitorPage.waitForLoadState('networkidle');
    expect(imageRequests.length).toBeGreaterThan(0);
    expect(imageRequests.filter(url => url.includes('-full.jpg'))).toEqual([]);
    expect(imageRequests.every(url => url.includes('-small.jpg'))).toBe(true);
    // No horizontal scroll at phone width.
    expect(await visitorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // The hub cell jumps to the section.
    await visitorPage.getByTestId('hub-tastings').click();
    await expect(section).toBeInViewport();
    await visitorPage.screenshot({ path: `${SHOTS}-1-tastings.png` });
    await visitorPage.screenshot({ path: `${SHOTS}-1b-full-page.png`, fullPage: true });

    // The sold-out tea stays, marked as gone, with one action. Signed out it asks to sign in.
    const gone = section.getByTestId('profile-tasting').filter({ hasText: `Gone Tea ${tag}` });
    await expect(gone.getByText('Gone from the shop.')).toBeVisible();
    await expect(gone.getByTestId('find-me-more')).toHaveCount(1);
    await expect(section.getByTestId('find-me-more')).toHaveCount(1);
    await gone.getByTestId('find-me-more').click();
    await expect(visitorPage).toHaveURL(/\/signin/);

    // Signed in, the same action files the request with the shop.
    await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, token);
    await page.goto(`/people/${slug}`);
    const memberGone = page.getByTestId('profile-tasting').filter({ hasText: `Gone Tea ${tag}` });
    await expect(memberGone).toBeVisible({ timeout: 20_000 });
    const asked = page.waitForResponse(r => r.url().includes('/restock-request'));
    await memberGone.getByTestId('find-me-more').click();
    expect((await asked).status()).toBe(201);
    await expect(memberGone.getByText('Asked. Teajia will look.')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-2-find-me-more.png` });
    const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ownerPage = await owner.newPage();
    const ownerToken = await tokenFor(ownerPage, OWNER);
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const requests = await (await ownerPage.request.get('/api/admin/family/restock-requests?status=open', { headers: ownerHeaders })).json();
    expect(JSON.stringify(requests)).toContain(goneId);

    // The people list: under "This season", "The family", this person in it, no counts.
    const people = await visitor.newPage();
    await people.goto('/people');
    const family = people.getByTestId('people-family');
    await expect(family.getByTestId('family-row').filter({ hasText: name.split(' ')[0] })).toBeVisible({ timeout: 20_000 });
    await expect(family.getByText(/\b\d+ (tastings|teas)\b/)).toHaveCount(0);
    const season = await people.getByText('This season', { exact: true }).boundingBox();
    const familyHead = await family.getByText('The family', { exact: true }).boundingBox();
    expect(familyHead!.y).toBeGreaterThan(season!.y);
    await family.scrollIntoViewIfNeeded();
    await people.screenshot({ path: `${SHOTS}-3-people-family.png` });
    const apiList = await (await page.request.get('/api/people')).json();
    const mine = apiList.contributors.find((c: any) => c.id === slug);
    expect(mine).toMatchObject({ role: 'Teajia family', page_tier: 'family' });
    expect(mine.family_last_active).toBeTruthy();

    // The report line is on a family page, for anyone; the owner hides the page and it is gone.
    await visitorPage.goto(`/people/${slug}`);
    await expect(visitorPage.getByTestId('report-page')).toBeVisible({ timeout: 20_000 });
    const hidden = await ownerPage.request.post('/api/admin/family/hide', { headers: ownerHeaders, data: { target_kind: 'page', target_id: slug } });
    expect(hidden.status()).toBe(200);
    expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(404);
    const afterHide = await (await page.request.get('/api/people')).json();
    expect(afterHide.contributors.map((c: any) => c.id)).not.toContain(slug);
    await visitorPage.goto(`/people/${slug}`);
    await expect(visitorPage.getByRole('heading', { name })).toHaveCount(0);
    await visitorPage.screenshot({ path: `${SHOTS}-4-hidden.png` });
    await people.reload();
    await expect(people.getByTestId('people-directory')).toBeVisible();
    await expect(people.getByText(name.split(' ')[0] + ' ', { exact: false })).toHaveCount(0);
    const unhidden = await ownerPage.request.post('/api/admin/family/unhide', { headers: ownerHeaders, data: { target_kind: 'page', target_id: slug } });
    expect(unhidden.status()).toBe(200);
    expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(200);

    // Stored sizes, printed (checklist 17, in part): the grid asked for the small copies.
    const check = await practiceDb();
    const sizes = check.prepare('SELECT full_bytes, small_bytes FROM member_photographs WHERE author_user_id = ?').all(userId) as Array<{ full_bytes: number; small_bytes: number }>;
    check.close();
    console.log('stored photograph sizes (bytes):', JSON.stringify(sizes));
    expect(sizes.length).toBe(2);
    for (const size of sizes) { expect(size.full_bytes).toBeLessThan(1_000_000); expect(size.small_bytes).toBeLessThan(150_000); }

    expect(errors).toEqual([]);
    await visitor.close();
    await owner.close();
  } finally {
    await cleanUp(userId, email, goneId);
  }
});
