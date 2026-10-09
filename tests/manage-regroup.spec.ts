// tests/manage-regroup.spec.ts
// The Manage regroup (todo/plans/manage-regroup.md) moved screens between
// rooms. Links written before it (the dashboard, Your Table, emails, old
// bookmarks) carry the old addresses, so each old address must still land on
// the screen that now holds what it used to show.
import { test, expect, type Page } from './fixtures';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  return `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify(payload))}.fakesig`;
}

const MEMBERSHIPS = [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }];

async function signInAsOwner(page: Page) {
  const token = makeFakeJWT({
    sub: 'test-owner-uid', email: 'owner@teajia.com', name: 'Owner', role: 'owner', platform_role: 'platform_owner',
    exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct-bali', memberships: MEMBERSHIPS,
  });
  await page.context().route('**/api/**', async (route) => {
    if (route.request().url().endsWith('/api/auth/me')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'test-owner-uid', email: 'owner@teajia.com', name: 'Owner', role: 'owner', platform_role: 'platform_owner', memberships: MEMBERSHIPS, active_account_id: 'acct-bali' }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.addInitScript((t) => { localStorage.setItem('teajia_token', t); localStorage.setItem('teajia_active_account', 'acct-bali'); }, token);
}

const FORWARDS: [string, RegExp][] = [
  ['/admin/people?tab=team', /\/admin\/access$/],
  ['/admin/people?tab=audit', /\/admin\/audit$/],
  ['/admin/people?tab=purchase-orders', /\/admin\/purchase-orders$/],
  ['/admin/network?tab=wholesale', /\/admin\/activity\?tab=wholesale$/],
  ['/admin/contact-tags', /\/admin\/people\?tab=tags$/],
];

test.describe('the Manage regroup keeps old addresses working', () => {
  for (const [from, to] of FORWARDS) {
    test(`${from} lands where it lives now`, async ({ page }) => {
      await signInAsOwner(page);
      await page.goto(from);
      await expect(page).toHaveURL(to);
    });
  }

  test('Sales has four tabs, and old tab names open the tab that holds them', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/activity?tab=inquiries');
    const tabs = page.getByRole('main').getByRole('button').filter({ hasText: /^(waiting|orders|wholesale|ledger)/i });
    await expect(tabs).toHaveText([/waiting/i, /orders/i, /wholesale/i, /ledger/i]);
    await expect(page.getByRole('button', { name: /^inquiries$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^log$/i })).toHaveCount(0);
  });

  test('People holds customers, suppliers and tags, and nothing that moved', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/people');
    for (const gone of [/^team$/i, /^audit$/i, /^purchase orders$/i]) {
      await expect(page.getByRole('button', { name: gone })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: /suppliers/i })).toBeVisible();
  });
});
