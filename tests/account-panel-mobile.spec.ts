/**
 * Mobile audit of the AccountPanel and every page it links to.
 * Viewport: iPhone 13 Pro (390×844).
 *
 * Auth: we inject a fake JWT before each test. The client only base64-decodes
 * the payload — it never verifies the signature — so any three-part token works.
 */

import { test, expect, type Page } from './fixtures';
import { findScreenEdgeOverruns } from './helpers/screenEdge';
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

const NO_SELL_TOKEN = makeFakeJWT({
  sub: 'test-member-uid',
  email: 'member@teajia.com',
  name: 'Test Member',
  role: 'member',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'member', slug: 'teajia-bali', bundles: [] },
  ],
});

const SWITCH_ACCOUNT_A = 'acct-owner-a';
const SWITCH_ACCOUNT_B = 'acct-member-b';
const SWITCH_MEMBERSHIPS = [
  { account_id: SWITCH_ACCOUNT_A, account_name: 'Owner Table', role: 'owner', slug: 'owner-table', bundles: [] },
  { account_id: SWITCH_ACCOUNT_B, account_name: 'Member Table', role: 'member', slug: 'member-table', bundles: [] },
];

function switchToken(activeAccountId: string, bBundles: string[] = []): string {
  return makeFakeJWT({
    sub: 'test-switch-uid',
    email: 'switcher@teajia.com',
    name: 'Account Switcher',
    role: 'owner',
    platform_role: null,
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    active_account_id: activeAccountId,
    memberships: SWITCH_MEMBERSHIPS.map(membership => membership.account_id === SWITCH_ACCOUNT_B
      ? { ...membership, bundles: bBundles }
      : membership),
  });
}

async function injectAuth(page: Page) {
  await page.addInitScript(({ token, memberships, activeAccountId, platformRole }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({
      version: 2,
      state: { memberships, activeAccountId, platformRole },
    }));
  }, {
    token: FAKE_TOKEN,
    memberships: [
      { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
      { account_id: 'acct-australia', account_name: 'Teajia Australia', role: 'owner', slug: 'teajia-australia' },
    ],
    activeAccountId: 'acct-bali',
    platformRole: 'platform_owner',
  });
}

async function injectNoSellAuth(page: Page) {
  await page.addInitScript(({ token, memberships, activeAccountId }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({
      version: 2,
      state: { memberships, activeAccountId },
    }));
  }, {
    token: NO_SELL_TOKEN,
    memberships: [
      { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'member', slug: 'teajia-bali', bundles: [] },
    ],
    activeAccountId: 'acct-bali',
  });
}

async function injectSwitchAuth(page: Page) {
  await page.addInitScript(({ token, memberships, activeAccountId }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({
      version: 2,
      state: { memberships, activeAccountId },
    }));
  }, {
    token: switchToken(SWITCH_ACCOUNT_A),
    memberships: SWITCH_MEMBERSHIPS,
    activeAccountId: SWITCH_ACCOUNT_A,
  });
}

async function goto(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  // Let React hydrate and Zustand rehydrate from localStorage
  await page.waitForTimeout(1200);
}

