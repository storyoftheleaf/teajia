import { test, expect, type Page } from './fixtures';
import { randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The people list, in the practice shop (todo/plans/teajia-family.md, "The people list").
 * Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-people-list.spec.ts`
 * (outside the sandbox). Stand-in people are made each run and taken out again
 * at the end, so the practice shop is as it was.
 *
 * What it walks: nobody without a photograph is listed; the owner names a
 * founding member and pins a person from Page settings; the family sits in its
 * quiet order; nothing on the page says why.
 */
const SHOTS = 'test-results/practice/people-list';
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

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

/** A stand-in photograph: a plain field of colour, so nobody mistakes it for a real person. */
const standIn = (hue: number) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 32% 30%)"/><stop offset="1" stop-color="hsl(${hue + 24} 38% 52%)"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><circle cx="150" cy="170" r="62" fill="hsl(${hue} 30% 22%)" opacity="0.55"/><rect x="60" y="250" width="180" height="150" rx="80" fill="hsl(${hue} 30% 22%)" opacity="0.55"/></svg>`,
)}`;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

test('the people list: a photograph to be listed, three groups, the family in its quiet order, the owner pins and names founders', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const tag = randomBytes(3).toString('hex');
  const errors: string[] = [];
  const db = await practiceDb();
  const shop = (db.prepare(`SELECT id FROM accounts WHERE is_platform_owner = 1 AND status = 'active' ORDER BY created_at, id LIMIT 1`).get() as { id: string }).id;
  // One tasting per person per tea, so each share is of a different tea.
  const teas = db.prepare(`SELECT id, product_name FROM products WHERE account_id = ? AND is_public = 1 LIMIT 4`).all(shop) as Array<{ id: string; product_name: string }>;
  expect(teas.length).toBe(4);

  // Who is made, and what each has done. `days` are the days ago they shared a tasting.
  const people = [
    { key: 'creator', name: `Lin Stand-in ${tag}`, tier: 'creator', hue: 58, line: 'I throw small pots for one person.', days: [] as number[] },
    { key: 'master', name: `Wen Stand-in ${tag}`, tier: 'master', hue: 28, line: 'I roast over charcoal, slowly.', days: [] as number[] },
    { key: 'helper', name: `Noor Stand-in ${tag}`, tier: 'family', hue: 250, line: 'I tested every screen twice.', days: [], founding: true },
    { key: 'early', name: `Sora Stand-in ${tag}`, tier: 'family', hue: 150, line: 'Here since the first table.', days: [] },
    { key: 'steady', name: `Ines Stand-in ${tag}`, tier: 'family', hue: 200, line: 'A pot every morning before work.', days: [3, 12, 25] },
    { key: 'burst', name: `Tomas Stand-in ${tag}`, tier: 'family', hue: 340, line: 'New to aged white tea.', days: [2] },
    { key: 'quiet', name: `Aiko Stand-in ${tag}`, tier: 'family', hue: 90, line: 'Mostly oolong, mostly in winter.', days: [] },
    { key: 'faceless', name: `Nobody Stand-in ${tag}`, tier: 'family', hue: null as number | null, line: 'No photograph yet.', days: [1, 2, 3, 4] },
  ].map(person => ({ ...person, id: `standin-${person.key}-${tag}`, userId: `standin-user-${person.key}-${tag}` }));
  const byKey = Object.fromEntries(people.map(person => [person.key, person]));

  try {
    for (const person of people) {
      db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
        .run(person.userId, `${person.userId}@sandbox.local`, person.name);
      db.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, portrait_url, now_text, founding_member)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(person.id, shop, person.userId, person.name, person.tier, person.hue === null ? null : standIn(person.hue), person.line, 'founding' in person && person.founding ? 1 : 0);
      person.days.forEach((days, index) => {
        const journal = `standin-journal-${person.key}-${index}-${tag}`;
        const tea = teas[index];
        db.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
          VALUES (?, NULL, ?, ?, ?, 8, '{}', '[]')`).run(journal, `${person.userId}@sandbox.local`, tea.id, tea.product_name);
        db.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
          VALUES (?, ?, ?, ?, 'page', ?, ?)`).run(journal, shop, tea.id, person.userId, daysAgo(days), daysAgo(days));
      });
    }

    // Before the owner touches anything: no photograph, no place; the family in its quiet order.
    const listed = async () => {
      const list = (await (await page.request.get('/api/people')).json()).contributors as Array<{ id: string; list_group: string }>;
      return list.filter(row => row.id.endsWith(tag)).map(row => `${row.list_group}:${row.id.split('-')[1]}`);
    };
    expect(await listed()).toEqual(['season:creator', 'season:master', 'founding:helper', 'family:steady', 'family:burst', 'family:quiet', 'family:early']);
    // The person with no photograph still has a page at their own address.
    expect((await page.request.get(`/api/people/${byKey.faceless.id}`)).status()).toBe(200);

    // The owner, in Page settings: Sora is a founding member, Aiko is pinned.
    const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ownerPage = await owner.newPage();
    ownerPage.on('pageerror', e => errors.push(e.message));
    const ownerToken = await tokenFor(ownerPage, OWNER);
    await ownerPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ownerToken);
    const choose = async (name: string, id: string, testId: string, says: string) => {
      await ownerPage.goto('/admin/contributors');
      await ownerPage.getByRole('button', { name: `Edit ${name}` }).click({ timeout: 30_000 });
      await ownerPage.getByTestId('row-behind').click();
      const box = ownerPage.getByTestId('section-people-list');
      await expect(box).toBeVisible();
      await expect(box.getByTestId(testId)).not.toBeChecked();
      const saved = ownerPage.waitForResponse(r => r.url().includes(`/api/admin/family/pages/${id}/list`));
      // The word is the control; the tick shows once the shop has saved it.
      await box.getByText(says, { exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(box.getByTestId(testId)).toBeChecked();
      return box;
    };
    const box = await choose(byKey.early.name, byKey.early.id, 'people-list-founding', 'Founding member');
    await box.scrollIntoViewIfNeeded();
    await ownerPage.screenshot({ path: `${SHOTS}-1-owner-page-settings.png` });
    await choose(byKey.quiet.name, byKey.quiet.id, 'people-list-pinned', 'Pinned to the top');
    expect(await listed()).toEqual(['season:creator', 'season:master', 'founding:helper', 'founding:early', 'family:quiet', 'family:steady', 'family:burst']);

    // A visitor on a phone: three groups in order, a photograph on every row, and no word of why.
    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const visitorPage = await visitor.newPage();
    visitorPage.on('pageerror', e => errors.push(e.message));
    await visitorPage.goto('/people');
    const directory = visitorPage.getByTestId('people-directory');
    await expect(directory.getByText(byKey.steady.name.split(' ')[0])).toBeVisible({ timeout: 30_000 });
    const top = async (label: string) => (await directory.getByRole('heading', { name: label, exact: true }).boundingBox())!.y;
    expect(await top('This season')).toBeLessThan(await top('Founding members'));
    expect(await top('Founding members')).toBeLessThan(await top('The family'));
    await expect(visitorPage.getByTestId('people-founding').getByTestId('people-card').filter({ hasText: 'Sora' })).toBeVisible();
    const rows = visitorPage.getByTestId('people-family').getByTestId('family-row');
    const mine = (await rows.allInnerTexts()).filter(text => text.includes(tag)).map(text => text.split(' ')[0]);
    expect(mine).toEqual(['Aiko', 'Ines', 'Tomas']);
    await expect(directory.getByText('Nobody')).toHaveCount(0);
    for (const row of await rows.all()) await expect(row.locator('img')).toHaveCount(1);
    await expect(directory.getByText(/most active|\b\d+ (tastings|teas|credits|days)\b|pinned|rank/i)).toHaveCount(0);
    expect(await visitorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await visitorPage.screenshot({ path: `${SHOTS}-2-people-top.png` });

    // The picture for the owner: the same page and the same answer from the shop,
    // with only this run's stand-in people let through, so nothing else is in frame.
    const picture = await visitor.newPage();
    await picture.route('**/api/people', async route => {
      const answer = await route.fetch();
      const body = await answer.json();
      await route.fulfill({ response: answer, json: { ...body, contributors: body.contributors.filter((row: { id: string }) => row.id.endsWith(tag)) } });
    });
    await picture.goto('/people');
    await expect(picture.getByTestId('people-directory').getByText('Lin')).toBeVisible({ timeout: 30_000 });
    // Walk down the page so every group has come into view before the picture.
    for (let y = 0; y <= 2400; y += 300) { await picture.mouse.wheel(0, 300); await picture.waitForTimeout(120); }
    await picture.evaluate(() => window.scrollTo(0, 0));
    await picture.waitForTimeout(400);
    await picture.screenshot({ path: `${SHOTS}-3-stand-in-people.png`, fullPage: true });
    expect(errors).toEqual([]);
    await owner.close();
    await visitor.close();
  } finally {
    for (const person of people) {
      db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').run(person.userId);
      db.prepare('DELETE FROM customer_tasting_journal WHERE user_id = ?').run(`${person.userId}@sandbox.local`);
      db.prepare('DELETE FROM contributor_profile_drafts WHERE contributor_id = ?').run(person.id);
      db.prepare('DELETE FROM contributors WHERE id = ?').run(person.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(person.userId);
    }
    db.close();
  }
});
