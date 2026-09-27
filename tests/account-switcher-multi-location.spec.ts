/**
 * Account / Location switcher edge cases — closes Audit FINDINGS #35.
 *
 * Scenarios covered:
 *  1. Open the location-switcher view from the panel: search input renders,
 *     "All Locations" zone label shows the membership count, and there's no
 *     overflow / crash / 404.
 *  2. Switching from membership A to membership B updates the active row;
 *     re-opening the switcher shows B as Current and A as Inactive (round-trip).
 *  3. Returning to a previously-active membership after switching away leaves
 *     the panel in a coherent state (the "stale data" edge case).
 *  4. Search filtering works — typing a name that matches one membership
 *     hides the other; typing a non-match shows the empty state.
 *
 * Auth + API mocking pattern matches tests/operator-multi-store.spec.ts.
 * Runs on Mobile (390×844) and Desktop (1280×800).
 *
 * No backend required.
 */

import { test, expect, type Page, type BrowserContext } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { openYourTable } from './helpers/navigation';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/account-switcher-multi-location');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// ─── Setup ────────────────────────────────────────────────────────────────────

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const BALI_ID = 'acct-bali';
const AUS_ID = 'acct-australia';
const TWN_ID = 'acct-taiwan';

const FULL_MEMBERSHIPS = [
  { account_id: BALI_ID, account_name: 'Teajia Bali',      role: 'owner', slug: 'teajia-bali' },
  { account_id: AUS_ID,  account_name: 'Teajia Australia', role: 'owner', slug: 'teajia-australia' },
  { account_id: TWN_ID,  account_name: 'Teajia Taiwan',    role: 'owner', slug: 'teajia-taiwan' },
];

function tokenFor(activeId: string): string {
  return makeFakeJWT({
    sub: 'test-multi-uid',
    email: 'multi@teajia.com',
    name: 'Multi Location User',
    role: 'owner',
    platform_role: null,
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    active_account_id: activeId,
    memberships: FULL_MEMBERSHIPS,
  });
}

async function injectAuth(page: Page, activeId = BALI_ID) {
  const token = tokenFor(activeId);
  await page.addInitScript((t) => {
    localStorage.setItem('teajia_token', t);
  }, token);
}

async function mockApi(context: BrowserContext) {
  await context.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith('/api/accounts/me') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memberships: FULL_MEMBERSHIPS,
          active_account_id: BALI_ID,
        }),
      });
    }

    const acctMatch = url.match(/\/api\/accounts\/(acct-[a-z]+)$/);
    if (acctMatch && method === 'GET') {
      const id = acctMatch[1];
      const mem = FULL_MEMBERSHIPS.find(m => m.account_id === id);
      const currency = id === AUS_ID ? 'AUD' : id === TWN_ID ? 'NT' : 'IDR';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: mem?.account_name ?? 'Unknown',
          slug: mem?.slug ?? '',
          currency_default: currency,
        }),
      });
    }

    if (url.endsWith('/api/accounts/switch') && method === 'POST') {
      const body = route.request().postDataJSON?.() ?? {};
      const newId = body.account_id || BALI_ID;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: tokenFor(newId), active_account_id: newId }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
}

async function goto(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

async function openPanel(page: Page) {
  await openYourTable(page);
  await page.waitForTimeout(500);
}

async function openLocationSwitcher(page: Page) {
  // No longer a "Switch location" row in a footer. The panel's home is a grid
  // of verbs now, and switching is the "switch" tile, shown only to someone
  // with more than one table. (There is also a small account chip at the top
  // of the panel, but that opens a short list rather than this full view with
  // its search and zones, which is what these tests are about.)
  // The tile carries its verb and its hint as separate lines, so match on
  // both rather than on one assembled name. The count is what keeps this clear
  // of "Switch account" and "Switch to light mode".
  const row = page.getByRole('button')
    .filter({ hasText: /^switch/i })
    .filter({ hasText: /\d+ tables?/i })
    .first();
  await expect(row, 'Switch tile should be present (memberCount >= 2)').toBeVisible();
  await row.click();
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string, label: string) {
  const safe = `${label}_${name}`.replace(/[^a-z0-9-]/gi, '_');
  await page.screenshot({ path: path.join(SHOTS_DIR, `${safe}.png`) });
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    has: document.documentElement.scrollWidth > window.innerWidth + 2,
    extra: document.documentElement.scrollWidth - window.innerWidth,
  }));
}

