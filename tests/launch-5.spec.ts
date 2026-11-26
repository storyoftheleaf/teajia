/**
 * Launch 5, the wider service: the journey, at phone and desktop size, against
 * the offline fixture sandbox (never the live shop).
 *
 *   - Tea credit (HOST_CREDIT_OPEN), through the worker routes: an order that
 *     began from Ana's thank-you is paid and Filled by the owner and earns; Ana
 *     asks to use it on her own order; the owner approves; the balance is right.
 *     The screens are a separate build (build/l5-credit-screens); their step
 *     is the labelled TODO below.
 *   - Circles and series (CIRCLES_OPEN): Ana makes a circle and a series, puts
 *     her tables in, and asks a guest of an earlier table back.
 *   - A host's own assistant key (HOST_TOKENS_OPEN): Ana makes one, sees it
 *     once, disconnects it, and /mcp refuses it.
 *   - The card for the table (VITE_TABLE_CARD_OPEN): the owner prints one.
 *   - With the switches off, none of it shows and no route answers.
 * Every page is checked for side scroll.
 *
 * Start, from this checkout, one state directory and two workers on it, and
 * one site for each (worker/sandbox/README.md, "offline fixtures"):
 *   state  TEAJIA_OFFLINE_FIXTURES_STATE=<dir> node --experimental-sqlite --experimental-strip-types sandbox/offline-fixtures.mjs --prepare-only
 *   ON     SANDBOX_PORT=8891 SANDBOX_INSPECTOR_PORT=9291 FIRST_TABLE_OPEN=true FEW_HOSTS_OPEN=true ANYONE_HOSTS_OPEN=true
 *          FAVOURITES_OPEN=true CIRCLES_OPEN=true HOST_TOKENS_OPEN=true HOST_CREDIT_OPEN=true (same command, no --prepare-only)
 *   OFF    SANDBOX_PORT=8892 SANDBOX_INSPECTOR_PORT=9292 with Launch 1 to 4 only
 *   sites  vite --port 7891 (VITE_API_URL and TEAJIA_API_PROXY at 8891, every VITE_ switch of ON plus
 *          VITE_CIRCLES_OPEN, VITE_HOST_TOKENS_OPEN, VITE_HOST_CREDIT_OPEN, VITE_TABLE_CARD_OPEN)
 *          and vite --port 7892 (at 8892, Launch 1 to 4 only).
 * Then: L5_ON_URL, L5_OFF_URL, L5_ON_API and L5_OFF_API override the defaults below.
 * People: ana / ana (an approved host), sandbox / sandbox (the shop's owner).
 */
import type { Browser, Page } from '@playwright/test';
import { expect, stubBrowserServices, test } from './fixtures';

const ON_URL = process.env.L5_ON_URL ?? 'http://127.0.0.1:7891';
const OFF_URL = process.env.L5_OFF_URL ?? 'http://127.0.0.1:7892';
const ON_API = process.env.L5_ON_API ?? 'http://127.0.0.1:8891';
const OFF_API = process.env.L5_OFF_API ?? 'http://127.0.0.1:8892';
const BALI = 'acc_teajia_bali';
const RUN = Date.now().toString(36).slice(-5);

test.use({
  actionTimeout: 10_000, navigationTimeout: 30_000,
  // A machine whose Chromium is not where Playwright looks names it here.
  ...(process.env.L5_CHROMIUM ? { launchOptions: { executablePath: process.env.L5_CHROMIUM } } : {}),
});
test.setTimeout(120_000);
// The steps share one sandbox and run in order; a failed step does not skip the next.
test.describe.configure({ mode: 'default' });

const SIZES = [
  { name: 'phone 390x844', width: 390, height: 844 },
  { name: 'desktop 1280x800', width: 1280, height: 800 },
];

type Session = { token: string; account: string };

async function login(page: Page, identifier: string, password: string, api = ON_API): Promise<Session> {
  const response = await page.request.post(`${api}/api/auth/login`, { data: { identifier, password } });
  expect(response.status(), `sign in ${identifier}`).toBe(200);
  const body = await response.json() as { token: string; active_account_id: string | null };
  return { token: body.token, account: body.active_account_id ?? '' };
}

