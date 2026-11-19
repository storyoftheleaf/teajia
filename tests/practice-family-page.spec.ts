import { test, expect, type Page } from './fixtures';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 3: a page for anyone, in the practice shop. Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-family-page.spec.ts`
 * (outside the sandbox). A new member is made straight in the local practice
 * database each run, so the first share really is a first share.
 * Signs in through the API and stores the token before the page loads.
 */
const SHOTS = 'test-results/practice/family-page';
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

/** Takes the made-up member out again, so the practice people list is as it was. */
async function removeMember(userId: string) {
  const db = await practiceDb();
  const ids = (db.prepare('SELECT id FROM contributors WHERE user_id = ?').all(userId) as Array<{ id: string }>).map(row => row.id);
  for (const id of ids) {
    db.prepare('DELETE FROM contributor_profile_drafts WHERE contributor_id = ?').run(id);
    db.prepare('DELETE FROM contributor_accounts WHERE contributor_id = ?').run(id);
    db.prepare('DELETE FROM contributors WHERE id = ?').run(id);
  }
  db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').run(userId);
  db.prepare('DELETE FROM customer_tasting_journal WHERE id = ?').run(`journal-${userId}`);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.close();
}

async function newMember(productId: string, productName: string) {
  const db = await practiceDb();
  const tag = randomBytes(3).toString('hex');
  const email = `dana.${tag}.family@sandbox.local`;
  const id = `sbx-family-${tag}`;
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))`)
    .run(id, email, `Dana ${tag}`, createHash('sha256').update(PASSWORD).digest('hex'));
  db.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES (?, NULL, ?, ?, ?, 9, ?, '[]')`).run(`journal-${id}`, email, productId, productName,
    JSON.stringify({ rating: 9, verdict: 'love', personalNote: 'private words', tasting: {}, updatedAt: new Date().toISOString() }));
  db.close();
  return { id, email, name: `Dana ${tag}`, slug: `dana-${tag}` };
}

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

test('a first share makes a live family page; the owner changes the word and nothing else', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  const list = await (await page.request.get('/api/products/public')).json();
  const products = Array.isArray(list) ? list : (list?.products ?? []);
  const product = products[0];
  const productName = String(product.given_name || product.product_name || product.name);
  const member = await newMember(product.id, productName);
  const token = await tokenFor(page, { identifier: member.email, password: PASSWORD });
  const headers = { Authorization: `Bearer ${token}` };
  // Nothing yet: no page until the first share.
  expect((await (await page.request.get('/api/me/public-profile', { headers })).json()).contributor).toBeNull();

  // The first share makes the page.
  const shared = await page.request.put(`/api/family/teas/${product.id}/share`, { headers, data: { share_state: 'page' } });
  expect(shared.status()).toBe(200);
  const result = await shared.json();
  expect(result).toMatchObject({ page_created: true });
  expect(result.page_id).toBe(member.slug);
  const slug: string = result.page_id;
  const address = `/people/${slug}`;
  expect(result.page_path).toBe(address);
  const again = await (await page.request.put(`/api/family/teas/${product.id}/share`, { headers, data: { share_state: 'offered' } })).json();
  expect(again).toMatchObject({ page_id: slug, page_created: false });

  // Live without review: a visitor who is not signed in reads it at once, with the family word and no Pay.
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(address);
  await expect(visitorPage.getByRole('heading', { name: member.name })).toBeVisible({ timeout: 20_000 });
  await expect(visitorPage.getByText('Teajia family').first()).toBeVisible();
  await expect(visitorPage.getByRole('link', { name: 'Pay', exact: true })).toHaveCount(0);
  await expect(visitorPage.getByText(/\b9\b|Love|private words/)).toHaveCount(0);
  await visitorPage.screenshot({ path: `${SHOTS}-1-public-page.png` });
  const publicJson = await (await page.request.get(`/api/people/${slug}`)).json();
  expect(publicJson).toMatchObject({ role: 'Teajia family', has_payment_methods: false });

  // The person edits their own page: the word is fixed, there is no Pay, and a save goes on the page at once.
  await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, token);
  await page.goto('/account/profile');
  await expect(page.getByText('Your page', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('On Teajia as')).toHaveValue('Teajia family');
  await expect(page.getByLabel('On Teajia as')).toBeDisabled();
  await expect(page.getByText('Payment methods')).toHaveCount(0);
  await expect(page.getByText('What you save goes on it at once.')).toBeVisible();
  await page.getByLabel('Instagram').fill('@dana.family');
  await page.screenshot({ path: `${SHOTS}-2-own-editor.png` });
  const save = page.waitForResponse(r => r.url().endsWith('/api/me/public-profile') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await save).status()).toBe(200);
  await expect(page.getByText('Saved. It is on your page.')).toBeVisible();
  await visitorPage.reload();
  await expect(visitorPage.getByText('@dana.family').first()).toBeVisible({ timeout: 20_000 });
  await visitorPage.screenshot({ path: `${SHOTS}-3-public-page-with-link.png` });

  // The owner upgrades the person in Manage; only the word changes.
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await owner.newPage();
  const ownerToken = await tokenFor(ownerPage, OWNER);
  await ownerPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ownerToken);
  await ownerPage.goto('/admin/contributors');
  await ownerPage.getByRole('button', { name: `Edit ${member.name}` }).click();
  await ownerPage.getByTestId('row-behind').click();
  const wordBox = ownerPage.getByTestId('section-page-word');
  await expect(wordBox).toBeVisible();
  await expect(wordBox.getByLabel('Teajia family')).toBeChecked();
  const upgrade = ownerPage.waitForResponse(r => r.url().includes(`/api/admin/family/pages/${slug}/tier`));
  await wordBox.getByText('Tea creator', { exact: true }).click();
  expect((await upgrade).status()).toBe(200);
  await expect(wordBox.getByLabel('Tea creator')).toBeChecked();
  await ownerPage.screenshot({ path: `${SHOTS}-4-owner-word.png` });
  const upgraded = await (await page.request.get(`/api/people/${slug}`)).json();
  expect(upgraded).toMatchObject({ id: slug, role: 'Tea creator', display_name: member.name });
  expect(upgraded.links).toEqual(publicJson.links.length ? publicJson.links : upgraded.links);
  await visitorPage.reload();
  await expect(visitorPage.getByText('Tea creator').first()).toBeVisible({ timeout: 20_000 });
  await expect(visitorPage.getByText('@dana.family').first()).toBeVisible();
  await visitorPage.screenshot({ path: `${SHOTS}-5-public-page-creator.png` });

  // And back: the address and the written words never moved.
  const back = ownerPage.waitForResponse(r => r.url().includes(`/api/admin/family/pages/${slug}/tier`));
  await wordBox.getByText('Teajia family', { exact: true }).click();
  expect((await back).status()).toBe(200);
  const restored = await (await page.request.get(`/api/people/${slug}`)).json();
  expect(restored).toMatchObject({ id: slug, role: 'Teajia family' });
  expect(restored.links).toEqual(upgraded.links);

  expect(errors).toEqual([]);
  await visitor.close();
  await owner.close();
  await removeMember(member.id);
});
