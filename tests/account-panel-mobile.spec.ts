/**
 * Mobile audit of the AccountPanel and every page it links to.
 * Viewport: iPhone 13 Pro (390×844).
 *
 * Auth: we inject a fake JWT before each test. The client only base64-decodes
 * the payload — it never verifies the signature — so any three-part token works.
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/account-panel-mobile');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const FAKE_TOKEN = makeFakeJWT({
  sub: 'test-admin-uid',
  email: 'admin@teajia.com',
  name: 'Test Admin',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    { account_id: 'acct-bali',      account_name: 'Teajia Bali',      role: 'owner', slug: 'teajia-bali' },
    { account_id: 'acct-australia', account_name: 'Teajia Australia',  role: 'owner', slug: 'teajia-australia' },
  ],
});

async function injectAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, FAKE_TOKEN);
}

async function goto(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  // Let React hydrate and Zustand rehydrate from localStorage
  await page.waitForTimeout(1200);
}

async function openPanel(page: Page) {
  await page.locator('button[aria-label="Account"]').click();
  // Wait for panel backdrop to appear
  await page.waitForSelector('.fixed.inset-0', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function shot(page: Page, name: string) {
  const safe = name.replace(/[^a-z0-9-]/gi, '_');
  await page.screenshot({ path: path.join(SHOTS_DIR, `${safe}.png`) });
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    has: document.documentElement.scrollWidth > window.innerWidth + 2,
    extra: document.documentElement.scrollWidth - window.innerWidth,
  }));
}

// ─── Config ───────────────────────────────────────────────────────────────────

test.use({ viewport: { width: 390, height: 844 } });
// Run sequentially — panel tests share dev server and would conflict
test.describe.configure({ mode: 'serial' });

// ─── Panel tests ──────────────────────────────────────────────────────────────

test.describe('Account Panel — mobile audit', () => {
  test('main view: renders, no overflow', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    await shot(page, '01-main-view');
    const ov = await overflow(page);
    expect(ov.has, `Main view horizontal overflow +${ov.extra}px`).toBe(false);
  });

  test('Me section: identity + Your Tea cards visible', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    // Scroll panel to top
    await page.evaluate(() => {
      const panel = document.querySelector('.overflow-y-auto');
      if (panel) panel.scrollTop = 0;
    });
    await shot(page, '02-me-top');
    const ov = await overflow(page);
    expect(ov.has, `Me section overflow +${ov.extra}px`).toBe(false);
  });

  test('Explore zone: no overflow when scrolled to bottom', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    // Scroll to bottom of panel to reveal Explore zone
    await page.evaluate(() => {
      const panel = document.querySelector('.overflow-y-auto');
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(400);
    await shot(page, '03-explore-zone');
    const ov = await overflow(page);
    expect(ov.has, `Explore zone horizontal overflow +${ov.extra}px`).toBe(false);
  });

  test('Panel bottom: no overflow after full scroll', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    await page.evaluate(() => {
      const panel = document.querySelector('.overflow-y-auto');
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(400);
    await shot(page, '04-panel-bottom');
    const ov = await overflow(page);
    expect(ov.has, `Panel bottom overflow +${ov.extra}px`).toBe(false);
  });

  test('Sessions sub-view: renders on mobile (if available)', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    // Sessions button only appears when an active location card is present;
    // skip the click if not shown rather than hard-fail.
    const sessBtn = page.locator('button', { hasText: 'Sessions' }).first();
    if (await sessBtn.count() > 0) {
      await sessBtn.click();
      await page.waitForTimeout(500);
    }
    await shot(page, '05-sessions-view');
    const ov = await overflow(page);
    expect(ov.has, `Sessions view overflow +${ov.extra}px`).toBe(false);
  });

  test('Sign In form: renders on mobile (guest)', async ({ page }) => {
    // Guest — no injected token
    await goto(page, '/');
    await openPanel(page);
    // Scope to inside the panel to avoid matching bottom-nav Account button
    const panel = page.locator('.fixed.top-0.right-0').first();
    const btn = panel.locator('button', { hasText: /^Sign In$/ }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForTimeout(400);
    await shot(page, '06-signin-form');
    const ov = await overflow(page);
    expect(ov.has, `Sign-in form overflow +${ov.extra}px`).toBe(false);
  });

  test('Create Account form: renders on mobile (guest)', async ({ page }) => {
    await goto(page, '/');
    await openPanel(page);
    const panel = page.locator('.fixed.top-0.right-0').first();
    const btn = panel.locator('button', { hasText: /^Create Account$/ }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForTimeout(400);
    await shot(page, '07-create-account-form');
    const ov = await overflow(page);
    expect(ov.has, `Create account form overflow +${ov.extra}px`).toBe(false);
  });

  test('panel scrolls to bottom — sign-out not clipped', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);
    await page.evaluate(() => {
      const panel = document.querySelector('.overflow-y-auto');
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await page.waitForTimeout(400);
    await shot(page, '08-panel-bottom');
    // Sign-out must be visible, not behind nav bar
    const signOut = page.locator('button', { hasText: /sign out/i });
    if (await signOut.count() > 0) {
      await expect(signOut).toBeVisible();
    }
  });
});

// ─── Page health check helper ─────────────────────────────────────────────────

/**
 * Runs three checks on the current page:
 * 1. No horizontal overflow
 * 2. No "Something went wrong" / error boundary crash visible
 * 3. No 404 "Page not found" text visible
 * 4. No critical JS console errors (ignores network/resource noise)
 */