async function signedInPage(browser: Browser, size: { width: number; height: number }, baseURL: string, session: Session) {
  const context = await browser.newContext({ baseURL, viewport: { width: size.width, height: size.height } });
  await stubBrowserServices(context);
  await context.addInitScript(({ token, account }) => {
    localStorage.setItem('teajia_token', token);
    if (account) localStorage.setItem('teajia_active_account', account);
  }, session);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function call(page: Page, api: string, session: Session | null, path: string, init: { method?: string; data?: unknown; account?: string } = {}) {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (init.account ?? session?.account) headers['X-Teajia-Account'] = init.account ?? session!.account;
  const response = await page.request.fetch(`${api}${path}`, {
    method: init.method ?? 'GET', headers, ...(init.data !== undefined ? { data: init.data } : {}),
  });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status(), body };
}

async function mcp(page: Page, api: string, secret: string, method: string, params: Record<string, unknown> = {}) {
  const response = await page.request.post(`${api}/mcp`, {
    headers: { Authorization: `Bearer ${secret}` }, data: { jsonrpc: '2.0', id: 1, method, params },
  });
  return response.status();
}

async function noSideScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `horizontal overflow in px: ${where}`).toBeLessThanOrEqual(0);
}

function dayAhead(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// A dev server compiles each part of the site on its first visit, and may
// reload its dependencies once while it does. Visit every page the journey
// opens first, so no step mistakes that first compile for a failure.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  // Only a warm-up: whatever goes wrong here, the steps themselves say so.
  try { for (const [base, api] of [[ON_URL, ON_API], [OFF_URL, OFF_API]] as const) {
    const owner = await login(page, 'sandbox', 'sandbox', api);
    await page.goto(base, { waitUntil: 'commit', timeout: 90_000 });
    await page.evaluate(({ token }) => { localStorage.setItem('teajia_token', token); localStorage.setItem('teajia_active_account', 'acc_teajia_bali'); }, owner);
    for (const path of ['/admin/events/l5-card-event', '/admin/events/l5-card-test/card', '/account/host']) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
      }
    }
  } } catch { /* warm-up only */ }
  await context.close().catch(() => {});
});

// ── Tea credit, through the worker routes ──────────────────────────────────────

test('credit: earned on a Filled order, asked for by the host, approved by the owner, and the balance is right', async ({ page }) => {
  const owner = await login(page, 'sandbox', 'sandbox');
  owner.account = BALI;
  const ana = await login(page, 'ana', 'ana');

  // The order Mei placed from Ana's thank-you is held as pending once it comes in.
  const before = await call(page, ON_API, ana, '/api/me/tea-credit');
  expect(before.status).toBe(200);
  expect(before.body.balances.find((b: any) => b.account_id === BALI)?.available ?? 0).toBe(0);

  // The owner records the payment and fills the order by hand.
  const paid = await call(page, ON_API, owner, '/api/invoices/l5-guest-order/payments', {
    method: 'POST', data: { amount: 50, request_id: `l5-pay-${RUN}` },
  });
  expect(paid.status, JSON.stringify(paid.body)).toBe(201);
  const pendingNow = await call(page, ON_API, ana, '/api/me/tea-credit');
  expect(pendingNow.body.balances[0]).toMatchObject({ account_id: BALI, available: 0 });
  // A paid order is filled through its own action: shipping it.
  const filled = await call(page, ON_API, owner, '/api/rpc/ship-invoice', { method: 'POST', data: { invoice_id: 'l5-guest-order' } });
  expect(filled.status, JSON.stringify(filled.body)).toBe(200);

  const earned = await call(page, ON_API, ana, '/api/me/tea-credit');
  expect(earned.body.balances[0]).toMatchObject({ account_id: BALI, currency: 'USD', earned: 5, available: 5, pending: 0, held: 0, spent: 0 });
  expect(earned.body.lines).toEqual([expect.objectContaining({ status: 'earned', credit_amount: 5 })]);
  expect(JSON.stringify(earned.body), 'the host never reads who bought').not.toContain('Mei');
  expect(earned.body.orders).toEqual([expect.objectContaining({ invoice_id: 'l5-ana-order', tea_total: 10, may_use: 5 })]);

  // Ana asks to use it on her own order. Any amount she sends is ignored.
  const asked = await call(page, ON_API, ana, '/api/me/tea-credit/orders/l5-ana-order/use', { method: 'POST', data: { amount: 999 } });
  expect(asked.status, JSON.stringify(asked.body)).toBe(201);
  expect(asked.body.request).toMatchObject({ amount: 5, currency: 'USD' });
  expect((await call(page, ON_API, ana, '/api/me/tea-credit')).body.balances[0]).toMatchObject({ available: 0, held: 5, spent: 0 });
  // She cannot use it on Mei's order, nor approve her own request.
  expect((await call(page, ON_API, ana, '/api/me/tea-credit/orders/l5-guest-order/use', { method: 'POST' })).status).toBe(404);
  const requestId = asked.body.request.id as string;
  expect((await call(page, ON_API, ana, `/api/host-credit/spend-requests/${requestId}/approve`, { method: 'POST' })).status).not.toBe(200);
  expect((await call(page, ON_API, ana, `/api/host-credit/spend-requests/${requestId}/approve`, { method: 'POST', account: BALI })).status).toBe(403);

  // The owner sees it in the shop's credit and approves it.
  const shop = await call(page, ON_API, owner, '/api/host-credit');
  expect(shop.status).toBe(200);
  expect(shop.body.spend_requests).toEqual([expect.objectContaining({ id: requestId, status: 'held', amount: 5 })]);
  const approved = await call(page, ON_API, owner, `/api/host-credit/spend-requests/${requestId}/approve`, { method: 'POST', data: {} });
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  const again = await call(page, ON_API, owner, `/api/host-credit/spend-requests/${requestId}/approve`, { method: 'POST', data: {} });
  expect(again.body).toMatchObject({ ok: true, idempotent: true });

  const after = await call(page, ON_API, ana, '/api/me/tea-credit');
  expect(after.body.balances[0]).toMatchObject({ earned: 5, spent: 5, held: 0, available: 0, debt: 0 });
  expect(after.body.requests).toEqual([expect.objectContaining({ id: requestId, status: 'approved', amount: 5 })]);
});

