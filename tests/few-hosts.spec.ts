/**
 * Launch 2, "a few hosts": the whole journey, seen the way people live it.
 * (Check run H13: an approved host makes a table, guests ask and sit, the
 * table ends, the host thanks them; then the same site with the launch closed.)
 *
 * Runs against the offline fixture sandbox, never the live shop. Start it on
 * your own ports (see worker/sandbox/README.md), with the launch open:
 *   API   FEW_APP_URL's worker, FEW_HOSTS_OPEN=true
 *   site  FEW_HOSTS_ON_URL   (default http://127.0.0.1:7797, VITE_FEW_HOSTS_OPEN=true)
 *   site  FEW_HOSTS_OFF_URL  (default http://127.0.0.1:7798, its worker started with FEW_HOSTS_OPEN=false)
 * Sign in as the approved host with ana / ana, as a person who is not approved
 * with mei / mei, as the shop owner with sandbox / sandbox.
 *
 * One thing is done outside the browser: waiting for a table to end. The
 * helper tests/helpers/fewHostsClock.ts moves that one table's start into the
 * past in the local database, so FEW_HOSTS_STATE must name the directory the
 * sandbox worker was started with (--persist-to).
 *
 * Each step also asserts no horizontal overflow and no console errors. The
 * only errors let through are failed loads named in QUIET_FAILED_LOADS (sandbox
 * routes the journey never reads) and, in step 10, the refusals that step
 * expects. The steps share one table made in step 1, so they run in order;
 * what they share is kept in a small file, so a step that fails does not
 * stop the ones after it from running.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, stubBrowserServices, test } from './fixtures';
import { endTheTable } from './helpers/fewHostsClock';

const ON_URL = process.env.FEW_HOSTS_ON_URL ?? 'http://127.0.0.1:7797';
const OFF_URL = process.env.FEW_HOSTS_OFF_URL ?? 'http://127.0.0.1:7798';
const SHOT_DIR = process.env.FEW_HOSTS_SHOTS ?? '/tmp/claude-0/-home-claude/35661dde-1186-5f5b-8460-a19d4e6461f6/scratchpad/h13';

const RUN = Date.now().toString(36).slice(-5);
const ADDRESS = 'Jalan Hantu Teh 12, Ubud';
const STEP_LINES = ['The blue gate after the warung.', 'Shoes off at the step, then left at the frangipani.'];
const SHOP_TEA = 'Old tree white, test';
const CHEST_TEA = 'Ana’s chest oolong, test';
const TYPED_TEA = `Grandmother roasted ${RUN}`;
const PRIVATE_LINE = `Quiet, wants a darker oolong next time ${RUN}`;
const AREA = 'Ubud, near the market';

const SIZES = [
  { name: 'phone 390x844', width: 390, height: 844, dayOffset: 3 },
  { name: 'desktop 1280x800', width: 1280, height: 800, dayOffset: 4 },
];

/** Failed loads from sandbox routes that no step of this journey reads. */
const QUIET_FAILED_LOADS = [
  /\/api\/me\/pay-access/,
  /\/api\/me\/samples/,
  /\/api\/s\/[^/]+\/events/,
];

type Person = { context: BrowserContext; page: Page; errors: string[]; allow: RegExp[] };

async function newPerson(browser: Browser, size: { width: number; height: number }, allow: RegExp[] = []): Promise<Person> {
  const context = await browser.newContext({ baseURL: ON_URL, viewport: { width: size.width, height: size.height } });
  await stubBrowserServices(context);
  const page = await context.newPage();
  const person: Person = { context, page, errors: [], allow };
  page.on('pageerror', error => person.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const where = message.location().url;
    if ([...QUIET_FAILED_LOADS, ...person.allow].some(pattern => pattern.test(where))) return;
    person.errors.push(`console: ${message.text()} (${where})`);
  });
  return person;
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

/** What each step asks of every person it used: no side scroll, no console error. */
async function assertClean(...people: Person[]) {
  for (const person of people) {
    await assertNoOverflow(person.page);
    expect.soft(person.errors, 'console errors').toEqual([]);
  }
}

async function signIn(page: Page, identifier: string, password: string, baseURL = ON_URL) {
  await page.goto(`${baseURL}/signin`);
  await page.locator('#signin-identifier').fill(identifier);
  await page.locator('#signin-password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#signin-identifier')).toHaveCount(0);
}

