/**
 * Launch 3, slice J10: reach, set by hand in Manage, at phone size, with
 * mocked routes (todo/plans/guests-and-tea-masters-launch-3-run.md, hard
 * question 4).
 *
 * Adrian opens one person's Hosting panel (/admin/platform?tab=users&host=bo)
 * and picks one of three: by their link only, signed-in people on Teajia, or
 * the public sessions list. The choice is written to
 * PUT /api/platform/users/:id/host-reach and shown as the pressed one. A host
 * offered the open door sees it as a third way to seat guests.
 *
 * Both launch switches are toggled in the browser only (the modules are
 * answered here), so the spec runs against the ordinary dev server.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const membership = { account_id: 'shop', account_name: 'Teajia', role: 'owner', bundles: ['gather'] };
const ownerToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'adrian', email: 'adrian@example.test', name: 'Adrian', role: 'owner', platform_role: 'platform_owner',
  active_account_id: membership.account_id, memberships: [membership],
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.fixture`;
const hostToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'bo', email: 'bo@example.test', name: 'Bo Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
})}.fixture`;

async function openSwitches(page: Page) {
  await page.route(/\/src\/lib\/anyoneHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const ANYONE_HOSTS_OPEN = true; export const anyoneHostsOpen = () => true;',
  }));
  await page.route(/\/src\/lib\/fewHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const FEW_HOSTS_OPEN = true; export const fewHostsOpen = () => true;',
  }));
}

const cors = { 'Access-Control-Allow-Origin': '*' };
function preflight(route: import('@playwright/test').Route) {
  const request = route.request();
  return route.fulfill({ headers: {
    ...cors,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': request.headers()['access-control-request-headers'] ?? '*',
  } });
}

async function openManage(page: Page) {
  const writes: { userId: string; reach: string }[] = [];
  const bo = {
    id: 'bo', email: 'bo@example.test', name: 'Bo Host', username: null, platform_role: null, created_at: '2026-11-01',
    has_tea_chest: true, may_sell: false, may_host: false, host_approved_at: null, hosting_stopped_at: null,
    host_reach: 'invitation', memberships: [],
  };
  await openSwitches(page);
  await page.addInitScript(({ token, membership }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: membership.account_id, activeUserId: 'adrian', memberships: [membership], platformRole: 'platform_owner',
    } }));
  }, { token: ownerToken, membership });
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return preflight(route);
    const reach = path.match(/^\/api\/platform\/users\/([^/]+)\/host-reach$/);
    if (reach && request.method() === 'PUT') {
      const body = request.postDataJSON() as { reach: string };
      writes.push({ userId: reach[1], reach: body.reach });
      bo.host_reach = body.reach;
      return route.fulfill({ json: { ok: true, host_reach: body.reach }, headers: cors });
    }
    if (path === '/api/platform/users') return route.fulfill({ json: { users: [bo] }, headers: cors });
    if (path === '/api/platform/accounts') return route.fulfill({ json: { accounts: [] }, headers: cors });
    return route.fulfill({ json: [], headers: cors });
  });
  await page.goto('/admin/platform?tab=users&host=bo', { waitUntil: 'domcontentloaded' });
  return writes;
}

test('Adrian sets a host’s reach to one of three plain choices, kept on the person', async ({ page }) => {
  test.slow();
  const writes = await openManage(page);
  const reach = page.getByRole('group', { name: 'Who can find their open tables' });
  await expect(reach).toBeVisible({ timeout: 30_000 });
  const linkOnly = reach.getByRole('button', { name: 'By their link only' });
  const signedIn = reach.getByRole('button', { name: 'Signed-in people on Teajia' });
  const listed = reach.getByRole('button', { name: 'The public sessions list' });
  await expect(linkOnly).toHaveAttribute('aria-pressed', 'true');
  await expect(signedIn).toHaveAttribute('aria-pressed', 'false');
  await expect(listed).toHaveAttribute('aria-pressed', 'false');

  await signedIn.click();
  await expect(signedIn).toHaveAttribute('aria-pressed', 'true');
  await expect(linkOnly).toHaveAttribute('aria-pressed', 'false');
  await expect(reach).toContainText('shown to people signed in to Teajia');

  await listed.click();
  await expect(listed).toHaveAttribute('aria-pressed', 'true');
  await expect(reach).toContainText('on the public sessions list');
  // Choosing the one already chosen writes nothing.
  await listed.click();
  expect(writes).toEqual([{ userId: 'bo', reach: 'teajia' }, { userId: 'bo', reach: 'listed' }]);

  // On a touch screen each choice is a full tap target, and the panel fits the phone without sideways scroll.
  for (const choice of [linkOnly, signedIn, listed]) {
    const box = await choice.boundingBox();
    expect(box && box.height >= 44).toBe(true);
    expect(box && box.x + box.width <= 390).toBe(true);
  }
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(scrolls).toBe(false);

  // A reload reads the person again: the choice stays.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('group', { name: 'Who can find their open tables' })
    .getByRole('button', { name: 'The public sessions list' })).toHaveAttribute('aria-pressed', 'true');
});

test('a host offered the open door sees it as a third way, still saying yes to each guest', async ({ page }) => {
  test.slow();
  const made: Record<string, unknown>[] = [];
  await openSwitches(page);
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), hostToken);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return preflight(route);
    if (path === '/api/me/hosting') {
      return route.fulfill({ json: { approved: false, account_id: 'bo-chest', doors: ['request', 'open'] }, headers: cors });
    }
    if (path === '/api/me/tables' && request.method() === 'POST') {
      made.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 201, json: { id: 't-bo', slug: 'bo-open', link: 'https://teajia.test/event/bo-open' }, headers: cors });
    }
    return route.fulfill({ json: [], headers: cors });
  });
  await page.goto('/account/host', { waitUntil: 'domcontentloaded' });
  const ways = page.getByRole('group', { name: 'How guests get a seat' });
  await expect(ways.getByRole('radio', { name: 'I say yes to each guest', exact: true })).toBeChecked();
  await expect(ways.getByRole('radio', { name: 'Anyone with the link has a seat' })).toHaveCount(0);
  const open = ways.getByRole('radio', { name: 'People on Teajia can find it, and I say yes to each guest' });
  await expect(open).toBeVisible();
  await expect(page.getByText(/listed|reach|invitation/i)).toHaveCount(0);

  await page.locator('input[name="date"]').fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  await page.locator('input[name="time"]').fill('16:00');
  await open.check();
  await page.getByRole('button', { name: 'Make the table' }).click();
  await expect.poll(() => made.length).toBe(1);
  expect(made[0]).toMatchObject({ door: 'open', seats: 6, time: '16:00' });
});
