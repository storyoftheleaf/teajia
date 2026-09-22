import { test, expect, Page } from './fixtures';

// Verifies the immersive Read-section long-reads: no overflow, no crash,
// no 404, no unexpected console errors, plus a screenshot per state.
//
// rock-remembers, earth-water-fire and before-the-mist are drafts under the
// publish gate (src/pages/read/publishGate.ts): a visitor with empty storage
// now sees ReadNotFound at those URLs, which is the fix for JOBC-2, not a
// regression this health check should catch. They sign in as an owner so
// this spec keeps checking what it was built to check, the article content
// itself, the same way an editor working on the draft actually sees it.

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const OWNER_TOKEN = makeFakeJWT({
  sub: 'test-owner-uid',
  role: 'owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  // account_kind + is_platform_account are what the gate reads: owning some
  // account is not enough, it has to be Teajia's. See publishGate.ts.
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

// Each entry's title is the Helmet title its own article component sets, so
// the "did the article actually load" check has something exact to retry
// against instead of a fixed sleep followed by a one-shot read of body text.
const ROUTES = [
  { path: '/read', name: 'index', title: 'The Art of Tea · Read · Teajia' },
  { path: '/read/leaf-to-liquor', name: 'leaf-to-liquor', title: 'From Leaf to Liquor · Teajia' },
  { path: '/read/rock-remembers', name: 'rock-remembers', draft: true, title: 'The Rock Remembers · Teajia' },
  { path: '/read/earth-water-fire', name: 'earth-water-fire', draft: true, title: 'Earth, Water, Fire · Teajia' },
  { path: '/read/before-the-mist', name: 'before-the-mist', draft: true, title: 'Before the Mist Burns Away · Teajia' },
];

async function checkPage(page: Page, name: string) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // no error boundary
  await expect(page.getByText('Something went wrong', { exact: false }), `${name}: error boundary`).toHaveCount(0);

  // no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: horizontal overflow ${overflow}px`).toBeLessThanOrEqual(2);

  // filter expected noise (font 404s on subset, favicon)
  const real = errors.filter((e) => !/favicon|fonts\.g|Failed to load resource.*woff|manifest/i.test(e));
  expect(real, `${name}: console errors: ${real.join(' | ')}`).toHaveLength(0);
}

for (const r of ROUTES) {
  test(`immersive ${r.name}`, async ({ page }) => {
    if (r.draft) {
      await page.addInitScript((token) => {
        localStorage.setItem('teajia_token', token);
      }, OWNER_TOKEN);
    }
    await page.goto(`http://localhost:7777${r.path}`, { waitUntil: 'domcontentloaded' });
    // Auto-retrying, the way read-publish-gate.spec.ts checks a page loaded:
    // the lazy article chunk is not necessarily in by the time navigation
    // settles, so this polls for the article's own title instead of racing a
    // fixed sleep. It fails outright if the article never mounts (a crash, or
    // a draft route that landed on the not-found page instead).
    await expect(page, `${r.name}: article never rendered (title stuck on something else)`).toHaveTitle(r.title);
    await expect(page.getByText('Page not found', { exact: true }), `${r.name}: landed on the not-found page`).toHaveCount(0);
    await checkPage(page, r.name);
    await page.screenshot({ path: `test-results/immersive/${r.name}.png`, fullPage: false });
    // scroll to mid + end to trigger reveals
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/immersive/${r.name}-mid.png`, fullPage: false });
  });
}

// Exercise all five URL-addressable directions of the explainer. Each design
// is a distinct article route now, rather than an in-page mode switcher.
test('leaf-to-liquor all five direction routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const label of ['Manuscript', 'Gallery', 'Folio', 'Thread', 'Reverie']) {
    errors.length = 0;
    const template = label.toLowerCase();
    await page.goto(`http://localhost:7777/read/leaf-to-liquor/${template}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/read/leaf-to-liquor/${template}$`));
    await expect(page.getByText(`From Leaf to Liquor · ${label}`, { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${label}: overflow ${overflow}px`).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `test-results/immersive/dir-${label.toLowerCase()}.png` });
    const real = errors.filter((e) => !/favicon|fonts\.g|woff|manifest/i.test(e));
    expect(real, `${label}: console errors: ${real.join(' | ')}`).toHaveLength(0);
  }
});
