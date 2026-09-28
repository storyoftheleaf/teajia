import { expect, test, type Page } from './fixtures';

// /admin/members used to loop: the admin catch-all redirected to a RELATIVE
// "home", which React Router 7 resolves against the whole unmatched path, so
// the URL grew /admin/members/home/home/home... and nothing ever rendered.

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const membership = { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['members'] };
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'owner-1', email: 'owner@example.test', role: 'owner', platform_role: 'owner', active_account_id: 'acct-bali',
  memberships: [membership],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.signature`;

async function signIn(page: Page) {
  await page.addInitScript(({ jwt, m }) => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner-1', memberships: [m] } }));
  }, { jwt: token, m: membership });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
}

const noHomeSegment = (url: string) => !/\/home(\/|$|\?)/.test(new URL(url).pathname);

test('/admin/members lands once on the Members page at /admin/access', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/members');
  await expect(page).toHaveURL(/\/admin\/access$/, { timeout: 15_000 });
  // Give a runaway redirect time to show itself before trusting the URL.
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe('/admin/access');
  expect(noHomeSegment(page.url())).toBe(true);
});

test('an unknown admin path lands on the compass, not a growing /home chain', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/no-such-room/deeper');
  await expect(page).toHaveURL(/\/admin\/compass$/, { timeout: 15_000 });
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe('/admin/compass');
  expect(noHomeSegment(page.url())).toBe(true);
});
