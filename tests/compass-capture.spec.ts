/**
 * Compass capture — every save lands in /admin/capture as a Draft product.
 * No save-mode toggle, no decision at capture time. The "Capture in Compass"
 * link in DraftsView routes to /admin/compass and the Done button inside
 * CaptureCard is the single commit affordance.
 */

import { test, expect, type Page } from '@playwright/test';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const ADMIN_PAYLOAD = {
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
};

async function injectAuth(page: Page, payload: object) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
    const persisted = JSON.parse(localStorage.getItem('teajia-storage') || '{}');
    persisted.state = persisted.state || {};
    persisted.state.activeAccountId = (JSON.parse(atob(token.split('.')[1])).active_account_id) ?? null;
    localStorage.setItem('teajia-storage', JSON.stringify(persisted));
  }, makeFakeJWT(payload));
}

async function gotoCompass(page: Page) {
  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

test.describe('Compass capture — unified inventory model', () => {
  test('no save-mode toggle is rendered', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await gotoCompass(page);
    // The toggle was deliberately removed — every save goes to inventory.
    await expect(page.locator('[data-testid="save-mode-personal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="save-mode-inventory"]')).toHaveCount(0);
  });

  test('Done button is present in the capture form', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await gotoCompass(page);
    // Type a name so the form is in a ready-to-commit state.
    const nameInput = page.locator('input[placeholder*="tasting"], input[placeholder*="What"]').first();
    if (await nameInput.count()) {
      await nameInput.fill('Test capture');
      await page.waitForTimeout(300);
    }
    const doneButton = page.locator('button[aria-label*="Done"]').first();
    await expect(doneButton).toBeVisible();
  });
});

test.describe('Drafts queue — Compass handoff', () => {
  test('"Capture in Compass" link routes to /admin/compass (no query param)', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await page.goto('/admin/capture', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const link = page.locator('a, button', { hasText: /Capture in Compass|Open Compass/ }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(800);
      expect(page.url()).toMatch(/\/admin\/compass$/);
    }
  });
});
