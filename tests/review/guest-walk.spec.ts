/**
 * W1, the guest, start to finish (todo/plans/review-prompts/sol-w1-guest-walk.md).
 *
 * One guest, Mei, does everything a guest can do across the five launches, on
 * the review rig, in order. Run it once per size, on a fresh rig each time
 * (the steps change the shop and the next size must not find that done):
 *
 *   node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --slot 1
 *   set -a; . test-results/review/slot-1.env; set +a
 *   REVIEW_CHROMIUM=... npx playwright test -c tests/review/review.config.ts tests/review/guest-walk.spec.ts --project phone-320 --trace off
 *
 * Then the same with `--set live`, where only Launch 1 is open and the walk
 * checks that the closed launches stay closed.
 *
 * Every step is one task(...) (tap budget in brackets in its name). Known
 * holes are marked test.fail with the finding's id (todo/review/findings/W1.md).
 * No mocked routes. Ana's part (the yes, who came, the thank-you link) goes
 * through the worker's own API, as she would.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { expect, stubBrowserServices, test } from '../fixtures';
import { noSideScroll, quiet, REVIEW_API, REVIEW_SITE, SITE_SET, task, WORKER_SET } from './helpers';



const ALL = SITE_SET === 'all' && WORKER_SET === 'all';
const LIVE = SITE_SET === 'live' && WORKER_SET === 'live';

const ADDRESS = 'Jalan Hantu Teh 12, Ubud';
const STEP_LINES = ['The blue gate after the warung.', 'Shoes off at the step.'];
const AREA = 'Ubud, near the market';
/** Mei's after-sit link to the finished first table (worker/sandbox/first-table-fixture.mjs). */
const MEI_THANKS = 'f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5f1a5';
const picture = readFileSync(join(process.cwd(), 'public', 'icon-192.png'));

type State = {
  table?: { id: string; slug: string; path: string; fixture: boolean };
  token?: string;
  thanks?: string;
  liveToken?: string;
};
const STATE: Record<string, State> = {};
const mine = (project: string) => (STATE[project] ??= {});

const TOKENS: Record<string, { token: string }> = {};
async function login(name: string) {
  if (TOKENS[name]) return TOKENS[name];
  for (let attempt = 0; attempt < 10; attempt++) {
    const got = await rawLogin(name);
    if (got) return (TOKENS[name] = got);
    await new Promise(r => setTimeout(r, 6000));
  }
  throw new Error(`could not sign in ${name}`);
}
async function rawLogin(name: string) {
  const r = await fetch(`${REVIEW_API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: name, password: name }),
  });
  if (r.status !== 200) return null;
  return (await r.json()) as { token: string };
}
async function api(who: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const { token } = await login(who);
  const r = await fetch(`${REVIEW_API}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, body };
}

/** What a stranger must never be told before the host's yes. */
function expectNoWay(text: string, where: string) {
  expect(text, `${where}: no address`).not.toContain('Jalan Hantu');
  for (const line of STEP_LINES) expect(text, `${where}: no step`).not.toContain(line);
}

async function signInWithToken(page: Page, who: string) {
  await stubBrowserServices(page.context());
  const { token } = await login(who);
  await page.context().addInitScript(t => localStorage.setItem('teajia_token', t), token);
}

/** Records anything that asks the guest for something she did not choose. */
async function watchForAsks(page: Page) {
  const asked: string[] = [];
  await page.context().addInitScript(() => {
    const w = window as any;
    w.__asks = [];
    try {
      if ('Notification' in window) {
        const original = Notification.requestPermission?.bind(Notification);
        (Notification as any).requestPermission = (...args: unknown[]) => { w.__asks.push('notification'); return original ? (original as any)(...args) : Promise.resolve('denied'); };
      }
      const geo = navigator.geolocation;
      if (geo) {
        const g = geo.getCurrentPosition.bind(geo);
        geo.getCurrentPosition = (...args: any[]) => { w.__asks.push('location'); return (g as any)(...args); };
      }
    } catch { /* a browser that will not let us look */ }
  });
  page.on('dialog', d => { asked.push(`${d.type()}: ${d.message()}`); void d.dismiss(); });
  return {
    async check(where: string) {
      const inPage = await page.evaluate(() => (window as any).__asks ?? []).catch(() => []);
      expect.soft([...asked, ...inPage], `${where}: nothing asks her for anything`).toEqual([]);
      expect.soft(await page.locator('[role=dialog]:visible, [role=alertdialog]:visible').count(), `${where}: no dialog open by itself`).toBe(0);
      const text = await page.locator('body').innerText();
      expect.soft(text, `${where}: no request for feedback during the session`).not.toMatch(/how was (it|your)|rate (this|your)|leave (a|your) (review|words|note)|tell us what/i);
    },
  };
}

