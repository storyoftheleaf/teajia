/**
 * W3: the owner (Adrian, `sandbox`) in Manage and by tool, every switch open.
 *
 *   node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --slot 3
 *   set -a; . test-results/review/slot-3.env; set +a
 *   REVIEW_CHROMIUM=... npx playwright test -c tests/review/review.config.ts --trace off owner-walk
 *
 * Every task starts at Manage's front page (Today, /admin/dashboard) and counts real taps.
 * Data the fixture does not hold (a report, host credit) is filed through the real routes
 * as the guest or the host, as a person would. Tests and findings only; no product code.
 */
import { expect, test } from '../fixtures';
import type { Page } from '@playwright/test';
import { BALI, REVIEW_API, call, login, noSideScroll, quiet, signIn, task } from './helpers';

const TODAY = '/admin/dashboard';
const RUN = Date.now().toString(36).slice(-4);

async function settle(page: Page) { await page.waitForLoadState('networkidle').catch(() => {}); }

/** A Manage room by its word: the desktop rail, or the phone's bar, or the phone's Menu. */
async function room(page: Page, name: string | RegExp) {
  const direct = page.getByRole('link', { name, exact: typeof name === 'string' }).or(page.getByRole('button', { name, exact: typeof name === 'string' })).filter({ visible: true } as any);
  if (await direct.count()) { await direct.first().click(); return; }
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name, exact: typeof name === 'string' }).or(page.getByRole('button', { name, exact: typeof name === 'string' })).first().click();
}

/**
 * A page that lives under a room (Guest notes under Publish). On the desktop the room's column lists
 * it. If a size shows no door to it, that is recorded as a finding and the walk goes on by address.
 */
async function child(page: Page, roomName: string, childName: string, fallback: string, info: { project: { name: string } }) {
  await room(page, roomName);
  const door = page.getByRole('link', { name: childName, exact: true }).or(page.getByRole('button', { name: childName, exact: true })).filter({ visible: true } as any);
  await door.first().waitFor({ timeout: 4000 }).catch(() => {});
  if (await door.count()) { await door.first().click(); return; }
  console.log(`NO DOOR: ${childName} under ${roomName} at ${info.project.name}; tasks go on by address`);
  expect.soft(false, `${childName} has a door under ${roomName} at ${info.project.name}`).toBe(true);
  await page.goto(fallback);
}

/**
 * A new page in the same signed-in context, opened on Manage's front page. The shared task() helper binds its
 * counter once per page, so a second task on one page counts into the first (see Conflicts for Opus in the findings).
 */
async function fresh(page: Page) {
  const next = await page.context().newPage();
  await next.goto(TODAY); await settle(next);
  return next;
}

async function ownerPage(page: Page) {
  const s = await signIn(page, 'owner');
  return s;
}

// ── 7. The same three actions through /mcp (runs first: it must see the order still waiting) ──