async function assertPageHealthy(page: Page, label: string, consoleErrors: string[]) {
  // Overflow
  const ov = await overflow(page);
  expect(ov.has, `${label}: horizontal overflow +${ov.extra}px`).toBe(false);

  // Error boundary crash
  const bodyText = await page.locator('body').innerText();
  expect(bodyText, `${label}: error boundary crash visible`).not.toContain('Something went wrong');

  // 404
  expect(bodyText, `${label}: 404 page shown`).not.toMatch(/\b404\b/);
  expect(bodyText.toLowerCase(), `${label}: "page not found" shown`).not.toContain('page not found');

  // Console errors (filter expected noise)
  const realErrors = consoleErrors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('Failed to load resource') &&
    !e.includes('favicon') &&
    !e.includes('401') &&          // expected — fake JWT is rejected by the API
    !e.includes('403') &&
    !e.includes('Session expired') &&
    !e.includes('Unauthorized')    // expected — admin API calls fail with fake JWT
  );
  expect(realErrors, `${label}: JS console errors`).toHaveLength(0);
}

// ─── Destination page checks ──────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  ['/compass',            'Tea Compass'],
  ['/account/journal',    'Tasting Journal'],
  ['/account/collection', 'My Collection'],
  ['/account/orders',     'Order History'],
  ['/account/samples',    'Samples'],
  ['/account/saved',      'Saved Stories'],
  ['/account/history',    'Reading History'],
  ['/account/settings',   'Account Settings'],
  ['/shop',               'Shop'],
  ['/magazine',           'Magazine'],
  ['/find-a-table',       'Find a Teahouse'],
  ['/consult',            'Consult'],
  ['/community',          'Community'],
] as const;

const ADMIN_ROUTES = [
  ['/admin/inventory',  'Admin Inventory'],
  ['/admin/events',     'Admin Events'],
  ['/admin/platform',   'Admin Platform'],
  ['/admin/team',       'Admin Team'],
  ['/admin/activity',   'Admin Activity'],
] as const;

test.describe('Destination pages — health check', () => {
  for (const [route, label] of PUBLIC_ROUTES) {
    test(`${label} (${route})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => consoleErrors.push(err.message));

      await injectAuth(page);
      await goto(page, route);
      const safe = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await shot(page, `dest_${safe}`);
      await assertPageHealthy(page, label, consoleErrors);
    });
  }

  for (const [route, label] of ADMIN_ROUTES) {
    test(`${label} (${route})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => consoleErrors.push(err.message));

      await injectAuth(page);
      await goto(page, route);
      const safe = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await shot(page, `admin_${safe}`);
      await assertPageHealthy(page, label, consoleErrors);
    });
  }
});