async function openPanel(page: Page) {
  await page.locator('button[aria-label="Your Table"]').click();
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

  test('orders tile closes the panel and opens order activity for a Sell-capable account', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/');
    await openPanel(page);

    await page.getByRole('button', { name: /orders/i }).click();
    await expect(page).toHaveURL(/\/admin\/activity\?tab=orders/);
    await expect(page.locator('.fixed.top-0.right-0')).toHaveCount(0);
  });

  test('orders tile is absent without the Sell capability', async ({ page }) => {
    await injectNoSellAuth(page);
    await goto(page, '/');
    await openPanel(page);

    await expect(page.getByRole('button', { name: /orders/i })).toHaveCount(0);
  });

  test('orders authority follows the JWT-confirmed active account across a switch', async ({ page }) => {
    let releaseSwitch: (() => void) | undefined;
    const switchStarted = new Promise<void>(resolve => { releaseSwitch = resolve; });
    let bSwitchCount = 0;
    await page.route('**/api/accounts/switch', async route => {
      const targetAccountId = route.request().postDataJSON()?.account_id as string;
      if (targetAccountId === SWITCH_ACCOUNT_B) {
        bSwitchCount += 1;
        if (bSwitchCount === 1) await switchStarted;
      }
      const bBundles = targetAccountId === SWITCH_ACCOUNT_B && bSwitchCount > 1 ? ['sell'] : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: switchToken(targetAccountId, bBundles), active_account_id: targetAccountId }),
      });
    });
    await page.route('**/api/accounts/acct-*', route => {
      const targetAccountId = route.request().url().endsWith(SWITCH_ACCOUNT_A) ? SWITCH_ACCOUNT_A : SWITCH_ACCOUNT_B;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: targetAccountId,
          name: targetAccountId === SWITCH_ACCOUNT_A ? 'Owner Table' : 'Member Table',
          slug: targetAccountId === SWITCH_ACCOUNT_A ? 'owner-table' : 'member-table',
          currency_default: 'USD',
        }),
      });
    });
    await injectSwitchAuth(page);
    await goto(page, '/');
    await openPanel(page);

    const orders = page.getByRole('button', { name: /orders/i });
    await expect(orders).toBeVisible();
    await page.getByRole('button', { name: /switch account/i }).click();
    await page.getByRole('option', { name: /Member Table/i }).click();

    await expect(orders).toHaveCount(0);
    releaseSwitch?.();
    await expect(page.getByRole('button', { name: /switch account.*Member Table/i })).toBeVisible();
    await expect(orders).toHaveCount(0);

    await page.getByRole('button', { name: /switch account/i }).click();
    await page.getByRole('option', { name: /Owner Table/i }).click();
    await expect(page.getByRole('button', { name: /switch account.*Owner Table/i })).toBeVisible();
    await expect(orders).toBeVisible();

    await page.getByRole('button', { name: /switch account/i }).click();
    await page.getByRole('option', { name: /Member Table/i }).click();
    await expect(page.getByRole('button', { name: /switch account.*Member Table/i })).toBeVisible();
    await expect(orders).toBeVisible();
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

  // The check above asks whether the PAGE is wider than the screen. This one
  // asks whether anything a person can see reaches past its right edge, which
  // is a different question and the one that catches more. An element
  // overrunning its grid track is absorbed without the document growing at all:
  // on 2026-08-31 an order summary rendered 551px inside a 311px column and
  // carried the amount 208px off a 375px phone while the document stayed
  // exactly 375px wide. This page was swept, that assertion ran, and it was
  // blind to it by construction.
  //
  // Surveyed across all twenty routes below before being promoted here, and
  // clean on every one. See tests/helpers/screenEdge.ts for what counts as
  // visible and why the blunter version of this check was too noisy to keep.
  const overruns = await findScreenEdgeOverruns(page);
  const worst = overruns[0] ?? null;
  expect(
    worst,
    worst
      ? `${label}: <${worst.tag} class="${worst.cls}"> reaches ${worst.past}px past the right edge (${worst.why}), showing "${worst.text}"`
      : '',
  ).toBeNull();

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
  ['/account/profile',    'Tea Master Profile'],
  ['/account/journal',    'Tasting Journal'],
  ['/account/collection', 'My Collection'],
  ['/account/orders',     'Order History'],
  ['/account/samples',    'Samples'],
  ['/account/collections','Shared Collections'],
  ['/account/journey',    'Account Journey'],
  ['/account/settings',   'Account Settings'],
  ['/shop',               'Shop'],
  ['/read',               'Read'],
  ['/community',          'Community'],
  ['/find-a-table',       'Find a Teahouse'],
  ['/consult',            'Consult'],
] as const;

const ADMIN_ROUTES = [
  ['/admin/stock',      'Admin Stock'],
  ['/admin/inventory',  'Admin Stock (legacy redirect)'],
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
      await page.route('**/api/products/public**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }));
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
      await page.route('**/api/products/public**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }));
      await goto(page, route);
      const safe = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await shot(page, `admin_${safe}`);
      await assertPageHealthy(page, label, consoleErrors);
    });
  }
});