// ── what the steps share ──

type Shared = {
  day: string;
  table?: { id: string; slug: string; path: string };
  guest?: { name: string; token: string };
  signedPhotos?: string[];
  link?: { id: string; slug: string; path: string; guests: Array<{ name: string; token: string }> };
  thanks?: string;
};

const sharedFile = (width: number) => join(tmpdir(), `few-hosts-spec-${width}.json`);
const readShared = (width: number): Shared => JSON.parse(readFileSync(sharedFile(width), 'utf8'));
const writeShared = (width: number, next: Shared) => writeFileSync(sharedFile(width), JSON.stringify(next));
const updateShared = (width: number, patch: Partial<Shared>) => writeShared(width, { ...readShared(width), ...patch });

const picture = readFileSync(join(process.cwd(), 'public', 'icon-192.png'));

function tableDay(offset: number) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}
/** "Sunday" and "November 29, 2026": how the public page spells the day. */
function dayWords(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(day);
  const rest = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(day);
  return { weekday, rest };
}

async function makeTable(page: Page, date: string, options: { door?: 'link'; seats?: number } = {}) {
  await page.goto('/account/host');
  await expect(page.getByRole('heading', { level: 1, name: 'Host a table' })).toBeVisible();
  await page.locator('input[name=date]').fill(date);
  await page.locator('input[name=time]').fill('19:00');
  if (options.seats) await page.locator('input[name=seats]').fill(String(options.seats));
  if (options.door === 'link') await page.getByLabel('Anyone with the link has a seat').check();
  await page.getByRole('button', { name: 'Make the table' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your table is ready' })).toBeVisible();
  const link = await page.getByLabel('Table link').inputValue();
  const href = await page.getByRole('link', { name: 'Open the table’s page' }).getAttribute('href');
  const id = decodeURIComponent((href ?? '').split('/').pop() ?? '');
  const path = new URL(link).pathname;
  expect(path, 'the link names the session').toMatch(/^\/event\/[a-z0-9-]+$/);
  expect(id, 'the table has an id').not.toBe('');
  return { link, id, path, slug: path.split('/').pop()! };
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

/** The address and every step line a stranger must never read. */
async function expectNoWay(page: Page) {
  const body = await page.locator('body').innerText();
  expect(body, 'no address on the page').not.toContain('Jalan Hantu');
  for (const line of STEP_LINES) expect(body, 'no step on the page').not.toContain(line);
  await expect(page.locator('[data-way-reader]')).toHaveCount(0);
  await expect(page.locator('[data-venue-guide]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The way in' })).toHaveCount(0);
}

function expectNoWayInAnswer(text: string, where: string) {
  expect(text, `${where} holds no address`).not.toContain('Jalan Hantu');
  for (const line of STEP_LINES) expect(text, `${where} holds no step`).not.toContain(line);
  expect(text, `${where} holds no step photograph`).not.toContain('venue-guide');
}

// A failing step leaves a picture where the report can point at it (see shoot).
async function shoot(person: Person, name: string) {
  try { await person.page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true }); } catch { /* the page may be gone */ }
}