async function anonContext(browser: Browser, page: Page) {
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  const context = await browser.newContext({ baseURL: REVIEW_SITE, viewport: size });
  await stubBrowserServices(context);
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: 'serial' });

test.describe(`W1 the guest (site ${SITE_SET}, worker ${WORKER_SET})`, () => {
  test.beforeAll(() => {
    expect(ALL || LIVE, `W1 runs with --set all or --set live, not ${SITE_SET}/${WORKER_SET}`).toBe(true);
  });

  // ── 1 ────────────────────────────────────────────────────────────────────
  test('1. an invite link to Ana\'s table, signed out: who hosts, the area, no address, and a seat is asked for (2)', async ({ page }, info) => {
    test.fail(ALL, 'W1-2');
    test.setTimeout(240_000);
    const s = mine(info.project.name);
    const q = quiet(page);
    // Setup, as Ana (not a guest's step): a table by request with an address and a way in.
    if (ALL) {
      const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      const made = await api('ana', '/api/me/tables', { method: 'POST', body: { date: day, time: '19:00', timezone: 'Asia/Makassar', seats: 6, door: 'request', area: AREA } });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      const way = await api('ana', `/api/me/tables/${made.body.id}/way`, {
        method: 'PUT', body: { address: ADDRESS, venue_guide: { steps: STEP_LINES.map(description => ({ description })) } },
      });
      expect(way.status, JSON.stringify(way.body)).toBe(200);
      s.table = { id: made.body.id, slug: made.body.slug, path: `/event/${made.body.slug}`, fixture: false };
    } else {
      // Live: Ana cannot make a table (Launch 2 is closed); her fixture table "a week ahead, by request" stands in.
      const made = await api('ana', '/api/me/tables', { method: 'POST', body: { date: '2026-12-20', time: '19:00', timezone: 'Asia/Makassar', seats: 4, door: 'request' } });
      expect(made.status, 'live: hosting a table stays closed').toBe(404);
      s.table = { id: 'fh-event-next', slug: 'fh-ana-table-next', path: '/event/fh-ana-table-next', fixture: true };
      // Ana's unlisted table is hidden while Launch 2 is closed (checked here); the shop's own session stands in.
      const hidden = await fetch(`${REVIEW_API}/api/events/fh-ana-table-next/public`);
      expect(hidden.status, 'live: a hosted table is not served').toBe(404);
    }

    await stubBrowserServices(page.context());
    if (s.table!.fixture) {
      await page.goto('/events');
      await page.getByRole('button').filter({ hasText: /\d{1,2}:\d{2}\s?(AM|PM)/ }).first().click();
      await expect(page).toHaveURL(/\/event\//);
      s.table!.path = new URL(page.url()).pathname;
      s.table!.slug = s.table!.path.split('/').pop()!;
    } else await page.goto(s.table!.path);
    if (ALL) await expect(page.getByTestId('session-host')).toHaveText(/Hosted by Ana/);
    else expect.soft(await page.getByTestId('session-host').count(), 'live: the host line is Launch 2').toBe(0);
    await expect(page.getByRole('button', { name: /Request your seat|Reserve my seat/ }).first()).toBeVisible();
    const body = await page.locator('body').innerText();
    expectNoWay(body, 'the public page');
    if (!s.table!.fixture) {
      await expect(page.getByTestId('session-area')).toHaveText(AREA, { ignoreCase: true });
      // W1-2: the page gives a time with no zone and no word that it is the viewer's own.
      expect.soft(body, 'W1-2 the time says whose clock it is on').toMatch(/GMT|UTC|WITA|Makassar|Bali time|local time|time zone/i);
    }
    await noSideScroll(page, 'the invite page');

    const sent = page.waitForResponse(r => /\/api\/events\/[^/]+\/rsvp$/.test(r.url()) && r.request().method() === 'POST');
    await task(page, '1 ask for a seat (2)', { clicks: 2, fields: 3 }, async () => {
      await page.getByRole('button', { name: /Request your seat|Reserve my seat/ }).first().click();
      const sheet = page.getByRole('dialog', { name: /Request your seat|Reserve your seat/ });
      await sheet.getByLabel('Your name').fill('Mei Guest');
      await sheet.getByLabel('Country code').fill('+62');
      await sheet.getByLabel('WhatsApp number').fill('812345678');
      await sheet.getByRole('button', { name: /Request my seat|Reserve my seat/ }).last().click();
      await expect(sheet.getByRole('heading', { name: /Request received|You have a seat/ })).toBeVisible();
    }, info);
    const response = await sent;
    expect([200, 201], await response.text().catch(() => '')).toContain(response.status());
    s.token = ((await response.json().catch(() => ({}))) as { magic_token?: string }).magic_token;
    await page.getByRole('button', { name: /Done|Close/ }).first().click();
    if (ALL) await expect(page.getByTestId('my-seat')).toContainText('You asked for a seat');
    await noSideScroll(page, 'the invite page after the request');
    q.check('step 1');
  });

  // ── 2 ────────────────────────────────────────────────────────────────────
  test('2. she signs in, Ana says yes, and Mei sees the address and the way to the house (1)', async ({ page }, info) => {
    test.fail(ALL, 'W1-1 and W1-3');
    test.setTimeout(240_000);
    const s = mine(info.project.name);
    const q = quiet(page);
    await stubBrowserServices(page.context());
    // The same browser as step 1 would keep the device's token; this page is a new one, so carry it over.
    await page.addInitScript(({ slug, token }) => { try { localStorage.setItem(`teajia_rsvp_${slug}`, token); } catch { /* none */ } }, { slug: s.table!.slug, token: s.token! });
    await page.goto(`/signin?returnTo=${encodeURIComponent(s.table!.path)}`);
    await task(page, '2a sign in (1 tap, 2 fields)', { clicks: 1, fields: 2 }, async () => {
      await page.locator('#signin-identifier').fill('mei');
      await page.locator('#signin-password').fill('mei');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.locator('#signin-identifier')).toHaveCount(0);
    }, info);
    // W1-3 (S3): sign-in with a returnTo should land back on the invite, not on Your Table.
    await page.waitForLoadState('networkidle');
    expect.soft(new URL(page.url()).pathname, 'W1-3 sign-in returns her to the table she was looking at').toBe(s.table!.path);

    if (s.table!.fixture) { // live: Ana's yes is Launch 2's, so there is no way to the house to show
      await page.goto(s.table!.path);
      expectNoWay(await page.locator('body').innerText(), 'live');
      q.check('step 2 live');
      return;
    }

    // Ana's part, through the API: the guest, then the yes.
    const guests = await api('ana', `/api/me/tables/${s.table!.id}`);
    const seat = (guests.body.guests as Array<{ id: string; full_name: string; status: string }>).find(g => g.full_name === 'Mei Guest');
    expect(seat, 'Ana sees the request').toBeTruthy();
    const yes = await api('ana', `/api/me/tables/${s.table!.id}/guests/${seat!.id}/yes`, { method: 'PUT' });
    expect(yes.status, JSON.stringify(yes.body)).toBe(200);

    // She opens the same invite link. Signed in now, does the page still know her seat?
    await page.goto(s.table!.path);
    const link = page.getByRole('link', { name: 'Open your page' });
    await page.waitForTimeout(1500);
    // W1-1 (S2): a seat asked for signed out is forgotten the moment she signs in.
    const known = await link.isVisible();
    expect.soft(known, 'W1-1 after signing in, the invite shows her own seat and "Open your page"').toBe(true);
    await expect.soft(page.getByRole('button', { name: 'Request your seat' }), 'W1-1 she is not offered the form again').toHaveCount(0);

    await task(page, '2b see the address and the way (1)', { clicks: 1 }, async () => {
      if (known) await link.click(); else await page.goto(`/m/${s.token}`);
      await expect(page.getByRole('heading', { name: 'The way in' })).toBeVisible();
    }, info);
    const text = await page.locator('body').innerText();
    expect(text).toContain(ADDRESS);
    await expect(page.locator('[data-way-line]')).toHaveText(STEP_LINES[0]);
    await expect(page.getByText('YOUR SEAT IS CONFIRMED', { exact: false })).toBeVisible();
    // Only a map link would be a way to open a map app; none was given, so none is offered.
    await noSideScroll(page, 'the guest page');
    q.check('step 2');
  });

  // ── 3 ────────────────────────────────────────────────────────────────────
  test('3. the way opens with the network off (0 more)', async ({ page, context }, info) => {
    test.setTimeout(240_000);
    const s = mine(info.project.name);
    if (!ALL) { test.skip(true, 'the way in is Launch 2'); return; }
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    // The way is kept as the guest page opens it: open it once with signal.
    await page.goto(`/m/${s.token}`);
    await expect(page.getByRole('heading', { name: 'The way in' })).toBeVisible();
    await page.waitForTimeout(1500);
    // Leave the page by the site's own navigation (no reload), so the app stays loaded.
    await page.getByRole('button', { name: /^shop$/i }).first().click();
    await expect(page).not.toHaveURL(/\/m\//);
    await context.setOffline(true);
    try {
      await task(page, '3 the way with no signal (0)', 0, async () => {
        await page.goBack();
        await page.waitForTimeout(1500);
        const text = await page.locator('body').innerText();
        expect(text, 'the address still shows with no signal').toContain(ADDRESS);
        await expect(page.locator('[data-way-line]')).toHaveText(STEP_LINES[0]);
      }, info);
      q.check('step 3');
      // A cold open with no signal needs the built site's service worker, which the rig's dev site
      // does not run; this is recorded, not judged (see the findings, "Not checked").
      const cold = await page.reload({ timeout: 8000 }).then(() => 'loaded').catch(() => 'no page');
      info.annotations.push({ type: 'cold-open-offline', description: `reload with no signal on the dev site: ${cold}` });
    } finally {
      await context.setOffline(false);
    }
  });

  // ── 4 ────────────────────────────────────────────────────────────────────
  test('4. during the session she adds a photograph (1); nothing asks her for anything', async ({ page, browser }, info) => {
    test.fail(ALL, 'W1-4');
    test.setTimeout(240_000);
    const s = mine(info.project.name);
    const q = quiet(page);
    if (!ALL) {
      // Live: a table of someone's home is not served at all, so there is no session of Ana's to sit at.
      expect((await fetch(`${REVIEW_API}/api/events/rv-ana-table-now/public`)).status, 'live: the on-now table is closed').toBe(404);
      await signInWithToken(page, 'mei');
      await page.goto('/event/l5-card-test');
      const asksLive = await watchForAsks(page);
      await asksLive.check('a shop session page');
      q.check('step 4 live');
      return;
    }
    await signInWithToken(page, 'mei');
    const asks = await watchForAsks(page);

    // Her seat at the table that is on now (Launch 1's guest page; the door is "link": a name is a seat).
    await page.goto('/event/rv-ana-table-now');
    await page.waitForTimeout(1500);
    const reserve = page.getByRole('button', { name: /Reserve my seat/ }).first();
    if (await reserve.isVisible()) {
      await reserve.click();
      await page.getByRole('dialog').getByRole('button', { name: /Reserve my seat/ }).last().click();
      await expect(page.getByRole('heading', { name: 'You have a seat.' })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
      await expect(page.getByRole('link', { name: 'Open your page' })).toBeVisible({ timeout: 15_000 });
    }
    await noSideScroll(page, 'the event that is on now');
    await asks.check('the event page, session on');
    await page.getByRole('link', { name: 'Open your page' }).click();
    await expect(page.getByText('YOUR SEAT IS CONFIRMED')).toBeVisible();
    s.liveToken = new URL(page.url()).pathname.split('/').pop();
    await noSideScroll(page, 'her page, session on');
    await asks.check('her page, session on');
    // Is there a photograph control on her own page? The walk says one tap.
    const photoOnHerPage = await page.getByRole('button', { name: /photograph|photo/i }).count();

    if (!ALL) {
      expect(photoOnHerPage, 'live: no session gallery').toBe(0);
      q.check('step 4 live');
      return;
    }

    // Ana marks who came and gives Mei her thank-you link, as she would from her table page.
    const guests = await api('ana', '/api/me/tables/rv-event-now');
    const seat = (guests.body.guests as Array<{ id: string; full_name: string }>).find(g => g.full_name === 'Mei Guest');
    expect(seat).toBeTruthy();
    expect((await api('ana', '/api/me/tables/rv-event-now/came', { method: 'PUT', body: { attendee_ids: [seat!.id] } })).status).toBe(200);
    const thanks = await api('ana', `/api/me/tables/rv-event-now/guests/${seat!.id}/thanks-link`, { method: 'POST' });
    expect(thanks.status, JSON.stringify(thanks.body)).toBe(200);
    s.thanks = thanks.body.credential as string;

    // W1-4 (S2): from her own page there is no way to a photograph during the session.
    expect.soft(photoOnHerPage, 'W1-4 her own page offers a photograph during the session').toBeGreaterThan(0);

    await page.goto(`/after-sit#${s.thanks}`);
    await expect(page.getByRole('button', { name: 'Add a photograph' })).toBeVisible({ timeout: 15_000 });
    await asks.check('the thank-you link during the session');
    await task(page, '4 add a photograph (1)', { clicks: 1 }, async () => {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Add a photograph' }).click();
      (await chooser).setFiles({ name: 'cup.png', mimeType: 'image/png', buffer: picture });
      // The shared photo editor opens first (CLAUDE.md); its "Use photo" is the second tap.
      await page.getByRole('dialog').getByRole('button', { name: 'Use photo' }).click();
      await expect(page.getByText(/with the host/i)).toBeVisible({ timeout: 15_000 });
    }, info);
    await noSideScroll(page, 'the thank-you during the session');
    q.check('step 4');
    void browser;
  });

  // ── 5 ────────────────────────────────────────────────────────────────────
  test('5. after: the thank-you shows the teas with links and prices; she keeps a tea (1), leaves words and a photograph and chooses to be named (2 plus typing)', async ({ page }, info) => {
    test.fail(true, 'W1-5');
    test.setTimeout(240_000);
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    await page.goto(`/after-sit#${MEI_THANKS}`);
    const teas = page.getByRole('region', { name: 'Teas served' });
    await expect(teas).toBeVisible({ timeout: 15_000 });
    await expect(teas.getByRole('link', { name: 'Old tree white, test' })).toHaveAttribute('href', /\/shop\/product\/ft-old-tree-white/);
    // W1-5 (S3): the poured teas carry no price; a guest opens each tea to learn it.
    expect.soft(await teas.innerText(), 'W1-5 the teas served show their prices').toMatch(/\$\s?\d/);
    // W1-6 (S4): the Guest Book says "to add a photo, choose a tea or the whole setup above", a third photograph place beside the gallery's.
    await expect.soft(page.getByText(/To add a photo, choose a tea or the whole setup above/), 'W1-6 one place to add a photograph, said once').toHaveCount(0);
    await noSideScroll(page, 'the thank-you');

    await task(page, '5a keep a tea (1)', { clicks: 1 }, async () => {
      await teas.getByRole('button', { name: 'Keep this tea' }).first().click();
      await expect(teas.getByText('In your Tea Chest')).toBeVisible();
    }, info);

    // Words, and the choice of being named: one note, one tick, one send.
    await task(page, '5b leave words and choose to be named (2, one field)', { clicks: 2, fields: 1 }, async () => {
      await page.getByLabel('Note (optional)').fill('The white opened slowly; honey on the lid.');
      await page.getByLabel(/show it on the public recap under my first name/i).check();
      // W1-14: sending words is itself the consent to share with the host, so the button is ready at once.
      await expect.soft(page.getByRole('button', { name: 'Send for review' }), 'W1-14 the send button is ready once words are written').toBeEnabled();
      await page.getByRole('button', { name: 'Send for review' }).click();
      await expect(page.getByText(/Pending host review/i).first()).toBeVisible({ timeout: 15_000 });
    }, info);

    if (ALL) {
      // The photograph from the table, and whether her first name goes with it.
      await task(page, '5c add a photograph, named (2)', { clicks: 2 }, async () => {
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Add a photograph' }).click();
        (await chooser).setFiles({ name: 'cup.png', mimeType: 'image/png', buffer: picture });
        await page.getByRole('dialog').getByRole('button', { name: 'Use photo' }).click();
        await expect(page.getByText(/with the host/i)).toBeVisible({ timeout: 15_000 });
      }, info);
      // W1-6 (S4): two different photograph places on one page, and the guest-book line sends her to a third.
    } else {
      await expect(page.getByRole('button', { name: 'Add a photograph' }), 'live: no session gallery').toHaveCount(0);
    }
    await noSideScroll(page, 'the thank-you after');
    q.check('step 5');
  });

  // ── 6 ────────────────────────────────────────────────────────────────────
  test('6. she buys a tea from the thank-you through to the order (3)', async ({ page }, info) => {
    test.setTimeout(240_000);
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    await page.goto(`/after-sit#${MEI_THANKS}`);
    await expect(page.getByRole('region', { name: 'Teas served' })).toBeVisible({ timeout: 15_000 });
    let fieldsAsked = 0;
    let knownAsked = 0;
    await task(page, '6 buy a tea from the thank-you (3)', { clicks: 3 }, async () => {
      await page.getByRole('region', { name: 'Teas served' }).getByRole('link', { name: 'Old tree white, test' }).click();
      await page.getByRole('button', { name: /add to order/i }).click();
      await page.getByText(/view order/i).first().click();
      await expect(page.locator('#checkout-location')).toBeVisible();
      // Fill only what is empty: what the site knows should not be asked.
      for (const [id, value] of [['#checkout-location', 'Ubud'], ['#checkout-country', 'Indonesia'], ['#checkout-name', 'Mei Guest'], ['#checkout-contact', 'mei@sandbox.test']] as const) {
        const field = page.locator(id);
        if (!(await field.inputValue())) { await field.fill(value); fieldsAsked += 1; if (id === '#checkout-name' || id === '#checkout-contact') knownAsked += 1; }
      }
      await page.getByRole('button', { name: 'Place order request' }).click();
      await expect(page.getByText('Request received')).toBeVisible({ timeout: 15_000 });
    }, info);
    // W1-7: signed in, her name and email come from the account and are not asked.
    expect.soft(knownAsked, `W1-7 the order form asks a signed-in guest for her name and email (typed ${knownAsked} of 2; ${fieldsAsked} fields in all)`).toBe(0);
    // W1-8 (S3): the walk asks for a WhatsApp order; the rig's shop offers only a reply by email.
    await noSideScroll(page, 'the order');
    q.check('step 6');
  });

  // ── 7 ────────────────────────────────────────────────────────────────────
  test('7. favourites: a tea, an article and a Tea Table piece, found in one place (1 each, 2 to reach it)', async ({ page }, info) => {
    test.setTimeout(240_000);
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    if (!ALL) {
      await page.goto('/account/favourites');
      await expect(page.getByRole('heading', { name: 'Favourites' }), 'live: no Favourites page').toHaveCount(0);
      await page.goto('/tea-table');
      await expect(page.getByTestId('tea-table-page'), 'live: no Tea Table page').toHaveCount(0);
      q.check('step 7 live');
      return;
    }
    await page.goto('/shop/product/ft-old-tree-white?store=bali');
    const heartSaved = page.waitForResponse(r => /\/api\/user\/favorites/.test(r.url()) && r.request().method() === 'PUT', { timeout: 8000 }).catch(() => null);
    await task(page, '7a keep a tea (1)', { clicks: 1 }, async () => {
      await page.getByRole('button', { name: 'Add to favorites' }).click();
      await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
    }, info);
    expect.soft(await heartSaved, 'W1-15 the tea heart is saved to the account when tapped').not.toBeNull();
    await page.goto('/article/ft-before-a-white-tea');
    await task(page, '7b keep an article (1)', { clicks: 1 }, async () => {
      await page.getByRole('button', { name: 'Keep', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Kept' })).toBeVisible();
    }, info);
    await page.goto('/tea-table');
    await expect(page.getByTestId('tea-table-page')).toBeVisible();
    await noSideScroll(page, 'the Tea Table');
    await task(page, '7c keep a Tea Table piece (1)', { clicks: 1 }, async () => {
      await page.getByRole('button', { name: 'Keep', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Kept' }).first()).toBeVisible();
    }, info);

    await page.goto('/');
    await task(page, '7d reach favourites from Home (2)', { clicks: 2 }, async () => {
      await page.getByRole('button', { name: 'Your Table' }).first().click();
      await page.getByRole('button', { name: /remember/ }).click();
      await expect(page).toHaveURL(/\/account\/favourites/);
    }, info);
    await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(4000);
    const text = await page.locator('body').innerText();
    expect.soft(text, 'W1-15 the kept tea is in Favourites').toContain('Old tree white');
    expect.soft(text, 'the article is in Favourites').toContain('Before a white tea');
    expect.soft(text, 'W1-9 the kept Tea Table piece is in Favourites').toMatch(/Mountain red/);
    await noSideScroll(page, 'Favourites');
    q.check('step 7');
  });

  // ── 8 ────────────────────────────────────────────────────────────────────
  test('8. she shares a saved tasting to the Tea Table (2), sees it there signed out, takes it off (2)', async ({ page, browser }, info) => {
    test.fail(ALL, 'W1-11');
    test.setTimeout(240_000);
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    if (!ALL) {
      await page.goto('/account/journal');
      await expect(page.getByText('Old tree white, test').first()).toBeVisible();
      // Launch 1's journal has no sharing sheet to the Tea Table.
      expect(await page.getByText('On my page and the Tea Table').count(), 'live: no Tea Table sharing').toBe(0);
      q.check('step 8 live');
      return;
    }
    await page.goto('/account/journal');
    await expect(page.getByText('Old tree white, test').first()).toBeVisible();
    await task(page, '8a share a tasting (2)', { clicks: 2 }, async () => {
      await page.getByText('Private', { exact: true }).click();
      await page.getByRole('button', { name: 'On my page and the Tea Table' }).click();
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByText('On your page and the Tea Table.')).toBeVisible();
    }, info);
    // W1-10 (S3): the choice is a radio and then a second button; one tap on the choice could do it.
    // W1-11 (S4): behind the sheet the row still says Private.
    expect.soft(await page.getByText('Private', { exact: true }).count(), 'W1-11 the row stops saying Private once it is shared').toBe(0);
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    const seen = await anonContext(browser, page);
    await seen.page.goto('/tea-table');
    await expect(seen.page.getByText('Tasted by Mei Guest')).toBeVisible({ timeout: 15_000 });
    await noSideScroll(seen.page, 'the Tea Table signed out');

    await page.reload();
    await task(page, '8b take it off (2)', { clicks: 2 }, async () => {
      await page.getByText('On your page and the Tea Table', { exact: true }).click();
      await page.getByRole('button', { name: 'Keep private' }).click();
      await page.getByRole('button', { name: 'Done' }).click();
    }, info);
    await page.waitForTimeout(1000);
    await seen.page.reload();
    await expect(seen.page.getByText('Tasted by Mei Guest'), 'taken off the table').toHaveCount(0);
    await seen.context.close();
    q.check('step 8');
  });

  // ── 9 ────────────────────────────────────────────────────────────────────
  test('9. Home: a table to come to, the Tea Table, her favourites and her journal, each in two taps', async ({ page }, info) => {
    test.fail(true, 'W1-12 and W1-18');
    test.setTimeout(240_000);
    const q = quiet(page);
    await signInWithToken(page, 'mei');
    const home = async () => { await page.goto('/'); await expect(page.getByRole('link', { name: ALL ? /Come to a table/ : /New here/ })).toBeVisible({ timeout: 15_000 }); };
    await home();
    await noSideScroll(page, 'Home');
    // Home still offers an account to a signed-in guest.
    // W1-12 (S4): "Create an account · Sign in" is offered to someone already signed in.
    const offered = await page.getByRole('link', { name: 'Sign in' }).count();
    expect.soft(offered, 'W1-12 Home does not offer sign in to a signed-in guest').toBe(0);

    if (!ALL) {
      for (const door of [/Come to a table/, /Host a table/, /Tea Table/]) {
        expect(await page.getByRole('link', { name: door }).count(), `live: Home has no door "${door}"`).toBe(0);
      }
    }
    if (ALL) await task(page, '9a a table to come to (2)', { clicks: 2 }, async () => {
      await page.getByRole('link', { name: /Come to a table/ }).click();
      await expect(page).toHaveURL(/\/events/);
      const card = page.getByRole('button').filter({ hasText: /\d{1,2}:\d{2}\s?(AM|PM)/ }).first();
      await expect(card, 'at least one table to come to').toBeVisible({ timeout: 15_000 });
      await card.click();
    }, info);
    await home();
    if (ALL) {
      await task(page, '9b the Tea Table (2)', { clicks: 1 }, async () => {
        await page.getByRole('link', { name: 'More on the Tea Table' }).click();
        await expect(page.getByTestId('tea-table-page')).toBeVisible();
      }, info);
      // W1-18 (S4): the Tea Table page sits inside a second main landmark.
      expect.soft(await page.locator('main').count(), 'W1-18 one main landmark on the Tea Table').toBe(1);
      await home();
      await task(page, '9c her favourites (2)', { clicks: 2 }, async () => {
        await page.getByRole('button', { name: 'Your Table' }).first().click();
        await page.getByRole('button', { name: /remember/ }).click();
        await expect(page).toHaveURL(/\/account\/favourites/);
      }, info);
      await home();
    }
    await task(page, '9d her journal (2)', { clicks: 2 }, async () => {
      await page.getByRole('button', { name: 'Your Table' }).first().click();
      await page.getByRole('button', { name: /journal/ }).click();
      await expect(page.getByText('Tasting Journal').first()).toBeVisible({ timeout: 15_000 });
    }, info);
    await noSideScroll(page, 'the journal');
    q.check('step 9');
  });

  // ── 10 ───────────────────────────────────────────────────────────────────
  test('10. from Home she asks to host a table herself (2)', async ({ page }, info) => {
    test.fail(true, 'W1-13 live W1-16');
    test.setTimeout(240_000);
    const q = quiet(page, [/\/api\/me\/circles/]);
    await signInWithToken(page, 'mei');
    if (!ALL) {
      // Live: Home has no door to hosting; the address alone gives a blank page (W1-16, S4).
      await page.goto('/');
      await expect(page.getByRole('link', { name: /Host a table/ }), 'live: no Host a table door on Home').toHaveCount(0);
      await page.goto('/account/host');
      await page.waitForTimeout(1500);
      expect.soft(await page.locator('main').first().innerText(), 'W1-16 the address /account/host says something while hosting is closed').toMatch(/\w{4}/);
      q.check('step 10 live');
      return;
    }
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Host a table/ })).toBeVisible({ timeout: 15_000 });
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await task(page, '10 host a table from Home (2)', { clicks: 2, fields: 2 }, async () => {
      await page.getByRole('link', { name: /Host a table/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
      if (!ALL) return; // live: hosting stays closed; what she is told is checked below
      await page.locator('input[name=date]').fill(day);
      await page.locator('input[name=time]').fill('19:00');
      await page.getByRole('button', { name: 'Make the table' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Your table is ready' })).toBeVisible({ timeout: 15_000 });
    }, info);
    if (!ALL) {
      expect(await page.locator('body').innerText(), 'live: she is told hosting is not open yet, or the page is not there').toMatch(/invitation|not open|opens|ask|Host a table/i);
      q.check('step 10 live');
      return;
    }
    await noSideScroll(page, 'Your table is ready');
    // W1-13 (S3): a first-time host's page told her her circles "could not open".
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect.soft(await page.locator('body').innerText(), 'W1-13 the Host a table page shows no error to someone with no circles').not.toMatch(/Could not open your circles/);
    q.check('step 10');
  });
});
