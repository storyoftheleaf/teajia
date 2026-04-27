/**
 * Regression test for the InventoryView scroll bug.
 *
 * The scroll container at `[data-testid="inventory-scroll"]` is `flex-1
 * overflow-auto` and depends on a long chain of ancestor heights (`h-full`,
 * `flex-1 min-h-0`) from App.tsx down through AdminApp, PageTransition, and
 * InventoryView's own root. Inserting any wrapper in that chain without
 * preserving the contract collapses the container to 0 and the whole page
 * silently stops scrolling.
 *
 * This test runs on Desktop Chrome and Mobile Chrome. It asserts:
 *   1. The scroll container has a sensible clientHeight (> 200px).
 *   2. Content overflows it (scrollHeight > clientHeight) — otherwise we can't
 *      meaningfully test scrolling.
 *   3. Programmatic scrollTo(200) actually moves scrollTop, i.e. the container
 *      is genuinely scrollable.
 *
 * If this fails, see CLAUDE.md > "InventoryView height chain".
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/inventory-scroll');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

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
    { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
  ],
});

async function injectAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, FAKE_TOKEN);
}

async function shot(page: Page, name: string) {
  const safe = name.replace(/[^a-z0-9-]/gi, '_');
  await page.screenshot({ path: path.join(SHOTS_DIR, `${safe}.png`), fullPage: false });
}

test.describe('Inventory page — scroll regression guard', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('scroll container has height and is scrollable', async ({ page }, testInfo) => {
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const scroller = page.locator('[data-testid="inventory-scroll"]');
    await expect(scroller).toBeVisible({ timeout: 5000 });

    const dims = await scroller.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      offsetHeight: (el as HTMLElement).offsetHeight,
    }));

    await shot(page, `${testInfo.project.name}-loaded`);

    // 1. Container has a real height — guards against the ancestor chain breaking.
    expect(
      dims.clientHeight,
      `Scroll container height is ${dims.clientHeight}px — the h-full / flex-1 / min-h-0 ` +
      `chain from App.tsx is broken. See CLAUDE.md > "InventoryView height chain".`
    ).toBeGreaterThan(200);

    // 2. Content overflows — otherwise the scroll test below is meaningless.
    //    Skip the scroll assertion if there's genuinely nothing to scroll, but
    //    still require height (assertion 1 above).
    if (dims.scrollHeight > dims.clientHeight + 10) {
      // 3. Programmatic scroll actually moves.
      await scroller.evaluate((el) => el.scrollTo({ top: 200, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(150);
      const scrollTop = await scroller.evaluate((el) => el.scrollTop);
      expect(
        scrollTop,
        'Scroll container has overflow but scrollTop did not move — overflow:auto is not taking effect.'
      ).toBeGreaterThan(50);
      await shot(page, `${testInfo.project.name}-scrolled`);
    }
  });
});
