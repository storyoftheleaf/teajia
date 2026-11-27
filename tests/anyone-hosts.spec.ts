/**
 * Launch 3, "anyone can host": the whole journey, seen the way people live it.
 * (Check run J13: a stranger signs up and hosts, guests ask and wait and sit,
 * the host makes a tasting, the table ends and the guests share photographs, a
 * guest reports it, the platform owner stops the host and lets them reach
 * further, an old private sit stays; then the same shop with Launch 3 closed.)
 *
 * Runs against the offline fixture sandbox, never the live shop. Start it on
 * your own ports (see worker/sandbox/README.md and tests/few-hosts.spec.ts on
 * origin/build/launch-2 for the shape): one state directory, two workers on it.
 *   worker ON   FEW_HOSTS_OPEN=true  ANYONE_HOSTS_OPEN=true  DEV_RETURN_VERIFY_CODES=true
 *   worker OFF  FEW_HOSTS_OPEN=true  ANYONE_HOSTS_OPEN=false DEV_RETURN_VERIFY_CODES=true
 *   site  ANYONE_ON_URL   (default http://127.0.0.1:7861, VITE_FEW_HOSTS_OPEN=true VITE_ANYONE_HOSTS_OPEN=true)
 *   site  ANYONE_OFF_URL  (default http://127.0.0.1:7862, the same with VITE_ANYONE_HOSTS_OPEN=false)
 * DEV_RETURN_VERIFY_CODES only lets the test read the sign-up code it would
 * have been emailed; nothing else in the shop changes.
 * People: a stranger who signs up in the test, mei / mei and ana / ana (both
 * signed-in guests; ana is also the approved host of Launch 2), and the platform
 * owner sandbox / sandbox.
 *
 * Two things are done outside the browser (tests/helpers/anyoneHostsSetup.ts,
 * ANYONE_HOSTS_STATE = the workers' --persist-to directory): waiting for a table
 * to end, and the shop's publish of a People profile (step 9 only).
 *
 * Each step also asserts no horizontal overflow and no console errors. Every
 * check is soft, so a step that fails does not stop the ones after it.
 * What the steps share is kept in a small file per size.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, stubBrowserServices, test } from './fixtures';
import { endTheTable, ensureEditorialSteward, publishPeopleProfile } from './helpers/anyoneHostsSetup';

const ON_URL = process.env.ANYONE_ON_URL ?? 'http://127.0.0.1:7861';
const OFF_URL = process.env.ANYONE_OFF_URL ?? 'http://127.0.0.1:7862';
const SHOT_DIR = process.env.ANYONE_SHOTS ?? '/tmp/claude-0/-home-claude/35661dde-1186-5f5b-8460-a19d4e6461f6/scratchpad/j13';

const RUN = Date.now().toString(36).slice(-5);
const ADDRESS = 'Jalan Hantu Teh 12, Ubud';
const STEP_LINE = 'The blue gate after the warung.';
const REPORT_REASON = `The host asked for money at the door ${RUN}`;
const PASSWORD = 'teatable9';

// A control that is not there must fail its check in seconds, not at the end of the test.
test.use({ actionTimeout: 10_000, navigationTimeout: 30_000 });
// The steps share a table and run in order, and a failed step must not skip the next.
test.describe.configure({ mode: 'default' });

const SIZES = [
  { name: 'phone 390x844', width: 390, height: 844, dayOffset: 3 },
  { name: 'desktop 1280x800', width: 1280, height: 800, dayOffset: 4 },
];

/** Failed loads from sandbox routes that no step of this journey reads. */
const QUIET_FAILED_LOADS = [
  /\/api\/me\/pay-access/,
  /\/api\/me\/samples/,
  /\/api\/s\/[^/]+\/events/,
  /\/api\/read\/session/,
  /\/api\/story-content\//,
  // A signed-in person opening a table's page is asked whether they already hold a seat; "no" is a 404.
  /\/api\/events\/[^/]+\/find-rsvp/,
];

type Person = { context: BrowserContext; page: Page; errors: string[]; allow: RegExp[]; seen: string[] };

async function newPerson(browser: Browser, size: { width: number; height: number }, allow: RegExp[] = []): Promise<Person> {
  const context = await browser.newContext({ baseURL: ON_URL, viewport: { width: size.width, height: size.height } });
  await stubBrowserServices(context);
  const page = await context.newPage();
  const person: Person = { context, page, errors: [], allow, seen: [] };
  page.on('pageerror', error => person.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const where = message.location().url;
    if ([...QUIET_FAILED_LOADS, ...person.allow].some(pattern => pattern.test(where))) return;
    person.errors.push(`console: ${message.text()} (${where})`);
  });
  // Every answer the shop gave this person, for the steps that say "in no answer".
  page.on('response', async response => {
    if (!/\/api\//.test(response.url())) return;
    try { person.seen.push(`${response.request().method()} ${new URL(response.url()).pathname}\n${await response.text()}`); } catch { /* no body */ }
  });
  return person;
}

async function assertNoOverflow(page: Page, where = '') {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `horizontal overflow in px ${where}`).toBeLessThanOrEqual(0);
}

/** What each step asks of every person it used: no side scroll, no console error. */
async function assertClean(...people: Person[]) {
  for (const person of people) {
    await assertNoOverflow(person.page);
    expect.soft(person.errors, 'console errors').toEqual([]);
  }
}

async function shoot(person: Person | Page, name: string) {
  const page = 'page' in person ? person.page : person;
  try { await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true }); } catch { /* the page may be gone */ }
}

/**
 * One check of a step. If it throws (a control that is not there, a wait that
 * ran out), that is recorded as a failed soft check with its first line, a
 * picture is kept, and the step carries on.
 */
async function check(person: Person, label: string, shot: string, body: () => Promise<void>) {
  try { await body(); } catch (error) {
    const line = String((error as Error).message ?? error).split('\n').filter(Boolean).slice(0, 3).join(' / ');
    expect.soft(line, `CHECK FAILED: ${label}`).toBe('passed');
    await shoot(person, `${shot}-FAIL-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`);
  }
}

async function signIn(page: Page, identifier: string, password: string, baseURL = ON_URL) {
  await page.goto(`${baseURL}/signin`);
  await page.locator('#signin-identifier').fill(identifier);
  await page.locator('#signin-password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#signin-identifier')).toHaveCount(0);
}

const tokenOf = (page: Page) => page.evaluate(() => localStorage.getItem('teajia_token'));
const userIdOf = async (page: Page) => {
  const token = await tokenOf(page);
  return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).sub as string;
};
async function api(page: Page, path: string, init: { method?: string; data?: unknown; base?: string } = {}) {
  const token = await tokenOf(page);
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const url = `${init.base ?? ''}${path}`;
  const response = await page.request.fetch(url, {
    method: init.method ?? 'GET', headers, ...(init.data !== undefined ? { data: init.data } : {}),
  });
  return { status: response.status(), text: await response.text() };
}

// ── what the steps share ──

type Guest = { name: string; token: string };
type Table = { id: string; slug: string; path: string };
type Shared = {
  stranger?: { name: string; email: string; userId: string };
  t1?: Table; a?: Guest; b?: Guest;
  tasting?: Table; plain?: Table; c?: Guest; d?: Guest; e?: Guest; f?: Guest;
  open?: Table;
  oldSit?: { id: string; recap?: string };
  thanks?: { c?: string; d?: string };
};