test.describe('the owner by tool', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-1280', 'tool calls do not depend on the size'));

  test('7. host approval, a Tea Table hold, and a Filled order, each previews then needs the confirm', async ({ page }) => {
    const owner = await login(page, 'owner'); owner.account = BALI;
    const minted = await call(page, owner, '/api/admin/mcp-tokens', { method: 'POST', data: { label: `w3-${RUN}`, scopes: ['admin:write', 'stock:write', 'inventory:read', 'catalog:write', 'sales:write', 'orders:write'] } });
    console.log('MINT', minted.status, JSON.stringify(minted.body).replace(/"token":"[^"]+"/, '"token":"..."'));
    expect(minted.status).toBe(201);
    const token = minted.body.token as string;
    let id = 1;
    const rpc = async (method: string, params: unknown) => {
      const res = await page.request.post(`${REVIEW_API}/mcp`, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}` },
        data: { jsonrpc: '2.0', id: id++, method, params },
      });
      const text = (await res.text()).trim();
      const line = text.startsWith('data:') ? text.split('\n').find(l => l.startsWith('data:'))!.slice(5) : text;
      return { status: res.status(), json: JSON.parse(line) };
    };
    const tool = async (name: string, args: unknown) => {
      const r = await rpc('tools/call', { name, arguments: args });
      const t = r.json?.result?.content?.[0]?.text;
      let body: any = t; try { body = JSON.parse(t); } catch { /* text */ }
      return { status: r.status, error: r.json?.error, isError: r.json?.result?.isError, body };
    };
    const listed = await rpc('tools/list', {});
    const names: string[] = (listed.json?.result?.tools ?? []).map((t: any) => t.name);
    console.log('OWNER TOOLS (new ones):', names.filter(n => /host|tea_table|credit|stop|let_host|report|house|top_tea|article|card|fulfill|invoice/.test(n)).join(', '));
    const hasTool = (n: string) => names.includes(n);
    console.log('ALL TOOLS:', names.join(' '));

    const twoStep = async (name: string, args: Record<string, unknown>, label: string, confirmWith: Record<string, unknown> = {}) => {
      if (!hasTool(name)) { console.log(`NO TOOL: ${name} (${label})`); return null; }
      const preview = await tool(name, args);
      console.log(`${label} PREVIEW:`, JSON.stringify(preview.body).slice(0, 300));
      const ticket = preview.body?.confirmation_token ?? preview.body?.confirm ?? preview.body?.ticket;
      expect(ticket, `${label}: a preview carries a confirmation token`).toBeTruthy();
      // A preview alone changes nothing; the confirm commits.
      const done = await tool(name, { ...confirmWith, confirm: ticket });
      console.log(`${label} CONFIRM:`, String(JSON.stringify(done.body ?? { status: done.status, error: done.error, isError: done.isError })).slice(0, 300));
      return { preview, done };
    };
    const jun = await login(page, 'jun');
    await twoStep('set_host_approval', { user_id: (await call(page, jun, '/api/auth/me')).body.user?.id ?? (await call(page, jun, '/api/auth/me')).body.id, approved: true }, 'approve host');
    await twoStep('stop_host', { user_id: (await call(page, jun, '/api/auth/me')).body.user?.id ?? (await call(page, jun, '/api/auth/me')).body.id }, 'stop host');
    await twoStep('let_host_again', { user_id: (await call(page, jun, '/api/auth/me')).body.user?.id ?? (await call(page, jun, '/api/auth/me')).body.id }, 'let host again');
    // Tea Table: find a piece through the owner's own route.
    const manage = await call(page, owner, '/api/admin/tea-table');
    console.log('TEA TABLE MANAGE ROUTE', manage.status);
    const items = (manage.body?.items ?? []) as any[];
    console.log('TEA TABLE PIECES', JSON.stringify(items.map(i => ({ kind: i.kind, id: i.id, hidden: i.hidden, showing: i.showing }))));
    expect(items[0], 'the fixture has a piece on the Tea Table').toBeTruthy();
    await twoStep('hold_tea_table_piece', { kind: items[0].kind, id: items[0].id, days: 2 }, 'hold piece');
    await twoStep('hide_tea_table_piece', { kind: items[0].kind, id: items[0].id }, 'hide piece');
    const after = await call(page, owner, '/api/admin/tea-table');
    expect(after.body.items[0], 'the tool hide is seen by the owner screen').toMatchObject({ hidden: true });
    await call(page, owner, '/api/admin/tea-table/hide', { method: 'POST', data: { kind: items[0].kind, id: items[0].id, hidden: false } });
    // Sales: Filled.
    await twoStep('fulfill_invoice', { invoice_id: 'l5-guest-order' }, 'fill order', { invoice_id: 'l5-guest-order' });
    // What the owner can do in Manage from the five launches, and whether any tool does it.
    const owned = names.filter(n => /credit|reach|report|house|portfolio|top_tea|offer|card|wisdom_claim/.test(n));
    console.log('TOOLS FOR CREDIT / REACH / REPORTS / HOUSES / TOP TEAS / OFFERS / CARD:', owned.join(', ') || 'none');
    expect.soft(owned.filter(n => /credit/.test(n)), 'a tool to approve or decline host credit').not.toEqual([]);
    expect.soft(owned.filter(n => /reach/.test(n)), 'a tool to set a host\'s reach').not.toEqual([]);
    expect.soft(owned.filter(n => /report/.test(n) && n !== 'report'), 'a tool to read and resolve reports').not.toEqual([]);
  });
});

// ── 1. Hosting: approve, reach, stop ───────────────────────────────────────────

async function toHosting(page: Page, person: string) {
  await room(page, 'Settings');
  await page.getByRole('link', { name: 'Platform', exact: true }).or(page.getByRole('button', { name: 'Platform', exact: true })).first().click();
  await page.getByRole('button', { name: /^users$/i }).click();
  const row = page.locator('div').filter({ hasText: person }).filter({ has: page.getByTestId('hosting-open') }).last();
  await row.getByTestId('hosting-open').click();
  await expect(page.getByTestId('hosting-panel')).toBeVisible();
}

test.describe('the owner walk', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!['desktop-1280', 'phone-390'].includes(info.project.name), 'tasks are counted at desktop and phone 390; 320 runs the scroll check');
    await ownerPage(page);
  });

  test('1a. sees a person, lets them host by link, sets how widely their tables are shown', async ({ page: first }, info) => {
    let page = await fresh(first);
    const q = quiet(page);
    await task(page, 'owner: let Jun host by link and set how widely their tables show', 2, async () => {
      await toHosting(page, 'Jun Taster');
      const panel = page.getByTestId('hosting-panel');
      // Reset from an earlier run at another size.
      if (await panel.getByRole('button', { name: /Stop hosting by link/ }).count()) {
        await panel.getByRole('button', { name: /Stop hosting by link/ }).click();
        await panel.getByRole('button', { name: /Stop\? Their links close now/ }).click();
      }
      await panel.getByTestId('host-approve').click();
      await expect(panel.getByRole('button', { name: /Stop hosting by link/ })).toBeVisible();
      await page.getByTestId('host-reach-listed').click();
      await expect(page.getByTestId('host-reach-listed')).toHaveAttribute('aria-pressed', 'true');
    }, info);
    q.check('hosting');
  });

  test('1b. later stops their hosting, and lets them again', async ({ page: first }, info) => {
    let page = first;
    page = await fresh(page);
    await task(page, 'owner: stop all hosting for Jun', 2, async () => {
      await toHosting(page, 'Jun Taster');
      const panel = page.getByTestId('hosting-stop');
      if (await panel.getByRole('button', { name: /Let them host again/ }).count()) await panel.getByRole('button', { name: /Let them host again/ }).click();
      await panel.getByRole('button', { name: /Stop all hosting/ }).click();
      await panel.getByRole('button', { name: /Stop\? No new tables or seats/ }).click();
      await expect(panel.getByRole('button', { name: /Let them host again/ })).toBeVisible();
    }, info);
    // The guest-facing effect: Jun may not make a table now.
    const jun = await login(page, 'jun');
    const made = await call(page, jun, '/api/me/tables', { method: 'POST', data: { title: 'Stopped table' } });
    expect([403, 404, 409, 400, 405, 422]).toContain(made.status);
    await page.getByRole('button', { name: /Let them host again/ }).click();
  });

  test('2. reads a report about a session and acts on it', async ({ page: first }, info) => {
    let page = first;
    const mei = await login(page, 'guest');
    const filed = await call(page, mei, '/api/session-reports', { method: 'POST', data: { target_kind: 'session', target_id: 'rv-event-now', reason: `Too loud ${RUN} ${info.project.name}` } });
    expect(filed.status).toBe(201);
    page = await fresh(page);
    await task(page, 'owner: act on a session report', 2, async () => {
      await child(page, 'Publish', 'Guest notes', '/admin/tasting-notes', info);
      await expect(page.getByText(`Too loud ${RUN}`)).toBeVisible({ timeout: 15_000 });
      const row = page.locator('li').filter({ hasText: `Too loud ${RUN}` });
      await row.getByRole('button').first().click();
      await expect(page.getByText(`Too loud ${RUN}`)).toHaveCount(0);
    }, info);
  });

  test('3. Tea Table: sees the keeps, holds a piece, hides one; nobody else sees the keeps', async ({ page: first }, info) => {
    let page = first;
    const mei = await login(page, 'guest');
    // Mei keeps the piece, privately.
    const kept = await call(page, mei, '/api/tea-table/keeps/tasting/l4-journal-jun', { method: 'PUT' });
    console.log('MEI KEEPS THE PIECE:', kept.status);
    page = await fresh(page);
    await task(page, 'owner: Tea Table, see the keeps and hold a piece at the top', 2, async () => {
      await child(page, 'Publish', 'Guest notes', '/admin/tasting-notes', info);
      const section = page.getByTestId('tea-table-manage');
      await expect(section.getByText(/Kept by one person|Not kept yet/)).toBeVisible({ timeout: 15_000 });
      if (await section.getByRole('button', { name: /Let it go/ }).count()) await section.getByRole('button', { name: /Let it go/ }).first().click();
      await section.getByRole('button', { name: /Hold at the top/ }).first().click();
      await expect(section.getByText(/Held until/)).toBeVisible();
    }, info);
    const text = await page.getByTestId('tea-table-manage').innerText();
    console.log('KEEPS SHOWN TO OWNER:', /Kept by one person|Kept by \d+ people|Not kept yet/.exec(text)?.[0]);
    // Nobody else reads the number: not Mei, not a signed-out visitor, and the owner's list is refused to Mei.
    const keepShape = /keep_count|"keeps"|kept_by|keep_total|keeps_count/i;
    const table = await call(page, mei, '/api/tea-table');
    expect(JSON.stringify(table.body), 'a member reads no keep count').not.toMatch(keepShape);
    const anon = await call(page, null, '/api/tea-table');
    expect(JSON.stringify(anon.body), 'a visitor reads no keep count').not.toMatch(keepShape);
    const meiManage = await call(page, mei, '/api/admin/tea-table');
    expect([401, 403, 404]).toContain(meiManage.status);
    // Hide it, then bring it back (leaves the shop as it was found).
    page = await fresh(page);
    await task(page, 'owner: Tea Table, hide a piece', 2, async () => {
      await child(page, 'Publish', 'Guest notes', '/admin/tasting-notes', info);
      const section = page.getByTestId('tea-table-manage');
      await section.getByRole('button', { name: /Hide it/ }).first().click();
      await expect(section.getByText('Hidden', { exact: true })).toBeVisible();
    }, info);
    await page.getByTestId('tea-table-manage').getByRole('button', { name: /Bring it back/ }).first().click();
    await expect(page.getByTestId('tea-table-manage').getByRole('button', { name: /Hide it/ }).first()).toBeVisible();
    await call(page, mei, '/api/tea-table/keeps/tasting/l4-journal-jun', { method: 'DELETE' });
  });

  test('4. Sales: fills a guest order, reads the host credit, approves one request and declines another', async ({ page: first }, info) => {
    let page = first;
    const owner = await login(page, 'owner'); owner.account = BALI;
    const ana = await login(page, 'host');
    // A guest order that began at Ana's thank-you is paid, then Filled by the owner's own screen.
    page = await fresh(page);
    await task(page, 'owner: Sales, find the waiting guest order', 2, async () => {
      await room(page, 'Sales');
      await expect(page.getByText(/L5-/).first()).toBeVisible({ timeout: 15_000 });
    }, info);
    console.log('SALES URL:', page.url());
    for (const id of ['l5-guest-order', 'l5-guest-order-2', 'l5-guest-order-3']) {
      await call(page, owner, `/api/invoices/${id}/payments`, { method: 'POST', data: { amount: 50, request_id: `w3-pay-${id}-${RUN}` } });
      await call(page, owner, '/api/rpc/ship-invoice', { method: 'POST', data: { invoice_id: id } });
    }
    const credit = await call(page, ana, '/api/me/tea-credit');
    console.log('ANA CREDIT:', JSON.stringify(credit.body.balances));
    for (const id of ['l5-ana-order', 'l5-ana-order-2']) {
      const asked = await call(page, ana, `/api/me/tea-credit/orders/${id}/use`, { method: 'POST', data: {} });
      console.log('ANA ASKS TO USE CREDIT ON', id, asked.status, JSON.stringify(asked.body).slice(0, 160));
    }
    page = await fresh(page);
    await task(page, 'owner: Sales > Waiting, approve one credit request and decline another', 2, async () => {
      await room(page, 'Sales');
      const waiting = page.getByRole('button', { name: /^waiting/i }).or(page.getByRole('link', { name: /^waiting/i }));
      if (await waiting.count() && !/tab=waiting/.test(page.url())) await waiting.first().click();
      const section = page.getByRole('region', { name: 'Tea credit' });
      await expect(section).toBeVisible({ timeout: 15_000 });
      await expect(section.getByRole('listitem', { name: /asks to use \$/ }).or(section.getByText('No credit waiting for you.')).first()).toBeVisible({ timeout: 15_000 });
      const asks = section.getByRole('listitem', { name: /asks to use \$/ });
      const n = await asks.count();
      console.log('CREDIT REQUESTS HELD:', n);
      if (n >= 1) await asks.first().getByRole('button', { name: 'Approve' }).click();
      if (n >= 2) await section.getByRole('listitem', { name: /asks to use \$/ }).first().getByRole('button', { name: 'Decline' }).click();
    }, info);
  });

  test('5. Tea house words, a person\'s top teas, an article a host offered', async ({ page: first }, info) => {
    let page = first;
    page = await fresh(page);
    await task(page, 'owner: write the portfolio words for a tea house', 2, async () => {
      await room(page, 'Settings');
      await expect(page.getByRole('heading', { name: /tea houses?/i }).first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('heading', { name: /tea houses?/i }).first().scrollIntoViewIfNeeded();
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /tea houses?/i }) }).first();
      console.log('PORTFOLIO TEXT:', (await section.innerText()).slice(0, 500).replace(/\n+/g, ' | '));
      await section.getByRole('button').first().click();
    }, info);
    console.log('HOUSE URL:', page.url());
    // A person's top teas: the route takes the profile's own user alone.
    const owner = await login(page, 'owner');
    const put = await call(page, owner, '/api/public/people/jun-taster/top-teas/1', { method: 'PUT', data: {} });
    console.log('OWNER PUT TOP TEA FOR ANOTHER PERSON:', put.status);
    page = await fresh(page);
    await task(page, 'owner: read the article offers', 2, async () => {
      await room(page, 'Publish');
      await page.getByRole('button', { name: /Article offers/ }).or(page.getByRole('link', { name: /Article offers/ })).first().click();
      await expect(page.getByText(/offer/i).first()).toBeVisible();
    }, info);
    console.log('OFFERS URL:', page.url(), (await page.locator('main').innerText()).slice(0, 400).replace(/\n+/g, ' | '));
  });

  test('6. prints the card for a table', async ({ page: first }, info) => {
    let page = first;
    page = await fresh(page);
    await task(page, 'owner: print the card for a table', 2, async () => {
      await room(page, 'Sessions');
      await page.getByText('A card for the table, test').first().click();
      await page.getByRole('link', { name: /Print a card for the table/ }).click();
      await expect(page).toHaveURL(/\/card$/);
    }, info);
  });
});

// ── 8. Manage at the phone: every owner page scrolls, has Back, and browser back and forward work ──

const OWNER_PAGES: Array<{ name: string; path: string }> = [
  { name: 'Platform > Users', path: '/admin/platform?tab=users' },
  { name: 'Guest notes (reports, Tea Table)', path: '/admin/tasting-notes' },
  { name: 'Sales > Waiting (tea credit)', path: '/admin/activity?tab=waiting' },
  { name: 'Settings (tea houses)', path: '/admin/account-settings' },
  { name: 'Magazine (article offers)', path: '/admin/magazine' },
  { name: 'Sessions', path: '/admin/events' },
  { name: 'Card for a table', path: '/admin/events/l5-card-test/card' },
];

test.describe('Manage on the phone', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'desktop-1280', 'phone sizes');
    await ownerPage(page);
  });

  for (const p of OWNER_PAGES) {
    test(`8. ${p.name}: no side scroll, scrolls to the end, Back top-left`, async ({ page }) => {
      const q = quiet(page);
      await page.goto('/admin/dashboard'); await settle(page);
      // Arrive as a person who tapped there: a step in the visit, so Back has somewhere to go.
      await page.evaluate((to) => {
        const idx = ((window.history.state as { idx?: number } | null)?.idx ?? 0) + 1;
        window.history.pushState({ usr: null, key: `w3${idx}`, idx }, '', to);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      }, p.path);
      await settle(page); await page.waitForTimeout(2000);
      await noSideScroll(page, p.name);
      const scrolled = await page.evaluate(async () => {
        const cands = [document.scrollingElement as HTMLElement, ...Array.from(document.querySelectorAll<HTMLElement>('main, [class*="overflow-y"]'))];
        const el = cands.find(c => c && c.scrollHeight > c.clientHeight + 4);
        if (!el) return { scrollable: false, moved: false };
        const before = el.scrollTop; el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 100));
        return { scrollable: true, moved: el.scrollTop > before };
      });
      expect.soft(scrolled.scrollable ? scrolled.moved : true, `${p.name} scrolls`).toBe(true);
      const back = page.getByRole('button', { name: /^back$/i }).or(page.getByRole('link', { name: /^back$/i })).first();
      const hasBack = await back.count();
      let leftmost = null as null | number;
      if (hasBack) { const box = await back.boundingBox(); leftmost = box ? box.x : null; }
      console.log(`BACK ${p.name}: present=${hasBack} x=${leftmost}`);
      expect.soft(hasBack, `${p.name} has a Back control`).toBeGreaterThan(0);
      if (leftmost !== null) expect.soft(leftmost, `${p.name} Back is at the top left`).toBeLessThan(120);
      q.check(p.name);
    });
  }

  test('8. browser back and forward step through a step in Manage', async ({ page }) => {
    await page.goto('/admin/platform?tab=users'); await settle(page);
    await page.getByTestId('hosting-open').first().click();
    await expect(page).toHaveURL(/host=/);
    await page.goBack();
    await expect(page).not.toHaveURL(/host=/);
    await page.goForward();
    await expect(page).toHaveURL(/host=/);
    await expect(page.getByTestId('hosting-panel')).toBeVisible();
    await page.goto('/admin/account-settings'); await settle(page);
    await page.goto('/admin/tasting-notes'); await settle(page);
    await page.goBack();
    await expect(page).toHaveURL(/account-settings/);
    await page.goForward();
    await expect(page).toHaveURL(/tasting-notes/);
  });
});
