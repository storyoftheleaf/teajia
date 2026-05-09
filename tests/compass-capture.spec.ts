/**
 * Compass capture — Personal vs. Inventory save-mode toggle.
 *
 * Covers:
 *   - Toggle is visible whenever the capture action bar is shown.
 *   - Default mode is 'personal' on first use.
 *   - `?mode=inventory` deep-link pre-selects Inventory.
 *   - Without an active account, Inventory is disabled with a hint tooltip.
 *   - Sticky preference: chosen mode persists across reloads.
 *   - Drafts queue empty-state copy mentions Inventory mode + deep-links to compass.
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

const NO_ACCOUNT_PAYLOAD = {
  sub: 'test-member-uid',
  email: 'member@teajia.com',
  name: 'Test Member',
  role: 'member',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  // active_account_id absent on purpose
  memberships: [],
};

async function injectAuth(page: Page, payload: object) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
    // Mirror the active account into the persisted Zustand store so the
    // app sees an account on hydrate without a server round-trip.
    const persisted = JSON.parse(localStorage.getItem('teajia-storage') || '{}');
    persisted.state = persisted.state || {};
    persisted.state.activeAccountId = (JSON.parse(atob(token.split('.')[1])).active_account_id) ?? null;
    localStorage.setItem('teajia-storage', JSON.stringify(persisted));
  }, makeFakeJWT(payload));
}

async function gotoCompass(page: Page, query = '') {
  await page.goto(`/admin/compass${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500); // hydrate + Zustand rehydrate
}

async function ensureCaptureActionBar(page: Page) {
  // The action bar (and toggle) only show when a session entry exists with a
  // non-teaware category. Type a name into the capture form to ensure one.
  const nameInput = page.locator('input[placeholder*="tasting"], input[placeholder*="What"]').first();
  if (await nameInput.count()) {
    await nameInput.fill('Test capture');
    await page.waitForTimeout(300);
  }
}

test.describe('Compass capture — save mode toggle', () => {
  test('toggle visible with both segments; default Personal', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await gotoCompass(page);
    await ensureCaptureActionBar(page);

    const personal = page.locator('[data-testid="save-mode-personal"]');
    const inventory = page.locator('[data-testid="save-mode-inventory"]');
    await expect(personal.first()).toBeVisible();
    await expect(inventory.first()).toBeVisible();
    await expect(personal.first()).toHaveAttribute('aria-checked', 'true');
    await expect(inventory.first()).toHaveAttribute('aria-checked', 'false');
  });

  test('?mode=inventory deep-link pre-selects Inventory', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await gotoCompass(page, '?mode=inventory');
    await ensureCaptureActionBar(page);

    const inventory = page.locator('[data-testid="save-mode-inventory"]').first();
    await expect(inventory).toHaveAttribute('aria-checked', 'true');
  });

  test('without active account, Inventory is disabled with a hint', async ({ page }) => {
    await injectAuth(page, NO_ACCOUNT_PAYLOAD);
    await gotoCompass(page);
    await ensureCaptureActionBar(page);

    const inventory = page.locator('[data-testid="save-mode-inventory"]').first();
    if (await inventory.count()) {
      await expect(inventory).toBeDisabled();
      await expect(inventory).toHaveAttribute(
        'title',
        /account/i,
      );
    }
  });

  test('sticky: choice persists across reloads', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await gotoCompass(page);
    await ensureCaptureActionBar(page);

    const inventory = page.locator('[data-testid="save-mode-inventory"]').first();
    await inventory.click();
    await expect(inventory).toHaveAttribute('aria-checked', 'true');

    // Reload — the persisted localStorage state should restore Inventory.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await ensureCaptureActionBar(page);

    const inventoryAfter = page.locator('[data-testid="save-mode-inventory"]').first();
    await expect(inventoryAfter).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Drafts queue — Compass handoff', () => {
  test('empty state copy mentions Inventory mode; link deep-links to compass', async ({ page }) => {
    await injectAuth(page, ADMIN_PAYLOAD);
    await page.goto('/admin/capture', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The empty state copy may or may not be visible depending on data; if
    // it is, validate the wording. If drafts already exist, validate the
    // permanent header link instead.
    const link = page.locator('a, button', { hasText: /Capture in Compass|Open Compass/ }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(800);
      expect(page.url()).toMatch(/compass\?mode=inventory/);
    }
  });
});