test.describe('Tea Master profile routes — mobile', () => {
  test('profile management loads the identity, favorites, and payment sections', async ({ page }) => {
    await injectAuth(page);
    await page.route('**/api/me/public-profile', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: 'mei-lin', slug: 'mei-lin', display_name: 'Mei Lin', chinese_name: '林美',
          beginnings: 'Tea maker and host.', now_text: 'Sharing mountain oolongs.',
          location_line: 'Bali', languages: ['English'], avatar_url: null, portrait_url: null,
          links: [], publication_state: 'published', approval_state: 'approved', is_published: true,
          associations: [{ account_id: 'acct-bali', account_slug: 'teajia-bali', account_name: 'Teajia Bali', public_role: 'Tea Master', is_host: true }],
        },
      }),
    }));
    await page.route('**/api/me/profile/favorites', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ favorites: [], available_teas: [] }),
    }));
    await page.route('**/api/me/profile/payment-methods', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ methods: [] }),
    }));

    await goto(page, '/account/profile');
    await expect(page.getByRole('heading', { name: 'Your public profile' })).toBeVisible();
    await expect(page.getByText('Published · public identity')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save for review' })).toBeVisible();
    await expect(page.getByText('Changes remain private until approved.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Public favorites' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/account/settings');
    await shot(page, 'profile_management');
    await assertPageHealthy(page, 'Tea Master profile management', []);
  });

  test('account settings links back to the Tea Master profile', async ({ page }) => {
    await injectAuth(page);
    await goto(page, '/account/settings');

    await expect(page.getByRole('link', { name: 'Tea Master profile' })).toHaveAttribute('href', '/account/profile');
  });

  test('profile management reports favorites and payment failures instead of false empty states', async ({ page }) => {
    await injectAuth(page);
    await page.route('**/api/me/public-profile', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: 'mei-lin', slug: 'mei-lin', display_name: 'Mei Lin', chinese_name: null,
          beginnings: 'Tea maker and host.', now_text: null, location_line: 'Bali', languages: [],
          avatar_url: null, portrait_url: null, links: [], publication_state: 'draft',
          approval_state: 'pending', is_published: false, associations: [],
        },
      }),
    }));
    await page.route('**/api/me/profile/favorites', route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Favorites are temporarily unavailable.' }),
    }));
    await page.route('**/api/me/profile/payment-methods', route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Payment methods are temporarily unavailable.' }),
    }));

    await goto(page, '/account/profile');
    await expect(page.getByRole('heading', { name: 'Public favorites' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /favorites/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /payment/i })).toBeVisible();
    await expect(page.getByText('No teas selected yet.')).toHaveCount(0);
    await expect(page.getByText('No payment methods yet.')).toHaveCount(0);
  });

  test('published profile save failures stay visible and do not claim success', async ({ page }) => {
    await injectAuth(page);
    await page.route('**/api/me/public-profile', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Owner review is required.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: 'mei-lin', slug: 'mei-lin', display_name: 'Mei Lin', chinese_name: null,
            beginnings: 'Tea maker and host.', now_text: null, location_line: 'Bali', languages: [],
            avatar_url: null, portrait_url: null, links: [], publication_state: 'published',
            approval_state: 'approved', is_published: true, associations: [],
          },
        }),
      });
    });
    await page.route('**/api/me/profile/favorites', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favorites: [], available_teas: [] }) }));
    await page.route('**/api/me/profile/payment-methods', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ methods: [] }) }));

    await goto(page, '/account/profile');
    await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Mei Lin Updated');
    await page.getByRole('button', { name: 'Save for review' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Owner review is required.' })).toBeVisible();
    await expect(page.getByText('Changes saved')).toHaveCount(0);
  });

  test('public favorites render a Tea Master selection without a dead tea link', async ({ page }) => {
    await page.route('**/api/public/people/mei-lin/favorites', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        favorites: [{
          tea_profile_id: 'tea-1', note: 'A quiet, mineral finish.', position: 0, is_public: 1,
          name: 'Old Grove Dancong', type: 'Oolong', harvest_year: 2025,
          origin_region: 'Phoenix Mountain', origin_country: 'China', public_path: null,
        }],
      }),
    }));
    await page.route('**/api/people/mei-lin', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ display_name: 'Mei Lin', portrait_url: null, accounts: [] }),
    }));

    await goto(page, '/people/mei-lin/favorites');
    await expect(page.getByRole('heading', { name: 'Favorite teas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Old Grove Dancong' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Old Grove Dancong/ })).toHaveCount(0);
    await shot(page, 'profile_public_favorites');
    await assertPageHealthy(page, 'Public Tea Master favorites', []);
  });

  test('public payment chooser shows recipient methods and display-only context', async ({ page }) => {
    // Pay is private (migration 0022): the sheet opens only once pay-access
    // says so. This viewer arrives through a share link, which is how a link
    // sent by hand behaves.
    await page.route('**/api/public/people/mei-lin/pay-access**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access: 'open', via: 'link',
        contributor: { id: 'mei-lin', display_name: 'Mei Lin', business_name: null, portrait_url: null },
        viewer: { signed_in: false, is_owner: false, request_status: null },
        invoice: null,
      }),
    }));
    await page.route('**/api/public/people/mei-lin/payment-methods**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contributor: { display_name: 'Mei Lin', portrait_url: null },
        account: { slug: 'teajia-bali', name: 'Teajia Bali' },
        resolution: 'account',
        methods: [{
          id: 'pay-1', account_id: 'acct-bali', method_type: 'bank_transfer', label: 'Bank transfer',
          recipient_name: 'Mei Lin', account_identifier: '123 456 789', instructions: 'Use the shown reference.',
          external_url: null, qr_image_url: null, position: 0, is_published: true,
        }],
      }),
    }));

    await goto(page, '/people/mei-lin/pay?store=teajia-bali&amount=180000&currency=IDR&reference=TEA-42&t=ab12cd34ef56ab12cd34ef56ab12cd34');
    await expect(page.getByRole('heading', { name: 'Pay Mei Lin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose a transfer method' })).toBeVisible();
    await expect(page.getByText('123 456 789')).toBeVisible();
    await expect(page.getByText('IDR 180000')).toBeVisible();
    await expect(page.getByText('This page does not verify or record payment.')).toBeVisible();
    await shot(page, 'profile_public_payment');
    await assertPageHealthy(page, 'Public Tea Master payment chooser', []);
  });
});