// TODO(l5-credit-screens): the credit screens are being built on
// build/l5-credit-screens (the host's credit in Your Table, using credit at
// checkout, the owner's approval in Manage). Once they land, this step walks
// the same journey as the test above in the browser at both sizes.
test.fixme('TODO credit screens: the host sees and uses credit, the owner approves in Manage', async () => {});

// ── Circles, the assistant key and the card, at each size ──────────────────────

for (const [index, size] of SIZES.entries()) {
  test.describe(size.name, () => {
    test('circles: a circle and a series, and a guest of an earlier table asked back', async ({ browser }) => {
      const probe = await browser.newContext();
      const ana = await login(await probe.newPage(), 'ana', 'ana');
      await probe.close();
      const { context, page, errors } = await signedInPage(browser, size, ON_URL, ana);
      // A new table ahead for this size, made the way the host's page makes one.
      const made = await call(page, ON_API, ana, '/api/me/tables', {
        method: 'POST',
        data: { date: dayAhead(14 + index), time: '18:00', timezone: 'Asia/Makassar', seats: 4, door: 'request', name: `Circle table ${RUN} ${index}`, area: null },
      });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      const tableId = made.body.id as string;

      await page.goto('/account/host');
      const section = page.getByTestId('host-circles');
      await expect(section.getByRole('heading', { name: 'Circles and series', level: 2 })).toBeVisible();

      const circleName = 'Thursday tea';
      if (index === 0) {
        await section.getByRole('button', { name: 'Make a circle or series' }).click();
        await expect(page).toHaveURL(/[?&]circle=new/);
        const form = section.getByTestId('host-circle-new');
        await form.getByRole('textbox', { name: 'Name' }).fill(circleName);
        await noSideScroll(page, 'making a circle');
        await form.getByRole('button', { name: 'Make it' }).click();
        await expect(section.getByRole('heading', { name: circleName })).toBeVisible();
        // The finished table goes in first: its guest is the one asked back.
        const circle = section.getByRole('article', { name: circleName });
        const past = circle.getByLabel('Put a table in').locator('option', { hasText: 'Ana’s table, a test sit' });
        await circle.getByLabel('Put a table in').selectOption(await past.getAttribute('value') ?? '');
        await circle.getByRole('button', { name: 'Put it in' }).click();
        await expect(circle.getByText(/Ana’s table, a test sit/)).toBeVisible();
      }

      // A series of its own at each size.
      const seriesName = `Spring series ${RUN} ${index}`;
      await section.getByRole('button', { name: 'Make a circle or series' }).click();
      const form = section.getByTestId('host-circle-new');
      await form.getByRole('textbox', { name: 'Name' }).fill(seriesName);
      await form.getByRole('radio', { name: /series/i }).check();
      await form.getByRole('button', { name: 'Make it' }).click();
      const series = section.getByRole('article', { name: seriesName });
      await expect(series.getByText('Series', { exact: true })).toBeVisible();

      // This size's new table goes in the circle.
      const circle = section.getByRole('article', { name: circleName });
      const option = circle.getByLabel('Put a table in').locator('option', { hasText: `Circle table ${RUN} ${index}` });
      await circle.getByLabel('Put a table in').selectOption(await option.getAttribute('value') ?? '');
      await circle.getByRole('button', { name: 'Put it in' }).click();
      await expect(circle.getByText(new RegExp(`Circle table ${RUN} ${index}`))).toBeVisible();
      await noSideScroll(page, 'circles on the host page');
      await expect(section).not.toContainText(/\d+ (times|tables|guests|meetings)/);

      // On the new table's page, the guest of the earlier table, by name only.
      await page.goto(`/account/host/${encodeURIComponent(tableId)}`);
      const back = page.getByTestId('circle-guests');
      await expect(back.getByRole('heading', { name: `From ${circleName}` })).toBeVisible();
      await expect(back).toContainText('Rui Guest');
      await expect(back).not.toContainText(/@|\+62|Ubud|Ana’s home/);
      await noSideScroll(page, 'asking a guest back');
      await back.getByRole('button', { name: 'Ask to this table' }).first().click();
      await expect(back.getByRole('status')).toHaveText('Rui Guest has a seat.');
      // The answer the host page reads carries no contact of the guest.
      const answer = await call(page, ON_API, ana, `/api/me/tables/${encodeURIComponent(tableId)}/circle-guests`);
      expect(JSON.stringify(answer.body)).not.toMatch(/@|phone|email|address/i);
      expect(errors, 'page errors').toEqual([]);
      await context.close();
    });

    test('the host makes an assistant key, sees it once, disconnects it, and /mcp refuses it', async ({ browser }) => {
      const probe = await browser.newContext();
      const ana = await login(await probe.newPage(), 'ana', 'ana');
      await probe.close();
      const { context, page, errors } = await signedInPage(browser, size, ON_URL, ana);
      await page.goto('/account/host');
      const section = page.getByTestId('host-assistant');
      await expect(section.getByRole('heading', { name: 'Your assistant', level: 2 })).toBeVisible();
      await section.getByRole('button', { name: 'Connect an assistant' }).click();
      await expect(page).toHaveURL(/[?&]assistant=new/);
      const label = `Claude ${RUN} ${index}`;
      const form = section.getByTestId('host-assistant-new');
      await expect(form).toContainText('/mcp');
      await form.getByRole('textbox', { name: 'Name it' }).fill(label);
      await form.getByRole('button', { name: 'Make the key' }).click();

      const shown = section.getByTestId('host-assistant-secret');
      await expect(shown).toContainText('shown this once');
      const secret = await shown.getByTestId('host-assistant-secret-value').inputValue();
      expect(secret).toMatch(/^tjmcp_[A-Za-z0-9_-]{43}$/);
      await noSideScroll(page, 'the key, shown once');
      expect(await mcp(page, ON_API, secret, 'tools/list'), 'the new key works').toBe(200);
      await shown.getByRole('button', { name: 'Done' }).click();
      await expect(page.locator('body')).not.toContainText(secret);
      // Reloaded, the secret is in no answer the page reads.
      await page.reload();
      const row = section.getByTestId('host-assistant-key').filter({ hasText: label });
      await expect(row).toBeVisible();
      await expect(page.locator('body')).not.toContainText(secret);
      const listed = await call(page, ON_API, ana, '/api/me/assistant-tokens');
      expect(JSON.stringify(listed.body)).not.toContain(secret);

      await row.getByRole('button', { name: 'Disconnect' }).click();
      await expect(row.getByTestId('host-assistant-disconnect')).toContainText('It stops working at once');
      await noSideScroll(page, 'disconnecting a key');
      await row.getByTestId('host-assistant-disconnect').getByRole('button', { name: 'Disconnect' }).click();
      await expect(section.getByTestId('host-assistant-key').filter({ hasText: label })).toHaveCount(0);
      expect(await mcp(page, ON_API, secret, 'tools/list'), 'the disconnected key is refused').toBe(401);
      expect(await mcp(page, ON_API, secret, 'tools/call', { name: 'list_my_tables', arguments: {} })).toBe(401);
      expect(errors, 'page errors').toEqual([]);
      await context.close();
    });

    test('the owner prints a card for the table', async ({ browser }) => {
      const probe = await browser.newContext();
      const owner = await login(await probe.newPage(), 'sandbox', 'sandbox');
      await probe.close();
      owner.account = BALI;
      const { context, page, errors } = await signedInPage(browser, size, ON_URL, owner);
      await page.goto('/admin/events/l5-card-event');
      const link = page.getByRole('link', { name: 'Print a card for the table' });
      await expect(link).toBeVisible({ timeout: 20_000 });
      await noSideScroll(page, 'the session in Manage');
      await link.click();
      await expect(page).toHaveURL(/\/admin\/events\/l5-card-test\/card/);
      await expect(page.getByRole('heading', { name: 'A card for the table, test' })).toBeVisible();
      const card = page.locator('.session-card');
      await expect(card).toContainText('Old tree white, test');
      await expect(card).toContainText('Mountain red, test');
      await expect(card).toContainText('A roasted oolong from a friend');
      await expect(card).not.toContainText(/\$|USD|stock|Yuan/);
      await expect(card.getByRole('img', { name: 'Session link QR code' })).toBeVisible();
      await noSideScroll(page, 'the card');
      expect(errors, 'page errors').toEqual([]);
      await context.close();
    });

    test('with the switches off, none of it shows and no route answers', async ({ browser }) => {
      const probe = await browser.newContext();
      const probePage = await probe.newPage();
      const ana = await login(probePage, 'ana', 'ana', OFF_API);
      const owner = { ...(await login(probePage, 'sandbox', 'sandbox', OFF_API)), account: BALI };
      // A live key made while open does not work while closed.
      const anaOn = await login(probePage, 'ana', 'ana');
      const minted = await call(probePage, ON_API, anaOn, '/api/me/assistant-tokens', { method: 'POST', data: { label: `Off check ${RUN} ${index}` } });
      expect(minted.status).toBe(201);
      expect(await mcp(probePage, OFF_API, minted.body.token, 'tools/list')).toBe(401);
      expect(await mcp(probePage, ON_API, minted.body.token, 'tools/list')).toBe(200);
      for (const [method, path] of [
        ['GET', '/api/me/circles'], ['POST', '/api/me/circles'], ['GET', '/api/me/assistant-tokens'], ['POST', '/api/me/assistant-tokens'],
        ['GET', '/api/me/tea-credit'], ['POST', '/api/me/tea-credit/orders/l5-ana-order/use'],
      ] as const) {
        expect((await call(probePage, OFF_API, ana, path, { method, data: { name: 'x', kind: 'circle', label: 'x' } })).status, `${method} ${path}`).toBe(404);
      }
      expect((await call(probePage, OFF_API, owner, '/api/host-credit')).status).toBe(404);
      expect((await call(probePage, ON_API, anaOn, `/api/me/assistant-tokens/${minted.body.id}`, { method: 'DELETE' })).status).toBe(200);
      await probe.close();

      const host = await signedInPage(browser, size, OFF_URL, ana);
      await host.page.goto('/account/host');
      await expect(host.page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
      await expect(host.page.getByRole('heading', { name: 'Circles and series' })).toHaveCount(0);
      await expect(host.page.getByRole('heading', { name: 'Your assistant' })).toHaveCount(0);
      await expect(host.page.locator('body')).not.toContainText(/tea credit/i);
      await noSideScroll(host.page, 'the host page, closed');
      const table = await call(host.page, OFF_API, ana, '/api/me/tables');
      const someTable = (table.body.tables ?? [])[0]?.id as string | undefined;
      if (someTable) {
        await host.page.goto(`/account/host/${encodeURIComponent(someTable)}`);
        await expect(host.page.getByTestId('circle-guests')).toHaveCount(0);
      }
      expect(host.errors, 'page errors').toEqual([]);
      await host.context.close();

      const shop = await signedInPage(browser, size, OFF_URL, owner);
      await shop.page.goto('/admin/events/l5-card-event');
      await expect(shop.page.getByRole('heading', { name: 'A card for the table, test' }).first()).toBeVisible({ timeout: 20_000 });
      await expect(shop.page.getByRole('link', { name: 'Print a card for the table' })).toHaveCount(0);
      await noSideScroll(shop.page, 'the session in Manage, closed');
      await shop.page.goto('/admin/events/l5-card-test/card');
      await expect(shop.page.locator('.session-card')).toHaveCount(0);
      await shop.context.close();
    });
  });
}
