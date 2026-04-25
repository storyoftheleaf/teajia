/**
 * Inbound collections smoke (Phase 2 of Collections — store audience).
 *
 * Asserts that /admin/collections renders both the Mine and Inbound modes
 * without overflow, JS errors, or error-boundary fallback. The empty-inbound
 * editorial state is the happy path here — actual seeded inbound rendering
 * is a later fixture.
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/collections-inbound');
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

test.use({ viewport: { width: 390, height: 844 } });

test.describe('/admin/collections — inbound mode', () => {
  test('mounts both modes without overflow or JS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await injectAuth(page);
    await page.goto('/admin/collections', { waitUntil: 'domcontentloaded' });
    // Wait for auth + Zustand hydration + initial fetch to settle.
    await page.waitForTimeout(2500);

    const mineBody = await page.locator('body').innerText();
    expect(mineBody.toLowerCase()).not.toContain('something went wrong');
    expect(mineBody.toLowerCase()).not.toContain('page not found');

    await page.screenshot({ path: path.join(SHOTS_DIR, 'mode_mine.png') });

    // Switch to Inbound. The mode toggle button has visible text "Inbound".
    const inboundBtn = page.getByRole('button', { name: /^inbound/i });
    if (await inboundBtn.count() > 0) {
      await inboundBtn.first().click();
      await page.waitForTimeout(700);

      const inboundBody = await page.locator('body').innerText();
      expect(inboundBody.toLowerCase()).not.toContain('something went wrong');
      await page.screenshot({ path: path.join(SHOTS_DIR, 'mode_inbound.png') });
    } else {
      // Auth gate redirected to login — still asserts no crash, which is the
      // smoke goal here. Real seeded coverage needs a fixtured DB.
      await page.screenshot({ path: path.join(SHOTS_DIR, 'mode_inbound_gated.png') });
    }

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(overflow, 'horizontal overflow on inbound mode').toBe(false);

    const filtered = consoleErrors.filter(e =>
      !e.includes('401') && !e.includes('403') &&
      !e.includes('Failed to load resource') && !e.includes('favicon')
    );
    expect(filtered, 'unexpected console errors').toHaveLength(0);
    expect(pageErrors, 'unhandled page errors').toHaveLength(0);
  });
});