test.describe('Member sample continuation', () => {
  test('links lifecycle rows to detail and the tasting journal flow', async ({ page }) => {
    await injectAuth(page);
    await page.route('**/api/me/samples', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        samples: [
          { id: 'requested-1', tea_name: 'Spring Green', status: 'requested', sent_at: '2026-07-01T00:00:00.000Z', notes: null },
          { id: 'received-1', tea_name: 'Wuyi Oolong', status: 'received', sent_at: '2026-07-02T00:00:00.000Z', notes: 'Rest the leaves before tasting.' },
          { id: 'tasted-1', tea_name: 'Old Tree Red', status: 'tasted', sent_at: '2026-07-03T00:00:00.000Z', notes: null },
        ],
      }),
    }));
    await page.route('**/api/samples/received-1', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'received-1', account_id: 'acct-bali', set_id: 'member-set-1', name: 'Wuyi Oolong',
        chinese_name: '武夷乌龙', type: 'Oolong', status: 'received', grams: 12,
        notes: 'Rest the leaves before tasting.', photos: '[]', created_by: 'admin',
        created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z',
        tastings: [],
      }),
    }));
    await goto(page, '/account/samples');

    for (const state of ['Requested', 'Received', 'Tasted']) await expect(page.getByText(state, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Wuyi Oolong sample' })).toHaveAttribute('href', '/s/received-1');
    await expect(page.getByRole('link', { name: 'Taste Wuyi Oolong and add to Journal' })).toHaveAttribute('href', '/s/received-1?taste=1');
    await expect(page.getByRole('link', { name: 'View Old Tree Red tasting' })).toHaveAttribute('href', '/s/tasted-1');
    const tasteBox = await page.getByRole('link', { name: 'Taste Wuyi Oolong and add to Journal' }).boundingBox();
    expect(tasteBox?.height).toBeGreaterThanOrEqual(44);

    await page.getByRole('link', { name: 'Taste Wuyi Oolong and add to Journal' }).click();
    await expect(page).toHaveURL(/\/s\/received-1$/);
    await expect(page.getByRole('heading', { name: 'Wuyi Oolong' })).toBeVisible();
    await expect(page.getByText('Received', { exact: true })).toBeVisible();
    await expect(page.getByText('12g', { exact: true })).toBeVisible();
    await expect(page.getByText('Wuyi Oolong', { exact: true }).last()).toBeVisible();
  });
});