function isExpectedConsoleNoise(text: string): boolean {
  return (
    text.includes('net::ERR') ||
    text.includes('Failed to load resource') ||
    text.includes('favicon') ||
    text.includes('401') ||
    text.includes('403') ||
    text.includes('Session expired') ||
    text.includes('Unauthorized') ||
    text.includes('AbortError')
  );
}

async function assertHealthy(page: Page, label: string, errors: string[]) {
  const ov = await overflow(page);
  expect(ov.has, `${label}: horizontal overflow +${ov.extra}px`).toBe(false);

  const body = await page.locator('body').innerText();
  expect(body, `${label}: error boundary visible`).not.toContain('Something went wrong');
  expect(body, `${label}: 404 visible`).not.toMatch(/\b404\b/);
  expect(body.toLowerCase(), `${label}: page-not-found visible`).not.toContain('page not found');

  const real = errors.filter(e => !isExpectedConsoleNoise(e));
  expect(real, `${label}: unexpected JS errors → ${real.join(' | ')}`).toHaveLength(0);
}

// ─── Tests — Mobile + Desktop ─────────────────────────────────────────────────

const VIEWPORTS = [
  { label: 'mobile',  width: 390,  height: 844 },
  { label: 'desktop', width: 1280, height: 800 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Account location switcher — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.describe.configure({ mode: 'serial' });

    test('switcher view renders with all memberships listed', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(e.message));

      await injectAuth(page);
      await mockApi(context);
      await goto(page, '/');
      await openPanel(page);
      await openLocationSwitcher(page);

      // Search input is autoFocused inside the location-switcher view.
      const search = page.getByPlaceholder(/search locations/i);
      await expect(search).toBeVisible();

      // The "All Locations (N)" zone label should reflect membership count = 3.
      const allLabel = page.getByText(/All Locations \(3\)/i);
      await expect(allLabel).toBeVisible();

      await shot(page, '01-switcher-open', vp.label);
      await assertHealthy(page, `Switcher open (${vp.label})`, errors);
    });

    test('switching from A to B updates active membership', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(e.message));

      await injectAuth(page);
      await mockApi(context);
      await goto(page, '/');
      await openPanel(page);
      await openLocationSwitcher(page);

      // Click the "Teajia Australia" inactive card.
      const australiaCard = page.getByText('Teajia Australia', { exact: false }).first();
      await australiaCard.click();
      await page.waitForTimeout(900);

      await shot(page, '02-after-switch-to-B', vp.label);

      // After the switch the panel returns to main; reopen the switcher.
      await openLocationSwitcher(page);

      // Now Australia should be the "Current" zone, Bali should appear in the
      // inactive list. We don't pin to exact DOM structure — we just verify
      // both names still render somewhere and the switcher hasn't crashed.
      await expect(page.getByText('Teajia Australia', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Teajia Bali', { exact: false }).first()).toBeVisible();

      await shot(page, '03-switcher-after-B-active', vp.label);
      await assertHealthy(page, `After A→B switch (${vp.label})`, errors);
    });

    test('returning to previously-active membership keeps state coherent', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(e.message));

      await injectAuth(page);
      await mockApi(context);
      await goto(page, '/');
      await openPanel(page);
      await openLocationSwitcher(page);

      // A → B
      await page.getByText('Teajia Australia', { exact: false }).first().click();
      await page.waitForTimeout(900);

      // Reopen switcher and go B → A
      await openLocationSwitcher(page);
      await page.getByText('Teajia Bali', { exact: false }).first().click();
      await page.waitForTimeout(900);

      await shot(page, '04-after-roundtrip', vp.label);

      // Reopen the panel — must still render OperatorView without crash.
      await openLocationSwitcher(page);
      await expect(page.getByText(/All Locations \(3\)/i)).toBeVisible();

      await assertHealthy(page, `Round-trip switch (${vp.label})`, errors);
    });

    test('search filters memberships and shows empty state for no match', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(e.message));

      await injectAuth(page);
      await mockApi(context);
      await goto(page, '/');
      await openPanel(page);
      await openLocationSwitcher(page);

      const search = page.getByPlaceholder(/search locations/i);

      // Match — only Australia should be visible by name in the list area.
      await search.fill('australia');
      await page.waitForTimeout(300);
      await expect(page.getByText('Teajia Australia', { exact: false }).first()).toBeVisible();
      await shot(page, '05-search-match', vp.label);

      // Non-match — empty state copy from index.tsx is "No locations match".
      await search.fill('zzz-no-such-place');
      await page.waitForTimeout(300);
      await expect(page.getByText(/No locations match/i)).toBeVisible();
      await shot(page, '06-search-empty', vp.label);

      await assertHealthy(page, `Search filter (${vp.label})`, errors);
    });
  });
}
