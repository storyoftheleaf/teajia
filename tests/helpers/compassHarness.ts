import { expect, type Page } from '@playwright/test';

const enc = (s: string) => Buffer.from(s).toString('base64url');
const memberships = [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }];
const unhandledByPage = new WeakMap<Page, string[]>();
const requestCounts = new WeakMap<Page, Map<string, number>>();
export const COMPASS_TOKEN = `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify({ sub: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', platform_role: 'platform_owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct-bali', memberships }))}.test`;

export async function installCompassHarness(page: Page, options?: { sampleCart?: unknown[]; contextEmpty?: boolean; contextFailOnce?: boolean; products?: unknown[] }) {
  unhandledByPage.set(page, []);
  requestCounts.set(page, new Map());
  await page.addInitScript(({ token, items }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.removeItem('teajia-storage');
    localStorage.setItem('teajia-sample-cart', JSON.stringify({ state: { items }, version: 0 }));
    localStorage.removeItem('teajia-samples');
  }, { token: COMPASS_TOKEN, items: options?.sampleCart ?? [] });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const requestKey = `${route.request().method()} ${path}`;
    const counts = requestCounts.get(page)!;
    counts.set(requestKey, (counts.get(requestKey) ?? 0) + 1);
    if (options?.contextFailOnce && requestKey === 'POST /api/curate/journeys' && counts.get(requestKey) === 1) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    }
    const responses: Record<string, unknown> = {
      'GET /api/auth/me': { id: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', memberships, active_account_id: 'acct-bali' },
      'POST /api/auth/refresh': { token: COMPASS_TOKEN },
      'GET /api/accounts/me': { memberships, active_account_id: 'acct-bali' },
      'GET /api/accounts/acct-bali': { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', default_currency: 'USD' },
      'GET /api/accounts/acct-empty': { id: 'acct-empty', name: 'Empty Test Account', slug: 'empty-test', default_currency: 'USD' },
      'GET /api/products': options?.products ?? [], 'GET /api/rates': [{ currency: 'USD', rate_to_usd: 1 }],
      'GET /api/products/public': [], 'GET /api/user/favorites': { favorites: [] },
      'PUT /api/user/favorites': { ok: true },
      'GET /api/tasting-journal': { entries: [] }, 'GET /api/tea-discovery': { profile: null },
      'GET /api/notes': { notes: [] }, 'GET /api/customers': [{ id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] }],
      'GET /api/compass/incoming': [], 'GET /api/compass/entries': [], 'POST /api/compass/sync': [],
      'GET /api/vendors': [], 'GET /api/sources': [], 'GET /api/admin/events': [],
      'GET /api/curate/journeys': { journeys: options?.contextEmpty ? [] : [{ id: 'journey-taiwan', account_id: 'acct-bali', name: 'Taiwan', season: 'Spring', year: 2026 }] },
      'GET /api/curate/visits': { visits: options?.contextEmpty ? [] : [{ id: 'visit-chen', account_id: 'acct-bali', journey_id: 'journey-taiwan', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Taipei' }] },
      'GET /api/curate/imports': { imports: [] },
      'POST /api/curate/journeys': { id: 'journey-created', account_id: 'acct-bali', name: 'Yunnan', season: 'Autumn', year: 2026 },
      'PUT /api/curate/journeys/journey-created': { id: 'journey-created', account_id: 'acct-bali', name: 'Yunnan edited', season: 'Autumn', year: 2026 },
      'DELETE /api/curate/journeys/journey-created': { success: true },
      'POST /api/curate/visits': { id: 'visit-created', account_id: 'acct-bali', journey_id: 'journey-created', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Kunming' },
      'PUT /api/curate/visits/visit-created': { id: 'visit-created', account_id: 'acct-bali', journey_id: 'journey-created', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Dali' },
      'DELETE /api/curate/visits/visit-created': { success: true },
    };
    if (!(requestKey in responses)) {
      const diagnostic = requestKey;
      unhandledByPage.get(page)?.push(diagnostic);
      console.error(`[compass-harness] unhandled ${diagnostic}`);
      return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ error: `Unhandled Compass test API route: ${path}` }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses[requestKey]) });
  });
}

export function compassRequestCount(page: Page, requestKey: string): number {
  return requestCounts.get(page)?.get(requestKey) ?? 0;
}

export async function expectNoUnhandledCompassApi(page: Page) {
  expect(unhandledByPage.get(page) ?? [], 'Compass test made unhandled API requests').toEqual([]);
}

export async function openCompass(page: Page) {
  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}
