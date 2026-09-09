// tests/read-publish-gate.spec.ts
// JOBC-2: a draft article page had no gate of its own, so a visitor with
// empty storage could read it in full at its own URL. Verifies the gate
// added in src/pages/read/publishGate.ts and wired through ArticleGate in
// App.tsx: a draft is not-found for a visitor, live for a signed-in owner,
// and a live piece stays public either way.

import { test, expect, type Page } from '@playwright/test';

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

// Shaped the way the worker signs it: loadMemberships stamps
// is_platform_account from accounts.is_platform_owner, and Teajia's own account
// also carries kind = 'platform'. The gate reads those markers rather than
// "owns some account", so a curator who owns their own shop is a visitor here.
const OWNER_TOKEN = makeFakeJWT({
  sub: 'test-owner-uid',
  email: 'owner@teajia.com',
  role: 'owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    {
      account_id: 'acct-bali',
      account_name: 'Teajia Bali',
      role: 'owner',
      slug: 'teajia-bali',
      account_kind: 'platform',
      is_platform_account: true,
    },
  ],
});

// Owns a shop on the network, is nobody at Teajia.
const CURATOR_TOKEN = makeFakeJWT({
  sub: 'test-curator-uid',
  email: 'curator@example.com',
  role: 'owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-curator',
  memberships: [
    { account_id: 'acct-curator', account_name: 'A Curator', role: 'owner', slug: 'a-curator', account_kind: 'master' },
  ],
});

/** Every /read link a visitor is actually offered on this page. */
async function readLinksOn(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href^="/read"]').evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).getAttribute('href') || ''),
  );
  return [...new Set(hrefs.filter(Boolean))];
}

async function injectOwnerAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, OWNER_TOKEN);
}

test.beforeEach(async ({ page }) => {
  // Mocked the same way read-index-articles.spec.ts mocks it: the page's own
  // retained articles query, not what the gate decides on.
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
});

test('a draft article is not found for a visitor with empty storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/read/rock-remembers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page).toHaveTitle('Not found · Teajia');
  await expect(page.getByText('Page not found', { exact: true })).toBeVisible();
  // The interview itself never reaches the page.
  await expect(page.getByText('Chén Wǔ', { exact: false })).toHaveCount(0);

  const real = errors.filter((e) => !/favicon|fonts\.g|woff|manifest/i.test(e));
  expect(real, `console errors: ${real.join(' | ')}`).toHaveLength(0);
});

test('a draft article renders for a signed-in owner', async ({ page }) => {
  await injectOwnerAuth(page);
  await page.goto('/read/rock-remembers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page).toHaveTitle('The Rock Remembers · Teajia');
  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
});

test('a live article stays public for a visitor with empty storage', async ({ page }) => {
  await page.goto('/read/ritual', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
});

test('a curator who owns their own shop is a visitor here, not an owner', async ({ page }) => {
  // The over-grant round two shipped: the gate asked only whether the signed-in
  // person owned SOME account, which every curator on the network does.
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, CURATOR_TOKEN);
  await page.goto('/read/rock-remembers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await expect(page).toHaveTitle('Not found · Teajia');
  await expect(page.getByText('Chén Wǔ', { exact: false })).toHaveCount(0);
});

// The four pieces ARTICLE_LIVE marks live, plus the flagship that sits outside
// the curated index. Every one of these is a page a stranger can open.
const LIVE_PAGES = ['/read/ritual', '/read/atlas', '/read/tasting', '/read/porcelain-and-tea', '/read/leaf-to-liquor'];

for (const pagePath of LIVE_PAGES) {
  test(`every Read link on ${pagePath} goes somewhere a visitor can open`, async ({ page }) => {
    // The blocker. The "More from The Art of Tea" rail at the foot of each
    // article was a hand-curated array with no publish check, so a live page
    // named unpublished pieces by title and blurb AND offered them as links
    // that landed on the not-found page: /read/porcelain-and-tea carried three
    // such cards, /read/atlas and /read/tasting one each. Whatever a live page
    // offers, a visitor must be able to open.
    await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);

    const links = await readLinksOn(page);
    expect(links.length, `${pagePath} rendered no Read links at all, so it did not load`).toBeGreaterThan(0);

    for (const href of links) {
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      await expect(
        page.getByText('Page not found', { exact: true }),
        `${pagePath} offers ${href}, which is not found for a visitor`,
      ).toHaveCount(0);
    }
  });
}

test('the filter leaves a real rail standing, it does not empty every page', async ({ page }) => {
  // The check above is satisfied by a page that offers nothing at all, which is
  // the correct outcome on /read/porcelain-and-tea (all three of its companions
  // are drafts) and would be a silent regression everywhere else. These two do
  // keep cards, so this pins that the fix filtered rather than deleted.
  for (const [pagePath, expected] of [
    ['/read/atlas', ['/read/ritual', '/read/leaf-to-liquor']],
    ['/read/tasting', ['/read/ritual', '/read/atlas']],
  ] as const) {
    await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const links = await readLinksOn(page);
    for (const href of expected) {
      expect(links, `${pagePath} stopped offering ${href}, which is live`).toContain(href);
    }
    // And the draft each of them used to advertise is gone.
    expect(links, `${pagePath} still offers /read/history, which is a draft`).not.toContain('/read/history');
  }
});