for (const size of SIZES) {
  test.describe(`a few hosts, launch open, ${size.name}`, () => {
    const date = tableDay(size.dayOffset);
    const w = size.width;
    const tag = `${size.width}`;

    test('1. the approved host makes a table with only a day and a time and is shown a link', async ({ browser }) => {
      test.setTimeout(120_000);
      writeShared(w, { day: date });
      const host = await newPerson(browser, size);
      try {
        await signIn(host.page, 'ana', 'ana');
        const made = await makeTable(host.page, date);
        const day = dayWords(date);
        await expect(host.page.getByText(new RegExp(`${day.weekday}, ${day.rest}`))).toBeVisible();
        await expect(host.page.getByRole('link', { name: 'Send in WhatsApp' })).toBeVisible();
        await expect(host.page.getByRole('button', { name: 'Copy link' })).toBeVisible();
        updateShared(w, { table: { id: made.id, slug: made.slug, path: made.path } });
        await assertNoOverflow(host.page);

        // The host names the area on the table's page: one short line, never the address.
        await host.page.goto(`/account/host/${made.id}`);
        const areaForm = host.page.getByRole('form', { name: 'Area' });
        await areaForm.getByLabel('Area', { exact: true }).fill(AREA);
        const areaSaved = host.page.waitForResponse(r => r.url().endsWith(`/api/me/tables/${made.id}`) && r.request().method() === 'PUT');
        await areaForm.getByRole('button', { name: 'Save', exact: true }).click();
        expect((await areaSaved).status(), 'the area is saved').toBe(200);
        await host.page.reload();
        await expect(host.page.getByRole('form', { name: 'Area' }).getByLabel('Area', { exact: true })).toHaveValue(AREA);
        await assertNoOverflow(host.page);

        // Setup for the steps below: the host tells the way in, so that what a
        // stranger must not see exists. Photographs go through the photo editor.
        await host.page.goto(`/account/host/${made.id}?part=way`);
        await expect(host.page.getByRole('heading', { name: 'The way in', level: 2 })).toBeVisible();
        await addWayStep(host.page, 1, STEP_LINES[0]);
        await addWayStep(host.page, 2, STEP_LINES[1]);
        await host.page.getByLabel('Address', { exact: true }).fill(ADDRESS);
        await host.page.getByRole('button', { name: 'Save the way in' }).click();
        await expect(host.page.getByText('Saved.')).toBeVisible();
        await host.page.reload();
        await expect(host.page.getByLabel('Step 2', { exact: true })).toHaveValue(STEP_LINES[1]);
        await assertClean(host);
      } catch (error) { await shoot(host, `1-${tag}`); throw error; } finally { await host.context.close(); }
    });

    test('2. signed out, the link opens the session with no address anywhere', async ({ browser }) => {
      const { table, day: tableDate } = readShared(w);
      const stranger = await newPerson(browser, size);
      try {
        const answered = stranger.page.waitForResponse(r => r.url().endsWith(`/api/events/${table!.slug}/public`));
        await stranger.page.goto(table!.path);
        const answer = await answered;
        expect(answer.status(), 'the public answer').toBe(200);
        const publicText = await answer.text();
        expectNoWayInAnswer(publicText, `/api/events/${table!.slug}/public`);

        const words = dayWords(tableDate);
        await expect(stranger.page.getByText(new RegExp(`${words.weekday} · ${words.rest}`, 'i'))).toBeVisible();
        await expect(stranger.page.getByText('7:00 PM')).toBeVisible();
        await expect(stranger.page.getByTestId('session-host')).toHaveText(/Hosted by Ana/);
        await expect(stranger.page.getByText(/6 of 6 seats open/i)).toBeVisible();
        await expect(stranger.page.getByTestId('photographs-line')).toContainText('Photographs are sometimes taken at the table');
        await expect(stranger.page.getByRole('button', { name: 'Request your seat' })).toBeVisible();
        await expectNoWay(stranger.page);
        // The area the host gave in step 1, and never the placeholder.
        expect(JSON.parse(publicText).area_hint, 'the public answer names the area').toBe(AREA);
        await expect(stranger.page.getByTestId('session-area')).toHaveText(AREA, { ignoreCase: true });
        expect(await stranger.page.locator('body').innerText(), 'the area line names an area, not the placeholder')
          .not.toMatch(/location shared after rsvp/i);
        await assertClean(stranger);
        await shoot(stranger, `2-${tag}`);
      } catch (error) { await shoot(stranger, `2-${tag}-fail`); throw error; } finally { await stranger.context.close(); }
    });

    test('3. a guest asks for a seat with a name and a phone number and is told to wait', async ({ browser }) => {
      test.setTimeout(90_000);
      const { table } = readShared(w);
      // A signed-in person who is not a host: mei. The seat form already knows
      // her email, so she changes how to reach her to a phone number.
      const guest = await newPerson(browser, size);
      try {
        await signIn(guest.page, 'mei', 'mei');
        await guest.page.goto(table!.path);
        await guest.page.getByRole('button', { name: 'Request your seat' }).click();
        const sheet = guest.page.getByRole('dialog', { name: 'Request your seat' });
        const name = `Mei Visitor ${RUN} ${tag}`;
        await sheet.getByLabel('Your name').fill(name);
        const change = sheet.getByRole('button', { name: 'Change' });
        if (await change.count()) await change.click();
        await sheet.getByRole('button', { name: 'WhatsApp', exact: true }).click();
        await sheet.getByLabel('Country code').fill('+62');
        await sheet.getByLabel('WhatsApp number').fill('812345678');
        const sent = guest.page.waitForResponse(r => /\/api\/events\/[^/]+\/rsvp$/.test(r.url()) && r.request().method() === 'POST');
        await sheet.getByRole('button', { name: 'Request my seat' }).click();
        const response = await sent;
        expect(response.status(), `the request answered: ${await response.text()}`).toBe(201);
        const { magic_token: token, status } = await response.json() as { magic_token: string; status: string };
        expect(status).toBe('requested');
        await expect(sheet.getByRole('heading', { name: 'Request received.' })).toBeVisible();
        await expect(sheet.getByText(/once your seat is confirmed/i)).toBeVisible();
        await sheet.getByRole('button', { name: 'Done' }).click();
        updateShared(w, { guest: { name, token } });

        // The session's page now shows her own state and the way back to her page, not the form.
        await expect(guest.page.getByTestId('my-seat')).toContainText('You asked for a seat');
        await expect(guest.page.getByRole('link', { name: 'Open your page' })).toHaveAttribute('href', `/m/${token}`);
        await expect(guest.page.getByRole('button', { name: 'Request your seat' })).toHaveCount(0);
        await guest.page.reload();
        await expect(guest.page.getByTestId('my-seat')).toContainText('You asked for a seat');
        await expect(guest.page.getByRole('button', { name: 'Request your seat' })).toHaveCount(0);

        // Their own page: waiting, and no way to the house.
        const answered = guest.page.waitForResponse(r => r.url().endsWith(`/api/rsvp/${token}`) && r.request().method() === 'GET');
        await guest.page.goto(`/m/${token}`);
        const rsvp = await answered;
        expectNoWayInAnswer(await rsvp.text(), `/api/rsvp/${token}`);
        await expect(guest.page.getByText(name)).toBeVisible();
        await expect(guest.page.locator('body')).toContainText(/request/i);
        // The foot names the host by the session page's rule, never the shop.
        await expect(guest.page.getByTestId('guest-page-host')).toHaveText(/Hosted by Ana/i);
        expect(await guest.page.locator('body').innerText(), 'the foot').not.toMatch(/hosted by teajia/i);
        await expectNoWay(guest.page);
        await expect(guest.page.getByRole('link', { name: /open in maps/i })).toHaveCount(0);
        await assertClean(guest);
        await shoot(guest, `3-${tag}`);
      } catch (error) { await shoot(guest, `3-${tag}-fail`); throw error; } finally { await guest.context.close(); }
    });

    test('4. the host says yes and the guest sees the way, step by step, with signed photographs', async ({ browser }) => {
      test.setTimeout(90_000);
      const { table, guest } = readShared(w);
      const host = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      try {
        await signIn(host.page, 'ana', 'ana');
        await host.page.goto(`/account/host/${table!.id}`);
        const waiting = host.page.locator('[data-host-group="waiting"]');
        await expect(waiting.getByText(guest!.name)).toBeVisible();
        await assertNoOverflow(host.page);
        await host.page.getByRole('button', { name: `Yes to ${guest!.name}` }).click();
        await expect(host.page.locator('[data-host-group="coming"]').getByText(guest!.name)).toBeVisible();
        await expect(host.page.getByText('1 of 6 seats taken')).toBeVisible();

        const media: string[] = [];
        visitor.page.on('request', request => {
          const url = request.url();
          if (url.includes('/api/media/') && url.includes('venue-guide')) media.push(url);
        });
        await visitor.page.goto(`/m/${guest!.token}`);
        const reader = visitor.page.locator('[data-way-reader]');
        await expect(visitor.page.getByRole('heading', { name: 'The way in' })).toBeVisible();
        await expect(visitor.page.getByText(ADDRESS)).toBeVisible();
        await expect(reader.getByText('Step 1 of 2')).toBeVisible();
        await expect(reader.locator('[data-way-line]')).toHaveText(STEP_LINES[0]);
        await expect(reader.locator('img[data-way-photo="1"]')).toBeVisible();
        await reader.getByRole('button', { name: 'Next' }).click();
        await expect(reader.getByText('Step 2 of 2')).toBeVisible();
        await expect(reader.locator('[data-way-line]')).toHaveText(STEP_LINES[1]);
        await expect(reader.locator('img[data-way-photo="2"]')).toBeVisible();
        await assertNoOverflow(visitor.page);

        // Photographs load only through addresses signed for this seat.
        const photos = [...new Set(media)];
        expect(photos.length, 'the way in asked for its step photographs').toBeGreaterThanOrEqual(2);
        for (const photo of photos) {
          expect(photo, 'every step photograph address is signed').toMatch(/[?&]sig=[0-9a-f]{16,}/);
          const signed = await visitor.page.request.get(photo);
          expect(signed.status(), `signed address ${photo}`).toBe(200);
          const bare = await visitor.page.request.get(photo.split('?')[0]);
          expect(bare.status(), `bare address ${photo.split('?')[0]}`).toBe(404);
        }
        updateShared(w, { signedPhotos: photos });
        await assertClean(host, visitor);
        await shoot(visitor, `4-${tag}`);
      } catch (error) { await shoot(visitor, `4-${tag}-fail`); throw error; } finally { await host.context.close(); await visitor.context.close(); }
    });

    test('5. at a table with the by-link door a name is a seat, and a full table says so', async ({ browser }) => {
      test.setTimeout(120_000);
      const host = await newPerson(browser, size);
      try {
        await signIn(host.page, 'ana', 'ana');
        const made = await makeTable(host.page, date, { door: 'link', seats: 2 });
        await host.page.goto(`/account/host/${made.id}`);
        await expect(host.page.locator('[data-host-door]')).toHaveText('Anyone with the link has a seat');
        await expect(host.page.getByText('0 of 2 seats taken')).toBeVisible();
        await assertNoOverflow(host.page);

        const guests: Array<{ name: string; token: string }> = [];
        for (const label of ['One', 'Two']) {
          const person = await newPerson(browser, size);
          try {
            await person.page.goto(made.path);
            await person.page.getByRole('button', { name: 'Reserve my seat' }).click();
            const sheet = person.page.getByRole('dialog', { name: 'Reserve your seat' });
            const name = `Link Guest ${label} ${RUN}`;
            await sheet.getByLabel('Your name').fill(name);
            const sent = person.page.waitForResponse(r => /\/api\/events\/[^/]+\/rsvp$/.test(r.url()) && r.request().method() === 'POST');
            await sheet.getByRole('button', { name: 'Reserve my seat' }).click();
            const response = await sent;
            expect(response.status(), `the seat answered: ${await response.text()}`).toBe(201);
            const answer = await response.json() as { magic_token: string; status: string };
            expect(answer.status, 'a seat at once').toBe('confirmed');
            await expect(sheet.getByTestId('seat-by-link-done').getByRole('heading', { name: 'You have a seat.' })).toBeVisible();
            guests.push({ name, token: answer.magic_token });
            await assertClean(person);
          } finally { await person.context.close(); }
        }
        await host.page.reload();
        await expect(host.page.getByText('2 of 2 seats taken')).toBeVisible();

        const late = await newPerson(browser, size);
        try {
          await late.page.goto(made.path);
          await expect(late.page.getByTestId('table-full')).toHaveText('This table is full.');
          await expect(late.page.getByRole('button', { name: 'Reserve my seat' })).toHaveCount(0);
          await expect(late.page.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(0);
          await assertClean(late);
          await shoot(late, `5-${tag}`);
        } finally { await late.context.close(); }
        updateShared(w, { link: { id: made.id, slug: made.slug, path: made.path, guests } });
        await assertClean(host);
      } catch (error) { await shoot(host, `5-${tag}-fail`); throw error; } finally { await host.context.close(); }
    });

    test('6. the host adds a tea from the shop, a tea from their chest and a typed name', async ({ browser }) => {
      test.setTimeout(120_000);
      const { table, guest } = readShared(w);
      const host = await newPerson(browser, size);
      try {
        // The chest tea is a row of the sandbox fixture (worker/sandbox/few-hosts-fixture.mjs):
        // the Tea Chest page of a person with a stock account offers only "Open Stock".
        await signIn(host.page, 'ana', 'ana');
        await host.page.goto(`/account/host/${table!.id}?part=teas`);
        await expect(host.page.getByRole('heading', { name: 'Teas', level: 2 })).toBeVisible();
        const field = host.page.getByLabel('Add a tea');

        await field.fill('Old tree white');
        await host.page.locator('[data-host-tea-match="shop"]').filter({ hasText: SHOP_TEA }).click();
        await expect(host.page.getByText(`Added ${SHOP_TEA}.`)).toBeVisible();

        await field.fill('chest oolong');
        await host.page.locator('[data-host-tea-match="chest"]').filter({ hasText: CHEST_TEA }).click();
        await expect(host.page.getByText(`Added ${CHEST_TEA}.`)).toBeVisible();

        await field.fill(TYPED_TEA);
        await host.page.locator('[data-host-tea-match="name"]').click();
        await expect(host.page.getByText(`Added ${TYPED_TEA}.`)).toBeVisible();

        // The host's list, and after a reload.
        await host.page.reload();
        const list = host.page.locator('[data-host-teas] > li');
        await expect(list).toHaveCount(3);
        await expect(list.nth(0)).toContainText(SHOP_TEA);
        await expect(list.nth(0)).toContainText('From Teajia’s shop');
        await expect(list.nth(1)).toContainText(CHEST_TEA);
        await expect(list.nth(1)).toContainText('From your Tea Chest');
        await expect(list.nth(2)).toContainText(TYPED_TEA);
        await assertNoOverflow(host.page);

        // The session's tea list on the guest's page before the day: three
        // selections, their names held back until the day (TeaMenuPreview).
        const visitor = await newPerson(browser, size);
        try {
          await visitor.page.goto(`/m/${guest!.token}`);
          const menu = visitor.page.getByRole('heading', { name: 'Tea Menu' }).locator('xpath=..');
          await expect(menu).toContainText('3 selections curated for this session');
          await assertClean(visitor);
          await shoot(visitor, `6-${tag}`);
        } finally { await visitor.context.close(); }
        await assertClean(host);
      } catch (error) { await shoot(host, `6-${tag}-fail`); throw error; } finally { await host.context.close(); }
    });

    test('7. after the end time the way is gone; the host marks who came and the thank-you link opens with the teas', async ({ browser }) => {
      test.setTimeout(150_000);
      const { table, guest, signedPhotos } = readShared(w);
      endTheTable(table!.slug);

      const visitor = await newPerson(browser, size);
      const host = await newPerson(browser, size);
      const thanked = await newPerson(browser, size);
      try {
        const answered = visitor.page.waitForResponse(r => r.url().endsWith(`/api/rsvp/${guest!.token}`) && r.request().method() === 'GET');
        await visitor.page.goto(`/m/${guest!.token}`);
        expectNoWayInAnswer(await (await answered).text(), `/api/rsvp/${guest!.token} after the end`);
        await expectNoWay(visitor.page);
        for (const photo of signedPhotos ?? []) {
          expect((await visitor.page.request.get(photo)).status(), `the signed address after the end ${photo}`).toBe(404);
        }
        // The session's tea list on the guest's page, now the day has been: all three.
        const menu = visitor.page.getByRole('heading', { name: 'Tea Menu' }).locator('xpath=..');
        await expect(menu).toContainText(SHOP_TEA);
        await expect(menu).toContainText(CHEST_TEA);
        await expect(menu).toContainText(TYPED_TEA);
        await assertClean(visitor);

        await host.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ON_URL });
        await signIn(host.page, 'ana', 'ana');
        await host.page.goto(`/account/host/${table!.id}?part=after`);
        await host.page.getByRole('button', { name: 'Mark who came' }).click();
        await host.page.getByRole('checkbox', { name: guest!.name }).check();
        await host.page.locator('[data-host-part="after"]').getByRole('button', { name: 'Save', exact: true }).click();
        const came = host.page.getByRole('list', { name: 'Who came' });
        await expect(came.getByText(guest!.name)).toBeVisible();
        await host.page.getByRole('button', { name: `Copy their thank-you link for ${guest!.name}` }).click();
        await expect(host.page.getByText(`Copied. Send it only to ${guest!.name}.`)).toBeVisible();
        const copied = await host.page.evaluate(() => navigator.clipboard.readText());
        expect(copied, 'the copied thank-you link').toMatch(/\/after-sit#[a-f0-9]{64}$/);
        await assertNoOverflow(host.page);

        // It opens, for the guest, the Launch 1 thank-you with the teas.
        await thanked.page.goto(new URL(copied).pathname + new URL(copied).hash);
        await expect(thanked.page.getByRole('heading', { level: 1 })).toBeVisible();
        const teas = thanked.page.getByRole('region', { name: 'Teas served' });
        await expect(teas).toBeVisible();
        await expect(teas.getByRole('link', { name: SHOP_TEA })).toHaveAttribute('href', /\/shop\/product\//);
        await expect(teas.getByText(CHEST_TEA, { exact: true })).toBeVisible();
        await expect(teas.getByText(TYPED_TEA, { exact: true })).toBeVisible();
        await expect(teas.getByRole('link', { name: CHEST_TEA })).toHaveCount(0);
        await expect(teas.getByRole('link', { name: TYPED_TEA })).toHaveCount(0);
        await expect(teas.getByRole('link')).toHaveCount(1);
        await assertClean(host, thanked);
        updateShared(w, { thanks: copied });
        await shoot(thanked, `7-${tag}`);
      } catch (error) { await shoot(host, `7-${tag}-fail`); throw error; } finally {
        await visitor.context.close(); await host.context.close(); await thanked.context.close();
      }
    });

    test('8. the host writes a private line about a guest and it is there after a reload; the guest never sees it', async ({ browser }) => {
      test.setTimeout(120_000);
      const { table, guest, thanks } = readShared(w);
      const host = await newPerson(browser, size);
      const asGuest = await newPerson(browser, size);
      try {
        await signIn(host.page, 'ana', 'ana');
        await host.page.goto(`/account/host/${table!.id}?part=after`);
        await expect(host.page.getByRole('heading', { name: 'Your guest book' })).toBeVisible();
        await expect(host.page.locator('[data-host-poured]')).toContainText(SHOP_TEA);
        const line = host.page.getByLabel(guest!.name, { exact: true });
        await line.fill(PRIVATE_LINE);
        await line.blur();
        await expect(host.page.getByText('Saved.')).toBeVisible();
        await host.page.reload();
        await expect(host.page.getByLabel(guest!.name, { exact: true })).toHaveValue(PRIVATE_LINE);
        await assertNoOverflow(host.page);

        // Signed in as the guest (mei, whose account made the seat).
        await signIn(asGuest.page, 'mei', 'mei');
        const seen: string[] = [];
        asGuest.page.on('response', async response => {
          if (response.url().includes('/api/')) { try { seen.push(await response.text()); } catch { /* no body */ } }
        });
        for (const path of [`/m/${guest!.token}`, `/event/${table!.slug}`, new URL(thanks!).pathname + new URL(thanks!).hash, '/account/cellar', '/account/journal']) {
          await asGuest.page.goto(path);
          await asGuest.page.waitForLoadState('networkidle');
          expect(await asGuest.page.locator('body').innerText(), `the page ${path}`).not.toContain(PRIVATE_LINE);
        }
        // This probe asks for what the guest must not have, so the refusal it gets is expected.
        asGuest.allow.push(/\/api\/me\/tables\//);
        await asGuest.page.goto(`/account/host/${table!.id}`);
        await expect(asGuest.page.getByText('This table was not found.')).toBeVisible();
        const token = await asGuest.page.evaluate(() => localStorage.getItem('teajia_token'));
        const notes = await asGuest.page.request.get(`/api/me/tables/${table!.id}/notes`, { headers: { Authorization: `Bearer ${token}` } });
        expect([403, 404], `the guest asking for the host's notes: ${notes.status()}`).toContain(notes.status());
        expect(await notes.text()).not.toContain(PRIVATE_LINE);
        expect(seen.join('\n'), 'nothing the guest was sent').not.toContain(PRIVATE_LINE);
        await assertClean(host, asGuest);
        await shoot(host, `8-${tag}`);
      } catch (error) { await shoot(host, `8-${tag}-fail`); throw error; } finally { await host.context.close(); await asGuest.context.close(); }
    });

    test('9. a signed-in person who is not approved is told hosting opens by invitation', async ({ browser }) => {
      const person = await newPerson(browser, size);
      try {
        await signIn(person.page, 'mei', 'mei');
        await person.page.goto('/account/host');
        await expect(person.page.getByText('Hosting opens by invitation for now.')).toBeVisible();
        await expect(person.page.getByRole('heading', { name: 'Host a table' })).toHaveCount(0);
        await expect(person.page.getByRole('button', { name: 'Make the table' })).toHaveCount(0);
        await assertClean(person);
        await shoot(person, `9-${tag}`);
      } catch (error) { await shoot(person, `9-${tag}-fail`); throw error; } finally { await person.context.close(); }
    });
  });
}

// Step 10: the same site, its worker started with FEW_HOSTS_OPEN false.
for (const size of SIZES) {
  test.describe(`a few hosts, launch closed, ${size.name}`, () => {
    const w = size.width;
    const tag = `${size.width}`;

    test('10. with the launch closed the host page and the session link answer as if they did not exist, and the Sessions room works', async ({ browser }) => {
      test.setTimeout(150_000);
      const { link, table } = readShared(w);
      const hostedLink = link!;
      const absent = `/event/no-such-table-${RUN}`;
      const expected = [
        new RegExp(`/api/events/${hostedLink.slug}/public`),
        new RegExp(`/api/events/${absent.split('/').pop()}/public`),
        /\/api\/me\/hosting/,
        /\/api\/me\/tables/,
        new RegExp(`/api/events/${hostedLink.slug}`),
      ];
      const person = await newPerson(browser, size, expected);
      const owner = await newPerson(browser, size);
      try {
        // Open first, so the answers below mean something: the link works with the launch open.
        const open = await person.page.request.get(`${ON_URL}/api/events/${hostedLink.slug}/public`);
        expect(open.status(), 'the hosted session answers while the launch is open').toBe(200);

        const hostedApi = await person.page.request.get(`${OFF_URL}/api/events/${hostedLink.slug}/public`);
        const absentApi = await person.page.request.get(`${OFF_URL}/api/events/${absent.split('/').pop()}/public`);
        expect(hostedApi.status(), 'the hosted session\'s public answer').toBe(absentApi.status());
        expect(await hostedApi.text()).toBe(await absentApi.text());
        expect(hostedApi.status()).toBe(404);

        // The host, signed in, is told nothing more than a stranger would be.
        await signIn(person.page, 'ana', 'ana', OFF_URL);
        const token = await person.page.evaluate(() => localStorage.getItem('teajia_token'));
        const none = await person.page.request.get(`${OFF_URL}/api/me/no-such-route-${RUN}`, { headers: { Authorization: `Bearer ${token}` } });
        for (const path of ['/api/me/hosting', '/api/me/tables', `/api/me/tables/${table!.id}`]) {
          const answer = await person.page.request.get(`${OFF_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
          expect(answer.status(), `${path} with the launch closed`).toBe(none.status());
          expect(await answer.text(), `${path} with the launch closed`).toBe(await none.text());
        }

        // The pages: the host page shows nothing of hosting, and the session link
        // reads as any session that is not there.
        await person.page.goto(`${OFF_URL}/account/host`);
        await person.page.waitForLoadState('networkidle');
        const hostBody = await person.page.locator('main').last().innerText();
        expect(hostBody, 'the host page with the launch closed').not.toMatch(/host a table|hosting opens|make the table|your record/i);
        await assertNoOverflow(person.page);

        await person.page.goto(`${OFF_URL}${hostedLink.path}`);
        await person.page.waitForLoadState('networkidle');
        const hostedText = await person.page.locator('body').innerText();
        await person.page.goto(`${OFF_URL}${absent}`);
        await person.page.waitForLoadState('networkidle');
        const absentText = await person.page.locator('body').innerText();
        expect(hostedText, 'the hosted session\'s link reads as a session that is not there').toBe(absentText);
        expect(hostedText).not.toMatch(/Reserve my seat|Request your seat|Hosted by/);
        await assertNoOverflow(person.page);

        // The admin Sessions room works as before.
        await owner.page.goto(`${OFF_URL}/admin`);
        await owner.page.locator('input[type=password]').fill('sandbox');
        await owner.page.locator('input:not([type=password])').first().fill('sandbox');
        await owner.page.keyboard.press('Enter');
        await expect(owner.page.locator('input[type=password]')).toHaveCount(0);
        await owner.page.goto(`${OFF_URL}/admin/events`);
        await expect(owner.page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
        await owner.page.getByRole('button', { name: /^Past/ }).click();
        await expect(owner.page.getByText('First table, a test sit').first()).toBeVisible();
        await owner.page.goto(`${OFF_URL}/admin/events/ft-event`);
        await expect(owner.page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
        await expect(owner.page.getByText('First table, a test sit').first()).toBeVisible();
        await assertClean(person, owner);
        await shoot(owner, `10-${tag}`);
      } catch (error) { await shoot(person, `10-${tag}-fail`); await shoot(owner, `10-${tag}-owner-fail`); throw error; } finally {
        await person.context.close(); await owner.context.close();
      }
    });
  });
}
