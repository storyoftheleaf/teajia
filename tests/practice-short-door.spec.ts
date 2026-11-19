import { test, expect } from './fixtures';
import { randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 7: the short door, in the practice shop. Run with
 * `NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/practice-short-door.spec.ts`
 * (outside the sandbox). A stranger taps "Add your tasting", joins with three
 * fields, and lands back in the tasting. The made-up member is taken out again.
 * The Google button is checked here for its link to the API's Google route with a return path.
 */
const SHOTS = 'test-results/practice/short-door';

async function practiceDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = join(process.cwd(), 'worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(dir).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
    .map(name => join(dir, name)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

async function removeMember(email: string) {
  const db = await practiceDb();
  const row = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email) as { id: string } | undefined;
  if (row) {
    db.prepare('DELETE FROM identity_email_verifications WHERE user_id = ?').run(row.id);
    db.prepare('DELETE FROM customer_tasting_journal WHERE user_id = ?').run(email);
    db.prepare('DELETE FROM users WHERE id = ?').run(row.id);
  }
  db.close();
}

test.use({ actionTimeout: 20_000, navigationTimeout: 45_000 });

test('a stranger joins from Add your tasting with three fields, lands in the tasting, and stays signed in after a restart', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  const list = await (await page.request.get('/api/products/public')).json();
  const products: Array<Record<string, unknown>> = Array.isArray(list) ? list : (list?.products ?? []);
  const product = products.find(p => p.status !== 'Sold Out' && Number(p.stock_grams) > 0 && p.category !== 'ware') ?? products[0];
  const teaPath = `/shop/product/${encodeURIComponent(String(product.slug || product.id))}`;
  const tag = randomBytes(3).toString('hex');
  const email = `neo.${tag}.door@sandbox.local`;
  let code = '';
  page.on('response', async response => {
    if (response.url().endsWith('/api/auth/signup') && response.status() === 202) {
      code = String((await response.json()).verification_code ?? '');
    }
  });

  try {
    // 1. Signed out, the invitation is still on the tea.
    await page.goto(teaPath);
    await page.getByRole('button', { name: 'Add your tasting' }).first().click();
    await expect(page).toHaveURL(/\/signup\?returnTo=/);
    expect(decodeURIComponent(page.url())).toContain('taste=1');

    // 2. The form: name, email, password. Nothing else.
    const form = page.locator('form').first();
    await expect(form.locator('input')).toHaveCount(3);
    const google = page.getByRole('link', { name: 'Continue with Google' });
    await expect(google).toHaveAttribute('href', /\/api\/auth\/google\?return=/);
    await expect(page.getByText(/Username|WhatsApp|Telegram|Contact for events/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/join.png`, fullPage: true });
    await page.getByLabel('Name').fill(`Neo ${tag}`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('door-fixture-1');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByLabel('Verification code')).toBeVisible();
    await expect.poll(() => code).toMatch(/^\d{6}$/);
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Verify email' }).click();

    // 3. Back on the tea, with the tasting open and the marker taken out of the address.
    await expect(page.locator('.tasting-header-controls')).toBeVisible();
    expect(page.url()).toContain(teaPath);
    expect(page.url()).not.toContain('taste=1');
    await page.screenshot({ path: `${SHOTS}/back-in-the-tasting.png` });

    // 4. Signed in, and it lasts: the token is kept in durable storage and has a month on it.
    const kept = await page.evaluate(() => {
      const token = localStorage.getItem('teajia_token');
      const claims = token ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) : null;
      return { inLocal: Boolean(token), inSession: Boolean(sessionStorage.getItem('teajia_token')), days: claims ? Math.round((claims.exp - claims.iat) / 86400) : 0 };
    });
    console.log('measured session:', JSON.stringify(kept));
    expect(kept.inLocal).toBe(true);
    expect(kept.inSession).toBe(false);
    expect(kept.days).toBeGreaterThanOrEqual(30);

    // A browser restart keeps local storage and drops session storage.
    const state = await page.context().storageState();
    const restarted = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 } });
    try {
      const again = await restarted.newPage();
      again.on('pageerror', e => errors.push(e.message));
      await again.goto(teaPath);
      const me = await again.evaluate(async () => {
        const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('teajia_token')}` } });
        return { status: response.status, body: await response.json() };
      });
      expect(me.status).toBe(200);
      expect(me.body.email).toBe(email);
      // The page itself treats them as signed in: Add your tasting opens the tasting, not the join form.
      await again.getByRole('button', { name: 'Add your tasting' }).first().click();
      await expect(again.locator('.tasting-header-controls')).toBeVisible();
      expect(again.url()).not.toContain('/signup');
      await again.screenshot({ path: `${SHOTS}/after-restart.png` });
    } finally {
      await restarted.close();
    }

    // 5. The page the photograph notice links to, with no way in from any menu.
    await page.goto('/photographs');
    await expect(page.getByRole('heading', { name: 'How we use photographs' })).toBeVisible();
    await expect(page.getByText('may be shown on Teajia, with your name')).toBeVisible();
    await expect(page.getByText('Remove from my page')).toBeVisible();
    await expect(page.getByText(/take(s)? (one |it )?down|taken down/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/how-we-use-photographs.png`, fullPage: true });
    await page.goto('/');
    expect(await page.locator('a[href="/photographs"]').count()).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await removeMember(email);
  }
});
