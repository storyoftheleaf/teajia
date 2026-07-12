import { expect, type Page } from '@playwright/test';

const enc = (s: string) => Buffer.from(s).toString('base64url');
const memberships = [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }];
const unhandledByPage = new WeakMap<Page, string[]>();
export const COMPASS_TOKEN = `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify({ sub: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', platform_role: 'platform_owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct-bali', memberships }))}.test`;

export async function installCompassHarness(page: Page, options?: { sampleCart?: unknown[] }) {
  unhandledByPage.set(page, []);
  await page.addInitScript(({ token, items }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.removeItem('teajia-storage');
    localStorage.setItem('teajia-sample-cart', JSON.stringify({ state: { items }, version: 0 }));
    localStorage.removeItem('teajia-samples');
  }, { token: COMPASS_TOKEN, items: options?.sampleCart ?? [] });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      '/api/auth/me': { id: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', memberships, active_account_id: 'acct-bali' },
      '/api/auth/refresh': { token: COMPASS_TOKEN },
      '/api/accounts/me': { memberships, active_account_id: 'acct-bali' },
      '/api/accounts/acct-bali': { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', default_currency: 'USD' },
      '/api/products': [], '/api/rates': [{ currency: 'USD', rate_to_usd: 1 }],
      '/api/products/public': [], '/api/user/favorites': { favorites: [] },
      '/api/tasting-journal': { entries: [] }, '/api/tea-discovery': { profile: null },
      '/api/notes': { notes: [] },
      '/api/customers': [],
      '/api/compass/incoming': [], '/api/compass/entries': [], '/api/compass/sync': [],
      '/api/vendors': [], '/api/sources': [], '/api/admin/events': [],
    };
    if (!(path in responses)) {
      const diagnostic = `${route.request().method()} ${path}`;
      unhandledByPage.get(page)?.push(diagnostic);
      console.error(`[compass-harness] unhandled ${diagnostic}`);
      return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ error: `Unhandled Compass test API route: ${path}` }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses[path]) });
  });
}

export async function expectNoUnhandledCompassApi(page: Page) {
  expect(unhandledByPage.get(page) ?? [], 'Compass test made unhandled API requests').toEqual([]);
}

export async function openCompass(page: Page) {
  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}