const sharedFile = (width: number) => join(tmpdir(), `anyone-hosts-spec-${width}.json`);
const readShared = (width: number): Shared => { try { return JSON.parse(readFileSync(sharedFile(width), 'utf8')); } catch { return {}; } };
const updateShared = (width: number, patch: Partial<Shared>) => writeFileSync(sharedFile(width), JSON.stringify({ ...readShared(width), ...patch }));

const picture = readFileSync(join(process.cwd(), 'public', 'icon-192.png'));

function tableDay(offset: number) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

async function makeTable(page: Page, date: string, options: { time?: string; seats?: number; name?: string; door?: RegExp } = {}) {
  await page.goto('/account/host');
  await expect(page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
  await page.locator('input[name=date]').fill(date);
  await page.locator('input[name=time]').fill(options.time ?? '19:00');
  if (options.seats) await page.locator('input[name=seats]').fill(String(options.seats));
  if (options.name) await page.locator('input[name=name]').fill(options.name);
  if (options.door) await page.getByRole('radio', { name: options.door }).check();
  await page.getByRole('button', { name: 'Make the table' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your table is ready' })).toBeVisible();
  const link = await page.getByLabel('Table link').inputValue();
  const href = await page.getByRole('link', { name: 'Open the table’s page' }).getAttribute('href');
  const id = decodeURIComponent((href ?? '').split('/').pop() ?? '');
  const path = new URL(link).pathname;
  expect(path, 'the link names the session').toMatch(/^\/event\/[a-z0-9-]+$/);
  expect(id, 'the table has an id').not.toBe('');
  return { id, path, slug: path.split('/').pop()! } as Table;
}

async function addWayStep(page: Page, n: number, line: string) {
  await page.getByRole('button', { name: 'Add a step' }).click();
  await page.getByLabel(`Step ${n}`, { exact: true }).fill(line);
  await page.getByTestId(`way-step-photo-picker-${n}`).setInputFiles({ name: `step-${n}.png`, mimeType: 'image/png', buffer: picture });
  const editor = page.getByRole('dialog', { name: `Photograph for step ${n}` });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Use photograph' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(`[data-way-step="${n}"] img`)).toBeVisible();
}

function expectNoWayInAnswer(text: string, where: string) {
  expect.soft(text, `${where} holds no address`).not.toContain('Jalan Hantu');
  expect.soft(text, `${where} holds no step`).not.toContain(STEP_LINE);
  expect.soft(text, `${where} holds no step photograph`).not.toContain('venue-guide');
}

async function expectNoWay(page: Page) {
  const body = await page.locator('body').innerText();
  expect.soft(body, 'no address on the page').not.toContain('Jalan Hantu');
  expect.soft(body, 'no step on the page').not.toContain(STEP_LINE);
  await expect.soft(page.locator('[data-way-reader]')).toHaveCount(0);
  await expect.soft(page.getByRole('heading', { name: 'The way in' })).toHaveCount(0);
}

/**
 * A guest asks for a seat at a table (or its waiting list, when it is full).
 * `as` signs the guest in first, so the seat belongs to an account. Returns the
 * guest's person, left open on their page, and the seat's link token.
 */
async function askForSeat(
  browser: Browser, size: { width: number; height: number }, path: string,
  options: { name: string; phone: string; as?: [string, string]; open: string; done?: RegExp },
) {
  const guest = await newPerson(browser, size);
  if (options.as) await signIn(guest.page, options.as[0], options.as[1]);
  await guest.page.goto(path);
  await guest.page.getByRole('button', { name: options.open }).click();
  const sheet = guest.page.getByRole('dialog');
  await sheet.getByLabel('Your name').fill(options.name);
  // A signed-in guest keeps the email their account gives (that is what ties the seat to the account);
  // anyone else leaves a WhatsApp number.
  if (!options.as) {
    await sheet.getByRole('button', { name: 'WhatsApp', exact: true }).click();
    await sheet.getByLabel('Country code').fill('+62');
    await sheet.getByLabel('WhatsApp number').fill(options.phone);
  }
  const sent = guest.page.waitForResponse(r => /\/api\/events\/[^/]+\/rsvp$/.test(r.url()) && r.request().method() === 'POST');
  await sheet.getByRole('button', { name: /^(Request my seat|Join the waitlist|Join waitlist)/ }).click();
  const response = await sent;
  const text = await response.text();
  let body: { magic_token?: string; status?: string; error?: string } = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { guest, response, text, token: body.magic_token ?? '', status: body.status ?? '', sheet };
}

/**
 * Opens one person's Hosting panel in Manage the way the owner would: the Hosting button on their
 * card. A new person is last in the list, and on the phone that button must still clear the
 * bottom bar (J13 finding 3), so a plain click must reach it.
 */
async function openHostingPanel(owner: Person, who: { email: string; userId: string }) {
  await owner.page.goto('/admin/platform?tab=users');
  const card = owner.page.getByText(who.email, { exact: true }).locator('xpath=ancestor::div[.//*[@data-testid="hosting-open"]][1]');
  const button = card.getByTestId('hosting-open');
  await button.scrollIntoViewIfNeeded();
  await button.click({ timeout: 4000 });
  await expect(owner.page).toHaveURL(new RegExp(`[?&]host=${who.userId}`));
}

async function hostAnswers(page: Page, tableId: string, guestName: string, yes: boolean) {
  await page.goto(`/account/host/${tableId}`);
  await page.getByRole('button', { name: `${yes ? 'Yes' : 'No'} to ${guestName}` }).click();
}

for (const size of SIZES) {
  test.describe(`anyone hosts, launch open, ${size.name}`, () => {
    const w = size.width;
    const tag = `${size.width}`;
    const date = tableDay(size.dayOffset);
    const today = tableDay(0);

    test('1. a stranger signs up, finds "Host a table", and makes a table with only the by-request door', async ({ browser }) => {
      test.setTimeout(180_000);
      const name = `Joss Stranger ${RUN}${tag}`;
      const email = `j13-${RUN}-${tag}@example.test`;
      const host = await newPerson(browser, size);
      try {
        await check(host, 'sign up and verify', `1-${tag}`, async () => {
          await host.page.goto('/signup');
          await host.page.locator('#signup-name').fill(name);
          await host.page.locator('#signup-email').fill(email);
          await host.page.locator('#signup-password').fill(PASSWORD);
          const sent = host.page.waitForResponse(r => r.url().endsWith('/api/auth/signup') && r.request().method() === 'POST');
          await host.page.getByRole('button', { name: 'Create Account' }).click();
          const answer = await (await sent).json() as { verification_code?: string };
          expect(answer.verification_code, 'the sandbox hands the test the code it would have emailed').toBeTruthy();
          await host.page.locator('#signup-verification-code').fill(answer.verification_code!);
          await host.page.getByRole('button', { name: 'Verify email' }).click();
          await expect(host.page.locator('#signup-verification-code')).toHaveCount(0);
        });
        const userId = await userIdOf(host.page);
        updateShared(w, { stranger: { name, email, userId } });
        await assertNoOverflow(host.page, 'after sign up');

        // The door on Home's plate, and the one on Your Table.
        await check(host, 'Home plate to Host a table', `1-${tag}`, async () => {
          await host.page.goto('/');
          const plate = host.page.getByRole('link', { name: /^Host a table/ });
          await expect(plate).toHaveCount(1);
          await expect(plate.getByText('Free to host, and your record is yours.', { exact: true })).toBeVisible();
          await assertNoOverflow(host.page, 'Home');
          await plate.click();
          await expect(host.page).toHaveURL(/\/account\/host$/);
          await expect(host.page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
        });
        await check(host, 'Your Table tile to Host a table', `1-${tag}`, async () => {
          await host.page.goto('/');
          const wide = size.width >= 1024;
          const nav = host.page.getByTestId(wide ? 'left-sidebar' : 'bottom-tab-bar');
          await nav.locator('button[title="Your Table"], button[aria-label="Your Table"]').first().click();
          const tile = host.page.getByRole('button', { name: /^Host a table/ });
          await expect(tile).toBeVisible();
          await assertNoOverflow(host.page, 'Your Table');
          await tile.click();
          await expect(host.page).toHaveURL(/\/account\/host$/);
        });

        // Only the by-request door.
        await check(host, 'only the by-request door', `1-${tag}`, async () => {
          await host.page.goto('/account/host');
          await expect(host.page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
          const doors = await host.page.locator('input[name=door]').evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value));
          expect(doors, 'the doors offered').toEqual(['request']);
          await expect(host.page.getByLabel('Anyone with the link has a seat')).toHaveCount(0);
          await expect(host.page.getByText('People on Teajia can find it')).toHaveCount(0);
          await expect(host.page.getByRole('radio', { name: 'I say yes to each guest' })).toBeChecked();
        });

        let t1: Table | undefined;
        await check(host, 'make the table', `1-${tag}`, async () => {
          t1 = await makeTable(host.page, date, { seats: 1 });
          await expect(host.page.getByRole('link', { name: 'Send in WhatsApp' })).toBeVisible();
          await expect(host.page.getByRole('button', { name: 'Copy link' })).toBeVisible();
          updateShared(w, { t1 });
        });
        if (t1) await check(host, 'tell the way in', `1-${tag}`, async () => {
          await host.page.goto(`/account/host/${t1!.id}?part=way`);
          await expect(host.page.getByRole('heading', { name: 'The way in', level: 2 })).toBeVisible();
          await addWayStep(host.page, 1, STEP_LINE);
          await host.page.getByLabel('Address', { exact: true }).fill(ADDRESS);
          await host.page.getByRole('button', { name: 'Save the way in' }).click();
          await expect(host.page.getByText('Saved.')).toBeVisible();
        });
        await assertClean(host);
        await shoot(host, `1-${tag}`);
      } finally { await host.context.close(); }
    });

    test('2. a guest asks for a seat and sees no address; the host says yes and the way in appears', async ({ browser }) => {
      test.setTimeout(150_000);
      const { t1, stranger } = readShared(w);
      expect(t1, 'step 1 made a table').toBeTruthy();
      const host = await newPerson(browser, size);
      let guest: Person | undefined;
      try {
        // The public answer and the page, before anyone asks.
        const stranger0 = await newPerson(browser, size);
        try {
          await check(stranger0, 'public page holds no address', `2-${tag}`, async () => {
            const answered = stranger0.page.waitForResponse(r => r.url().endsWith(`/api/events/${t1!.slug}/public`));
            await stranger0.page.goto(t1!.path);
            const answer = await answered;
            expect(answer.status(), 'the public answer').toBe(200);
            expectNoWayInAnswer(await answer.text(), `/api/events/${t1!.slug}/public`);
            await expectNoWay(stranger0.page);
            await expect(stranger0.page.getByRole('button', { name: 'Request your seat' })).toBeVisible();
            await expect(stranger0.page.getByTestId('session-host')).toHaveText(/Hosted by Joss/);
            // Not a tasting, so the page does not call it one (J13 finding 4).
            await expect(stranger0.page.getByText(/private tasting/i)).toHaveCount(0);
            await assertNoOverflow(stranger0.page, 'public page');
          });
          await assertClean(stranger0);
        } finally { await stranger0.context.close(); }

        const name = `Ari Guest ${RUN}${tag}`;
        const asked = await askForSeat(browser, size, t1!.path, { name, phone: `81200${RUN.replace(/\D/g, '0').padEnd(5, '0').slice(0, 5)}1`, open: 'Request your seat' });
        guest = asked.guest;
        await check(guest, 'the request is taken', `2-${tag}`, async () => {
          expect(asked.response.status(), `the request answered: ${asked.text}`).toBe(201);
          expect(asked.status).toBe('requested');
          await expect(asked.sheet.getByRole('heading', { name: 'Request received.' })).toBeVisible();
          await asked.sheet.getByRole('button', { name: 'Done' }).click();
          updateShared(w, { a: { name, token: asked.token } });
        });
        await check(guest, 'the guest page has no address', `2-${tag}`, async () => {
          const rsvp = guest!.page.waitForResponse(r => r.url().endsWith(`/api/rsvp/${asked.token}`) && r.request().method() === 'GET');
          await guest!.page.goto(`/m/${asked.token}`);
          expectNoWayInAnswer(await (await rsvp).text(), `/api/rsvp/${asked.token}`);
          await expect(guest!.page.getByText(name)).toBeVisible();
          await expectNoWay(guest!.page);
          await expect(guest!.page.getByRole('link', { name: /open in maps/i })).toHaveCount(0);
        });

        await signIn(host.page, stranger!.email, PASSWORD);
        await check(host, 'the host says yes', `2-${tag}`, async () => {
          await hostAnswers(host.page, t1!.id, name, true);
          await expect(host.page.locator('[data-host-group="coming"]').getByText(name)).toBeVisible();
          await expect(host.page.getByText(/1 of 1 seats? taken/)).toBeVisible();
        });
        await check(guest, 'the way in appears on the guest page', `2-${tag}`, async () => {
          await guest!.page.goto(`/m/${asked.token}`);
          await expect(guest!.page.getByRole('heading', { name: 'The way in' })).toBeVisible();
          await expect(guest!.page.getByText(ADDRESS)).toBeVisible();
          await expect(guest!.page.locator('[data-way-reader] [data-way-line]')).toHaveText(STEP_LINE);
        });
        await check(guest, 'the public answer still holds no address', `2-${tag}`, async () => {
          const answer = await guest!.page.request.get(`/api/events/${t1!.slug}/public`);
          expectNoWayInAnswer(await answer.text(), 'the public answer after the yes');
        });
        await assertClean(host, guest);
        await shoot(guest, `2-${tag}`);
      } finally { await host.context.close(); await guest?.context.close(); }
    });

    test('3. a second guest is told they are waiting; the first cannot come; the second asks again and the host says yes', async ({ browser }) => {
      test.setTimeout(180_000);
      const { t1, a, stranger } = readShared(w);
      const host = await newPerson(browser, size);
      let guestB: Person | undefined;
      const guestA = await newPerson(browser, size);
      try {
        await signIn(host.page, stranger!.email, PASSWORD);
        const seatsTaken = async () => {
          const { text } = await api(host.page, `/api/me/tables/${t1!.id}`);
          const detail = JSON.parse(text) as { table: { seats: number; seats_taken: number } };
          return detail.table;
        };
        const nameB = `Bo Waits ${RUN}${tag}`;
        const asked = await askForSeat(browser, size, t1!.path, { name: nameB, phone: `81300${RUN.replace(/\D/g, '0').padEnd(5, '0').slice(0, 5)}2`, open: 'Join the waitlist' });
        guestB = asked.guest;
        await check(guestB, 'a full table takes a name on its waiting list', `3-${tag}`, async () => {
          updateShared(w, { b: { name: nameB, token: asked.token } });
          expect.soft(asked.response.status(), `the request answered: ${asked.text}`).toBe(201);
          expect.soft(asked.status, 'a full table puts the guest on its waiting list').toBe('waitlist');
          await expect(asked.sheet.getByRole('heading', { name: 'You\'re on the waiting list.' })).toBeVisible();
          await asked.sheet.getByRole('button', { name: 'Done' }).click();
        });
        await check(guestB, 'the second guest is told they are waiting', `3-${tag}`, async () => {
          await guestB!.page.goto(`/m/${asked.token}`);
          await expect(guestB!.page.getByText(/waiting|on the list|first in line/i)).toBeVisible();
          await expectNoWay(guestB!.page);
        });
        await check(host, 'the seat count holds at the seats', `3-${tag}`, async () => {
          const table = await seatsTaken();
          expect(table.seats_taken, 'seats taken with a guest waiting').toBe(1);
          await host.page.goto(`/account/host/${t1!.id}`);
          await expect(host.page.getByText(/1 of 1 seats? taken/)).toBeVisible();
          await expect(host.page.locator('[data-host-group="waiting"]').getByText(nameB)).toBeVisible();
        });

        // The first guest gives the seat back.
        await check(guestA, 'the first guest cannot come', `3-${tag}`, async () => {
          await guestA.page.goto(`/m/${a!.token}`);
          await expect(guestA.page.getByRole('heading', { name: 'The way in' })).toBeVisible();
          // At a person's table the guest says "I can't come" (J13 finding 6).
          await expect(guestA.page.getByRole('button', { name: /Cancel my reservation/i })).toHaveCount(0);
          await guestA.page.getByRole('button', { name: 'I can\'t come', exact: true }).click();
          const modal = guestA.page.getByRole('dialog');
          await modal.getByRole('button', { name: 'I can\'t come', exact: true }).click();
          await expect(guestA.page.getByText('Reservation cancelled')).toBeVisible();
          await expect(guestA.page.getByRole('heading', { name: 'The way in' })).toHaveCount(0);
        });
        // Every seat at a by-request table needs the host's yes, so the freed seat is not offered:
        // the guest waiting longest goes back to asking, and the host answers (J13 finding 1).
        await check(guestB!, 'the second guest is asking again, and holds no seat', `3-${tag}`, async () => {
          await guestB!.page.goto(`/m/${asked.token}`);
          await expect(guestB!.page.getByText('Your request has been received.')).toBeVisible();
          await expect(guestB!.page.getByText('A seat just became available!')).toHaveCount(0);
          await expect(guestB!.page.getByRole('button', { name: 'Claim my seat' })).toHaveCount(0);
          await expectNoWay(guestB!.page);
          expect((await seatsTaken()).seats_taken, 'no seat is taken before the host says yes').toBe(0);
        });
        await check(host, 'the host sees it in their notices and says yes', `3-${tag}`, async () => {
          await host.page.goto(`/account/host/${t1!.id}`);
          await expect(host.page.locator('[data-seat-notice="returned"]').getByText(new RegExp(`${nameB}, who was waiting, is asking for it`))).toBeVisible();
          await expect(host.page.locator('[data-host-group="waiting"]').getByText(nameB)).toBeVisible();
          await host.page.getByRole('button', { name: `Yes to ${nameB}` }).click();
          await expect(host.page.locator('[data-host-group="coming"]').getByText(nameB)).toBeVisible();
        });
        await check(guestB!, 'the second guest now has the seat and the way in', `3-${tag}`, async () => {
          await guestB!.page.goto(`/m/${asked.token}`);
          await expect(guestB!.page.getByRole('heading', { name: 'The way in' })).toBeVisible();
          await expect(guestB!.page.getByText(ADDRESS)).toBeVisible();
        });
        await check(host, 'the seat count never passes the seats', `3-${tag}`, async () => {
          const table = await seatsTaken();
          expect(table.seats_taken, 'seats taken after the yes').toBe(1);
          expect(table.seats_taken).toBeLessThanOrEqual(table.seats);
          await host.page.goto(`/account/host/${t1!.id}`);
          await expect(host.page.getByText(/1 of 1 seats? taken/)).toBeVisible();
          await expect(host.page.locator('[data-host-group="coming"]').getByText(nameB)).toBeVisible();
          await expect(host.page.locator('[data-host-group="coming"]').getByText(a!.name)).toHaveCount(0);
          await expect(host.page.getByText(/can't come|gave back/)).toBeVisible();
        });
        await check(guestB, 'a third guest cannot make the seat count pass', `3-${tag}`, async () => {
          const { text } = await api(host.page, `/api/me/tables/${t1!.id}`);
          const detail = JSON.parse(text) as { table: { seats: number; seats_taken: number } };
          expect(detail.table.seats_taken).toBeLessThanOrEqual(detail.table.seats);
        });
        await assertClean(host, guestA, guestB!);
        await shoot(host, `3-${tag}`);
      } finally { await host.context.close(); await guestA.context.close(); await guestB?.context.close(); }
    });

    test('4. the host makes a table a tasting; its confirmed guest sees the tasting door on the day, a guest at an ordinary session sees nothing', async ({ browser }) => {
      test.setTimeout(240_000);
      const { stranger } = readShared(w);
      const host = await newPerson(browser, size);
      const people: Person[] = [host];
      try {
        await signIn(host.page, stranger!.email, PASSWORD);
        let tasting: Table | undefined; let plain: Table | undefined;
        await check(host, 'make two tables for today', `4-${tag}`, async () => {
          tasting = await makeTable(host.page, today, { time: '23:59', seats: 6, name: `Tasting ${RUN}${tag}` });
          plain = await makeTable(host.page, today, { time: '23:59', seats: 6, name: `Plain ${RUN}${tag}` });
          updateShared(w, { tasting, plain });
        });
        if (!tasting || !plain) return;
        const names = { c: `Mei Photo ${RUN}${tag}`, d: `Ana Photo ${RUN}${tag}`, e: `Eli Plain ${RUN}${tag}`, f: `Fen Pending ${RUN}${tag}` };
        const phone = (n: number) => `8140${RUN.replace(/\D/g, '0').padEnd(4, '0').slice(0, 4)}${n}0${tag.slice(0, 2)}`;
        const askedC = await askForSeat(browser, size, tasting.path, { name: names.c, phone: phone(1), as: ['mei', 'mei'], open: 'Request your seat' });
        const askedD = await askForSeat(browser, size, tasting.path, { name: names.d, phone: phone(2), as: ['ana', 'ana'], open: 'Request your seat' });
        const askedE = await askForSeat(browser, size, plain.path, { name: names.e, phone: phone(3), open: 'Request your seat' });
        const askedF = await askForSeat(browser, size, plain.path, { name: names.f, phone: phone(4), open: 'Request your seat' });
        people.push(askedC.guest, askedD.guest, askedE.guest, askedF.guest);
        updateShared(w, {
          c: { name: names.c, token: askedC.token }, d: { name: names.d, token: askedD.token },
          e: { name: names.e, token: askedE.token }, f: { name: names.f, token: askedF.token },
        });
        await check(host, 'say yes to C, D and E', `4-${tag}`, async () => {
          for (const [table, name] of [[tasting!, names.c], [tasting!, names.d], [plain!, names.e]] as const) {
            await hostAnswers(host.page, table.id, name, true);
            await expect(host.page.locator('[data-host-group="coming"]').getByText(name)).toBeVisible();
          }
        });

        // The host makes the first one a tasting, from their own table page (J13 finding 4).
        await check(host, 'make it a tasting from the host page itself', `4-${tag}`, async () => {
          await host.page.goto(`/account/host/${tasting!.id}`);
          const tastingSwitch = host.page.getByRole('switch', { name: 'This is a tasting' });
          await expect(tastingSwitch).not.toBeChecked();
          await tastingSwitch.check();
          await expect(tastingSwitch).toBeChecked();
          await assertNoOverflow(host.page, 'tasting switch');
          await host.page.reload();
          await expect(host.page.getByRole('switch', { name: 'This is a tasting' })).toBeChecked();
          await host.page.goto(`/account/host/${plain!.id}`);
          await expect(host.page.getByRole('switch', { name: 'This is a tasting' })).not.toBeChecked();
        });
        await check(host, 'the public pages call only the tasting a tasting', `4-${tag}`, async () => {
          await host.page.goto(tasting!.path);
          await expect(host.page.locator('.label-caps', { hasText: /^Tasting$/i })).toHaveCount(1);
          await expect(host.page.getByText(/private tasting/i)).toHaveCount(0);
          await host.page.goto(plain!.path);
          await expect(host.page.getByTestId('session-host')).toBeVisible();
          await expect(host.page.locator('.label-caps', { hasText: /tasting/i })).toHaveCount(0);
        });

        await check(askedC.guest, 'the tasting guest sees the door on the day and it opens the tasting', `4-${tag}`, async () => {
          await askedC.guest.page.goto(`/m/${askedC.token}`);
          const door = askedC.guest.page.getByRole('button', { name: 'Open the tasting' });
          await expect(door).toBeVisible();
          await assertNoOverflow(askedC.guest.page, 'tasting door');
          await door.click();
          await expect(askedC.guest.page).toHaveURL(/\/session\//);
        });
        await check(askedD.guest, 'the second tasting guest sees it too', `4-${tag}`, async () => {
          await askedD.guest.page.goto(`/m/${askedD.token}`);
          await expect(askedD.guest.page.getByRole('button', { name: 'Open the tasting' })).toBeVisible();
        });
        await check(askedE.guest, 'a guest at an ordinary session sees nothing of the kind', `4-${tag}`, async () => {
          const rsvp = askedE.guest.page.waitForResponse(r => r.url().endsWith(`/api/rsvp/${askedE.token}`) && r.request().method() === 'GET');
          await askedE.guest.page.goto(`/m/${askedE.token}`);
          await rsvp;
          await expect(askedE.guest.page.getByText(names.e)).toBeVisible();
          await expect(askedE.guest.page.getByRole('button', { name: /tasting/i })).toHaveCount(0);
          const body = await askedE.guest.page.locator('body').innerText();
          expect(body, 'the ordinary session page mentions no tasting').not.toMatch(/tasting/i);
        });
        await check(askedF.guest, 'a guest still asking sees no tasting door', `4-${tag}`, async () => {
          await askedF.guest.page.goto(`/m/${askedF.token}`);
          await expect(askedF.guest.page.getByRole('button', { name: /tasting/i })).toHaveCount(0);
        });
        await assertClean(...people);
        await shoot(askedC.guest, `4-${tag}`);
      } finally { for (const person of people) await person.context.close(); }
    });

    test('5. afterward the guests see each other\'s offered photographs on the thank-you; one takes theirs out and it is gone', async ({ browser }) => {
      test.setTimeout(300_000);
      const { stranger, tasting, c, d } = readShared(w);
      expect(tasting, 'step 4 made the tasting table').toBeTruthy();
      endTheTable(tasting!.slug);
      const host = await newPerson(browser, size);
      const mei = await newPerson(browser, size);
      const ana = await newPerson(browser, size);
      try {
        await host.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ON_URL });
        await signIn(host.page, stranger!.email, PASSWORD);
        const links: Record<string, string> = {};
        await check(host, 'mark who came and copy each thank-you link', `5-${tag}`, async () => {
          await host.page.goto(`/account/host/${tasting!.id}?part=after`);
          // Who came is on the list itself once the table has ended (review A9-13, W2-6).
          await host.page.getByRole('checkbox', { name: c!.name }).check();
          await host.page.getByRole('checkbox', { name: d!.name }).check();
          await host.page.locator('[data-host-part="after"]').getByRole('button', { name: 'Save who came', exact: true }).click();
          for (const guest of [c!, d!]) {
            await host.page.getByRole('button', { name: `Copy their thank-you link for ${guest.name}` }).click();
            await expect(host.page.getByText(`Copied. Send it only to ${guest.name}.`)).toBeVisible();
            links[guest.name] = await host.page.evaluate(() => navigator.clipboard.readText());
            expect(links[guest.name], 'the copied thank-you link').toMatch(/\/after-sit#[a-f0-9]{64}$/);
          }
          updateShared(w, { thanks: { c: links[c!.name], d: links[d!.name] } });
        });
        const path = (link: string) => new URL(link).pathname + new URL(link).hash;
        const offer = async (person: Person, who: string, link: string) => {
          await check(person, `${who} offers a photograph from the thank-you`, `5-${tag}`, async () => {
            await person.page.goto(path(link));
            await expect(person.page.getByRole('heading', { name: 'Photographs from the table' })).toBeVisible();
            await person.page.getByTestId('session-gallery-photo-picker').setInputFiles({ name: `${who}.png`, mimeType: 'image/png', buffer: picture });
            const editor = person.page.getByRole('dialog', { name: 'Edit photo' });
            await expect(editor).toBeVisible();
            await editor.locator('.crop-bar__save').click();
            await expect(editor).toHaveCount(0);
            await expect(person.page.getByText('Your photograph is with the host. It joins the table once they include it.')).toBeVisible();
          });
        };
        await signIn(mei.page, 'mei', 'mei');
        await signIn(ana.page, 'ana', 'ana');
        await offer(mei, 'mei', links[c!.name] ?? 'http://x/after-sit#0');
        await offer(ana, 'ana', links[d!.name] ?? 'http://x/after-sit#0');
        // A photograph is "with the host" until they include it.
        await check(host, 'the host includes both photographs', `5-${tag}`, async () => {
          await host.page.goto(`/account/host/${tasting!.id}?part=after`);
          const review = host.page.getByRole('region', { name: 'Guest Book contributions' });
          await expect(review).toBeVisible();
          for (let n = 0; n < 2; n += 1) {
            const include = review.getByRole('button', { name: /^Include photo/ }).first();
            await expect(include).toBeVisible();
            await include.click();
            await expect(review.getByRole('button', { name: /^Include photo/ })).toHaveCount(1 - n);
          }
          await assertNoOverflow(host.page, 'guest book review');
        });
        const tiles = (person: Person) => person.page.getByRole('list', { name: 'Photographs' }).getByRole('listitem');
        // Both pictures are seen, in the gallery and in the Guest Book, not only their places:
        // a picture still on its way when one is taken out is rightly refused (a 404).
        const seesBoth = async (person: Person) => {
          await expect(tiles(person)).toHaveCount(2);
          await expect(tiles(person).getByRole('img')).toHaveCount(2);
          await expect(person.page.getByRole('list', { name: 'Entries from session guests' }).getByRole('img')).toHaveCount(2);
        };
        await check(mei, 'each guest sees both photographs together', `5-${tag}`, async () => {
          await mei.page.goto(path(links[c!.name]));
          await seesBoth(mei);
          await assertNoOverflow(mei.page, 'gallery');
        });
        await check(ana, 'the other guest sees both too', `5-${tag}`, async () => {
          await ana.page.goto(path(links[d!.name]));
          await seesBoth(ana);
        });
        await check(mei, 'one takes theirs out from her own tile', `5-${tag}`, async () => {
          // Her own tile carries the control, and only hers (J13 finding 5).
          const withdraw = mei.page.getByRole('button', { name: 'Withdraw my photograph' });
          const own = tiles(mei).filter({ has: withdraw });
          await expect(own).toHaveCount(1);
          await own.getByRole('button', { name: 'Withdraw my photograph' }).click();
          await expect(tiles(mei)).toHaveCount(1);
          await expect(tiles(mei).filter({ has: withdraw })).toHaveCount(0);
        });
        await check(ana, 'it is gone for the other guest', `5-${tag}`, async () => {
          await ana.page.goto(path(links[d!.name])); // a reload drops the credential from the page, so the link is opened again
          await expect(tiles(ana)).toHaveCount(1);
        });
        await assertClean(host, mei, ana);
        await shoot(ana, `5-${tag}`);
      } finally { await host.context.close(); await mei.context.close(); await ana.context.close(); }
    });

    test('6. a guest reports the session; the platform owner sees it in the review list and the host sees nothing of it', async ({ browser }) => {
      test.setTimeout(180_000);
      const { stranger, plain } = readShared(w);
      const guest = await newPerson(browser, size);
      const owner = await newPerson(browser, size);
      const host = await newPerson(browser, size, [/\/api\/admin\/session-reports/]);
      // Each size files its own report, so the owner's list holds one line for each.
      const reason = `${REPORT_REASON} (${tag})`;
      try {
        await check(guest, 'the guest reports the session', `6-${tag}`, async () => {
          await guest.page.goto(plain!.path);
          await guest.page.getByRole('button', { name: 'Report', exact: true }).click();
          const dialog = guest.page.getByRole('dialog', { name: 'Report' });
          await dialog.getByLabel(/What happened/).fill(reason);
          await assertNoOverflow(guest.page, 'report form');
          await dialog.getByRole('button', { name: 'Send' }).click();
          await expect(dialog.getByText('Thank you. Adrian will look at this.')).toBeVisible();
          // The page named the session by its slug; its id is still in no public answer (J13 finding 2).
          expect(guest.seen.filter(line => line.startsWith('GET /api/events/')).join('\n')).not.toContain(plain!.id);
        });
        await signIn(owner.page, 'sandbox', 'sandbox');
        await check(owner, 'the platform owner sees it in the review list', `6-${tag}`, async () => {
          await owner.page.goto('/admin/tasting-notes');
          const reports = owner.page.getByRole('region', { name: 'Reports' });
          await expect(reports.getByText(reason, { exact: true })).toBeVisible();
          await assertNoOverflow(owner.page, 'review list');
        });
        await signIn(host.page, stranger!.email, PASSWORD);
        await check(host, 'the host sees nothing of it', `6-${tag}`, async () => {
          for (const path of [`/account/host/${plain!.id}`, `/account/host/${plain!.id}?part=after`, '/account/host', '/account/journey']) {
            await host.page.goto(path);
            await host.page.waitForLoadState('networkidle');
            const body = await host.page.locator('body').innerText();
            expect(body, `the host's page ${path}`).not.toContain(REPORT_REASON);
            expect(body, `the host's page ${path}`).not.toMatch(/\breported\b|a report/i);
          }
          for (const path of [`/api/me/tables/${plain!.id}`, `/api/me/tables/${plain!.id}/notes`, '/api/me/tables', '/api/me/hosting', '/api/me/record']) {
            const answer = await api(host.page, path);
            expect(answer.text, `the host's answer ${path}`).not.toContain(REPORT_REASON);
            expect(answer.text, `the host's answer ${path}`).not.toMatch(/session[-_]report|reported/i);
          }
          const sessionReports = await api(host.page, '/api/admin/session-reports');
          expect([401, 403, 404], `the host asking for the report list: ${sessionReports.status}`).toContain(sessionReports.status);
          expect(sessionReports.text).not.toContain(REPORT_REASON);
          expect(host.seen.join('\n'), 'nothing the host was sent').not.toContain(REPORT_REASON);
        });
        await assertClean(guest, owner, host);
        await shoot(owner, `6-${tag}`);
      } finally { await guest.context.close(); await owner.context.close(); await host.context.close(); }
    });

    test('7. the platform owner stops the host: no new table, no new seat, and their page says new tables are paused', async ({ browser }) => {
      test.setTimeout(240_000);
      const { stranger, plain, e, f } = readShared(w);
      const owner = await newPerson(browser, size);
      const host = await newPerson(browser, size, [/\/api\/me\/tables/]);
      const late = await newPerson(browser, size, [/\/api\/events\/[^/]+\/rsvp/]);
      try {
        await signIn(host.page, stranger!.email, PASSWORD);
        await signIn(owner.page, 'sandbox', 'sandbox');
        await check(owner, 'stop the host in the Hosting panel', `7-${tag}`, async () => {
          await openHostingPanel(owner, stranger!);
          const panel = owner.page.getByRole('region', { name: 'Hosting' });
          await expect(panel).toBeVisible();
          await assertNoOverflow(owner.page, 'Hosting panel');
          await panel.getByRole('button', { name: 'Stop all hosting' }).click();
          await panel.getByRole('button', { name: /Stop\? No new tables or seats/ }).click();
          await expect(panel.getByText(/Hosting stopped/)).toBeVisible();
        });
        await check(host, 'the host page says new tables are paused', `7-${tag}`, async () => {
          await host.page.goto('/account/host');
          await expect(host.page.getByText('New tables are paused on your account.')).toBeVisible();
          await expect(host.page.getByRole('button', { name: 'Make the table' })).toHaveCount(0);
          await assertNoOverflow(host.page, 'paused page');
        });
        await check(host, 'no new table through the shop either', `7-${tag}`, async () => {
          const made = await api(host.page, '/api/me/tables', { method: 'POST', data: { date: today, time: '23:58', seats: 4 } });
          expect(made.status, `making a table while stopped: ${made.text}`).toBeGreaterThanOrEqual(400);
        });
        await check(host, 'no new seat: the host cannot say yes to a waiting guest', `7-${tag}`, async () => {
          const guest = await api(host.page, `/api/me/tables/${plain!.id}`);
          const detail = JSON.parse(guest.text) as { guests?: Array<{ id: string; full_name: string; status: string }> };
          const waiting = detail.guests?.find(item => item.full_name === f!.name);
          const yes = waiting ? await api(host.page, `/api/me/tables/${plain!.id}/guests/${waiting.id}/yes`, { method: 'PUT' }) : null;
          expect(yes, 'the waiting guest is listed').not.toBeNull();
          expect(yes!.status, `a yes while stopped: ${yes!.text}`).toBeGreaterThanOrEqual(400);
          const after = JSON.parse((await api(host.page, `/api/me/tables/${plain!.id}`)).text) as { guests?: Array<{ full_name: string; status: string }> };
          expect(after.guests?.find(item => item.full_name === f!.name)?.status).toBe('requested');
        });
        await check(late, 'no new seat: a new guest cannot ask', `7-${tag}`, async () => {
          await late.page.goto(plain!.path);
          const door = late.page.getByRole('button', { name: /Request your seat|Join the waitlist/ });
          if (await door.count() === 0) return; // no door offered is an answer too
          await door.click();
          const sheet = late.page.getByRole('dialog');
          await sheet.getByLabel('Your name').fill(`Late Guest ${RUN}${tag}`);
          await sheet.getByRole('button', { name: 'WhatsApp', exact: true }).click();
          await sheet.getByLabel('Country code').fill('+62');
          await sheet.getByLabel('WhatsApp number').fill('81399900011');
          const sent = late.page.waitForResponse(r => /\/api\/events\/[^/]+\/rsvp$/.test(r.url()) && r.request().method() === 'POST');
          await sheet.getByRole('button', { name: /^(Request my seat|Join the waitlist)/ }).click();
          const response = await sent;
          expect(response.status(), `a new seat request while stopped: ${await response.text()}`).toBeGreaterThanOrEqual(400);
        });
        await check(host, 'a confirmed guest keeps their seat', `7-${tag}`, async () => {
          const guest = await newPerson(browser, size);
          try {
            await guest.page.goto(`/m/${e!.token}`);
            await expect(guest.page.getByText(e!.name)).toBeVisible();
            await expect(guest.page.getByRole('button', { name: 'I can\'t come', exact: true })).toBeVisible();
          } finally { await guest.context.close(); }
        });
        await assertClean(owner, host);
        await shoot(host, `7-${tag}`);
      } finally { await owner.context.close(); await host.context.close(); await late.context.close(); }
    });

    test('8. the platform owner lets the host go on and gives them reach "listed"; their open session is on the public list and the reach is in no answer', async ({ browser }) => {
      test.setTimeout(240_000);
      const { stranger } = readShared(w);
      const owner = await newPerson(browser, size);
      const host = await newPerson(browser, size);
      const viewer = await newPerson(browser, size);
      try {
        await signIn(host.page, stranger!.email, PASSWORD);
        await signIn(owner.page, 'sandbox', 'sandbox');
        await check(owner, 'let them host again and set reach to the public sessions list', `8-${tag}`, async () => {
          await openHostingPanel(owner, stranger!);
          const panel = owner.page.getByRole('region', { name: 'Hosting' });
          await panel.getByRole('button', { name: 'Let them host again' }).click();
          await expect(panel.getByText(/May host by request/)).toBeVisible();
          await panel.getByTestId('host-reach-listed').click();
          await expect(panel.getByTestId('host-reach-listed')).toHaveAttribute('aria-pressed', 'true');
          await assertNoOverflow(owner.page, 'reach');
        });
        let open: Table | undefined;
        const title = `Open table ${RUN}${tag}`;
        await check(host, 'the host offers the open door on a new table', `8-${tag}`, async () => {
          open = await makeTable(host.page, tableDay(size.dayOffset + 2), { name: title, door: /People on Teajia can find it/ });
          updateShared(w, { open });
        });
        await check(viewer, 'the open session is on the public sessions list', `8-${tag}`, async () => {
          const list = viewer.page.waitForResponse(r => new URL(r.url()).pathname === '/api/events');
          await viewer.page.goto('/events');
          const answer = await list;
          expect(await answer.text(), 'the public list answer names the open table').toContain(title);
          await expect(viewer.page.getByText(title).first()).toBeVisible();
          await assertNoOverflow(viewer.page, 'the sessions list');
        });
        await check(host, 'the first table is not on the public list', `8-${tag}`, async () => {
          const { t1 } = readShared(w);
          const answer = await viewer.page.request.get('/api/events');
          expect(await answer.text()).not.toContain(t1!.slug);
        });
        await check(host, 'the reach is in no answer a guest or the host can read', `8-${tag}`, async () => {
          const { t1, a, b } = readShared(w);
          const host2 = await api(host.page, '/api/me/hosting');
          const get = async (path: string) => (await viewer.page.request.get(path)).text();
          const asked: Array<[string, string]> = [
            ['/api/me/hosting', host2.text],
            ['/api/me/tables', (await api(host.page, '/api/me/tables')).text],
            [`/api/me/tables/${open!.id}`, (await api(host.page, `/api/me/tables/${open!.id}`)).text],
            [`/api/me/tables/${t1!.id}`, (await api(host.page, `/api/me/tables/${t1!.id}`)).text],
            ['/api/me/record', (await api(host.page, '/api/me/record')).text],
            [`/api/events/${open!.slug}/public`, await get(`/api/events/${open!.slug}/public`)],
            [`/api/rsvp/${b!.token}`, await get(`/api/rsvp/${b!.token}`)],
            [`/api/rsvp/${a!.token}`, await get(`/api/rsvp/${a!.token}`)],
            ['/api/events', await get('/api/events')],
          ];
          for (const [where, text] of asked) {
            expect.soft(text, `${where} carries no reach`).not.toMatch(/host_reach|"reach"|\breach\b/i);
            expect.soft(text, `${where} carries no reach value`).not.toMatch(/"(invitation|listed)"/);
          }
          expect.soft(host.seen.concat(viewer.seen).join('\n'), 'everything the host and a viewer were sent').not.toMatch(/host_reach|"reach"/);
          expect(host2.text, 'the open door is offered to the host').toContain('"open"');
        });
        await assertClean(owner, host, viewer);
        await shoot(viewer, `8-${tag}`);
      } finally { await owner.context.close(); await host.context.close(); await viewer.context.close(); }
    });

    test('9. a person with an old private sit opens Journey: the old sit is there, unchanged, beside their new tables, and its recap still opens', async ({ browser }) => {
      test.setTimeout(240_000);
      const { stranger, t1, tasting, plain, open } = readShared(w);
      // Set up on the old door (Launch 3 closed): the person starts a sit, writes a profile
      // draft and a public recap. The shop's publish of the profile is the one step done outside.
      const old = await newPerson(browser, size);
      try {
        let sitPath = '';
        await check(old, 'set up: an old private sit on the old door', `9-${tag}`, async () => {
          await signIn(old.page, stranger!.email, PASSWORD, OFF_URL);
          await old.page.goto(`${OFF_URL}/account/journey`);
          await old.page.getByRole('button', { name: 'Start a sit' }).click();
          await expect(old.page.getByRole('heading', { name: 'Tea sit' })).toBeVisible();
          sitPath = new URL(old.page.url()).pathname;
          updateShared(w, { oldSit: { id: sitPath.split('/').pop()! } });
        });
        await check(old, 'set up: a People profile draft, published by the shop, and a public recap', `9-${tag}`, async () => {
          ensureEditorialSteward();
          await old.page.goto(`${OFF_URL}/account/profile`);
          await old.page.getByLabel(/PUBLIC NAME/i).fill(`Joss ${RUN}${tag}`);
          await old.page.getByLabel(/PROFILE ADDRESS/i).fill(`joss-${RUN}-${tag}`);
          await old.page.getByLabel(/SHORT BIOGRAPHY/i).fill('Pours tea on Sundays.');
          await old.page.getByRole('button', { name: 'Create draft' }).click();
          await expect(old.page.getByText(/Awaiting approval/)).toBeVisible();
          publishPeopleProfile(stranger!.email);
          await old.page.goto(`${OFF_URL}${sitPath}`);
          await old.page.getByRole('button', { name: 'Write a public recap' }).click();
          const dialog = old.page.getByRole('dialog');
          await dialog.getByLabel(/Public title/).fill(`Old sit ${RUN}${tag}`);
          await dialog.getByLabel(/Short write-up/).fill('Rock tea by the window, and a long quiet hour.');
          await dialog.getByLabel(/Tea name|Exact tea/i).first().fill('Rock tea');
          await dialog.getByRole('button', { name: /Publish|Save/ }).last().click();
          await expect(old.page.getByText('Recap published.')).toBeVisible();
          const href = await old.page.getByRole('link', { name: 'View public recap' }).getAttribute('href');
          expect(href).toMatch(/^\/sits\/casual\//);
          updateShared(w, { oldSit: { id: sitPath.split('/').pop()!, recap: href! } });
        });
        // Now the same person, with Launch 3 open.
        const now = await newPerson(browser, size);
        try {
          await signIn(now.page, stranger!.email, PASSWORD);
          await check(now, 'Journey lists the old sit beside the new tables', `9-${tag}`, async () => {
            await now.page.goto('/account/journey');
            const section = now.page.locator('section[aria-labelledby="member-sits-title"]');
            await expect(section.getByRole('heading', { name: 'Sits and tables' })).toBeVisible();
            const list = section.getByTestId('journey-sits-and-tables');
            await expect(list.getByRole('listitem')).toHaveCount(1 + 4);
            for (const table of [t1, tasting, plain, open]) {
              await expect(list.locator(`a[href="/account/host/${table!.id}"]`)).toHaveCount(1);
            }
            await assertNoOverflow(now.page, 'Journey');
          });
          await check(now, 'the old sit opens where it always did, unchanged', `9-${tag}`, async () => {
            const { oldSit } = readShared(w);
            await now.page.goto('/account/journey');
            await now.page.locator(`a[href$="/sits/${oldSit!.id}"]`).click();
            await expect(now.page).toHaveURL(new RegExp(`/account/journey/sits/${oldSit!.id}$`));
            await expect(now.page.getByRole('link', { name: 'View public recap' })).toBeVisible();
            await assertNoOverflow(now.page, 'the old sit');
          });
        } finally { await assertClean(now); await shoot(now, `9-${tag}`); await now.context.close(); }
        await check(old, 'its published recap still opens at its old address', `9-${tag}`, async () => {
          const reader = await newPerson(browser, size);
          try {
            const { oldSit } = readShared(w);
            await reader.page.goto(oldSit!.recap!);
            await expect(reader.page.getByText('Rock tea by the window, and a long quiet hour.')).toBeVisible();
            await assertNoOverflow(reader.page, 'the recap');
          } finally { await reader.context.close(); }
        });
      } finally { await old.context.close(); }
    });
  });
}

// Step 10: the same shop with Launch 3 closed: hosting is by invitation again.
for (const size of SIZES) {
  test.describe(`anyone hosts, launch closed, ${size.name}`, () => {
    const w = size.width;
    const tag = `${size.width}`;

    test('10. with Launch 3 closed, hosting is by invitation again, exactly as after Launch 2', async ({ browser }) => {
      test.setTimeout(240_000);
      const { stranger, open, plain } = readShared(w);
      const person = await newPerson(browser, size, [/\/api\/me\/(tables|hosting)/]);
      const approved = await newPerson(browser, size);
      // The probes below ask for what is closed, so the refusals they get are expected.
      const guest = await newPerson(browser, size, [/\/api\/session-reports/, /\/api\/events\/[^/]+\/public/]);
      try {
        await signIn(person.page, stranger!.email, PASSWORD, OFF_URL);
        await check(person, 'the stranger is told hosting opens by invitation', `10-${tag}`, async () => {
          await person.page.goto(`${OFF_URL}/account/host`);
          await expect(person.page.getByText('Hosting opens by invitation for now.')).toBeVisible();
          await expect(person.page.getByRole('button', { name: 'Make the table' })).toHaveCount(0);
          await assertNoOverflow(person.page, 'by invitation');
        });
        await check(person, 'Home carries no Host a table', `10-${tag}`, async () => {
          await person.page.goto(`${OFF_URL}/`);
          await person.page.waitForLoadState('networkidle');
          await expect(person.page.getByRole('link', { name: /^Host a table/ })).toHaveCount(0);
          await expect(person.page.getByText('Free to host, and your record is yours.')).toHaveCount(0);
        });
        await check(person, 'the hosting answer gives no door and no table can be made', `10-${tag}`, async () => {
          const answer = await api(person.page, '/api/me/hosting', { base: OFF_URL });
          expect(JSON.parse(answer.text).doors ?? null, `/api/me/hosting: ${answer.text}`).toBeNull();
          const made = await api(person.page, '/api/me/tables', { method: 'POST', base: OFF_URL, data: { date: tableDay(9), time: '19:00', seats: 4 } });
          expect(made.status, `making a table with Launch 3 closed: ${made.text}`).toBeGreaterThanOrEqual(400);
        });
        await check(person, 'Journey is the old Journey: private sits and Start a sit', `10-${tag}`, async () => {
          await person.page.goto(`${OFF_URL}/account/journey`);
          const section = person.page.locator('section[aria-labelledby="member-sits-title"]');
          await expect(section.getByRole('heading', { name: 'Private sits' })).toBeVisible();
          await expect(section.getByRole('button', { name: 'Start a sit' })).toBeVisible();
          await expect(section.getByRole('link', { name: 'Host a table' })).toHaveCount(0);
          await assertNoOverflow(person.page, 'old Journey');
        });
        await check(guest, 'no Report link on a session page, and no report taken', `10-${tag}`, async () => {
          await guest.page.goto(`${OFF_URL}${plain!.path}`);
          await guest.page.waitForLoadState('networkidle');
          await expect(guest.page.getByRole('button', { name: 'Report', exact: true })).toHaveCount(0);
          const report = await api(guest.page, '/api/session-reports', { method: 'POST', base: OFF_URL, data: { target_kind: 'session', target_id: 'x', reason: 'x' } });
          expect(report.status, `a report with Launch 3 closed: ${report.text}`).toBeGreaterThanOrEqual(400);
        });
        await check(guest, 'the open session is off the public list', `10-${tag}`, async () => {
          const answer = await guest.page.request.get(`${OFF_URL}/api/events`);
          expect(await answer.text(), 'the public list with Launch 3 closed').not.toContain(open!.slug);
        });
        await check(guest, 'a guest who held a seat before the switch closed still has their page', `10-${tag}`, async () => {
          const { e } = readShared(w);
          await guest.page.goto(`${OFF_URL}/m/${e!.token}`);
          await guest.page.waitForLoadState('networkidle');
          await expect(guest.page.getByText(e!.name)).toBeVisible();
        });
        await check(approved, 'the approved host of Launch 2 hosts as before', `10-${tag}`, async () => {
          await signIn(approved.page, 'ana', 'ana', OFF_URL);
          await approved.page.goto(`${OFF_URL}/account/host`);
          await expect(approved.page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
          await expect(approved.page.getByLabel('Anyone with the link has a seat')).toBeVisible();
          await expect(approved.page.getByText('People on Teajia can find it')).toHaveCount(0);
          await assertNoOverflow(approved.page, 'ana');
        });
        await assertClean(person, approved, guest);
        await shoot(person, `10-${tag}`);
      } finally { await person.context.close(); await approved.context.close(); await guest.context.close(); }
    });
  });
}
