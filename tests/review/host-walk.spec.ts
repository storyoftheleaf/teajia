/**
 * W2: the host, start to finish, across all five launches (rig set `all`, slot 2).
 * Brief: todo/plans/review-prompts/sol-w2-host-walk.md. Findings: todo/review/findings/W2.md.
 *
 * Two walks: Ana (approved) and Jun (never hosted, so the first-timer path while anyone may host).
 * Every step is one task() so the tap ledger counts it. Every step saves a screenshot at 390 and 1280
 * into todo/review/screens/w2/. Browser Back then Forward is pressed once on the screen each step ends on.
 *
 * A step that cannot be done the way a person would is recorded and the walk goes on by the next nearest
 * way (named in the note), so one broken step does not hide the ones after it. A finding is a soft
 * assertion carrying its id, and the walk ends with test.fail(true, ids) so the run stays green only
 * while the findings still hold.
 *
 *   set -a; . test-results/review/slot-2.env; set +a
 *   REVIEW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome \
 *     npx playwright test -c tests/review/review.config.ts tests/review/host-walk.spec.ts --trace off
 */
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures';
import { BALI, call, login, noSideScroll, quiet, signIn, task } from './helpers';

const SCREENS = join(process.cwd(), 'todo', 'review', 'screens', 'w2');
const NOTES = join(process.cwd(), 'test-results', 'review', 'w2-notes.jsonl');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8Dwn4EIwDiqkL4KAcT9GO0U4BxoAAAAAElFTkSuQmCC', 'base64');
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const RUN = Date.now().toString(36);

type Walk = { page: Page; info: TestInfo; who: string; size: string; ids: Set<string> };

function note(w: Walk, kind: string, text: string) {
  mkdirSync(join(process.cwd(), 'test-results', 'review'), { recursive: true });
  appendFileSync(NOTES, JSON.stringify({ who: w.who, size: w.size, kind, text }) + '\n');
}

/** A finding: a condition that should hold. Recorded, soft-asserted, and the walk goes on. */
function finding(w: Walk, id: string, ok: boolean, text: string) {
  if (!ok) { w.ids.add(id); note(w, 'finding', `${id}: ${text}`); }
  expect.soft(ok, `${id}: ${text}`).toBe(true);
}

async function shot(w: Walk, id: string) {
  if (w.size === 'phone-320') return;
  mkdirSync(SCREENS, { recursive: true });
  await w.page.screenshot({ path: join(SCREENS, `${w.who}-${w.size}-${id}.png`) }).catch(() => {});
}

/** Back once, Forward once: the screen must come back to the same address. */
async function backForward(w: Walk, id: string) {
  const here = w.page.url();
  const history = await w.page.evaluate(() => history.length).catch(() => 0);
  if (history < 2) return;
  await w.page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await w.page.waitForTimeout(300);
  await w.page.goForward({ waitUntil: 'commit' }).catch(() => {});
  await w.page.waitForTimeout(600);
  if (w.page.url() !== here) note(w, 'history', `${id}: after Back and Forward the address is ${w.page.url()}, not ${here}`);
  expect.soft(w.page.url(), `Back and Forward on step ${id}`).toBe(here);
}

/** One task: count it, look at it, screenshot it, press Back and Forward on it. */
async function step<T>(w: Walk, id: string, name: string, budget: number | { clicks: number; fields?: number }, fn: () => Promise<T>, opts: { history?: boolean } = {}): Promise<T | undefined> {
  let out: T | undefined;
  try {
    out = await task(w.page, `W2 ${w.who} ${id}: ${name}`, budget, fn, w.info);
  } catch (error) {
    const message = String((error as Error).message ?? error).replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 4).join(' / ').slice(0, 420);
    note(w, 'stopped', `${id} ${name}: ${message}`);
    expect.soft(false, `step ${id} (${name}) stopped: ${message}`).toBe(true);
  }
  await noSideScroll(w.page, `${w.who} ${id}`);
  await shot(w, id);
  if (opts.history !== false) await backForward(w, id);
  return out;
}

async function openHome(w: Walk) {
  await w.page.goto('/');
  await expect(w.page.getByRole('link', { name: /Host a table/ }).first()).toBeVisible({ timeout: 90_000 });
}

/** Fills the make-a-table form: day and time are the only things a person must type. */
async function makeTable(w: Walk, opts: { daysAhead: number; door?: 'request' | 'link' | 'open' }) {
  const { page } = w;
  await page.locator('input[name="date"]').fill(day(opts.daysAhead));
  await page.locator('input[name="time"]').fill('16:30');
  if (opts.door && opts.door !== 'request') await page.locator(`input[name="door"][value="${opts.door}"]`).check();
  const sent = {
    door: await page.locator('input[name="door"]:checked').getAttribute('value'),
    seats: await page.locator('input[name="seats"]').inputValue(),
  };
  await page.getByRole('button', { name: 'Make the table' }).click();
  await expect(page.getByRole('heading', { name: 'Your table is ready' })).toBeVisible({ timeout: 20_000 });
  return sent;
}

async function readyTableId(w: Walk): Promise<string> {
  const href = await w.page.getByRole('link', { name: 'Open the table’s page' }).getAttribute('href');
  return decodeURIComponent((href ?? '').split('/').pop() ?? '');
}

async function formFieldsAsked(w: Walk) {
  return w.page.evaluate(() => {
    const form = document.querySelector('form:not([hidden])');
    if (!form) return [];
    return [...form.querySelectorAll('input, select, textarea')].map(el => {
      const input = el as HTMLInputElement;
      const label = input.closest('label')?.textContent?.trim().slice(0, 50) ?? input.name;
      return `${label} [${input.type}${input.required ? ', required' : ''}${input.defaultValue ? `, default ${input.defaultValue}` : ''}]`;
    });
  });
}

async function openTable(w: Walk, id: string, part?: string) {
  await w.page.goto(`/account/host/${encodeURIComponent(id)}${part ? `?part=${part}` : ''}`);
  await expect(w.page.getByRole('group', { name: 'Parts of the table' })).toBeVisible({ timeout: 20_000 });
}

async function partTab(w: Walk, name: 'Guests' | 'Teas' | 'The way in' | 'After') {
  await w.page.getByRole('group', { name: 'Parts of the table' }).getByRole('button', { name }).click();
}

async function addWayStep(w: Walk, n: number, line: string) {
  const { page } = w;
  await page.getByRole('button', { name: 'Add a step' }).click();
  await page.getByLabel(`Step ${n}`, { exact: true }).fill(line);
  // A real tap on the button opens the file chooser; the picture then opens in the shared editor.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: `Add the photograph for step ${n}` }).click();
  await (await chooser).setFiles({ name: `step-${n}.png`, mimeType: 'image/png', buffer: PNG });
  const editor = page.getByRole('dialog', { name: `Photograph for step ${n}` });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Use photograph' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(`[data-way-step="${n}"] img`)).toBeVisible({ timeout: 15_000 });
}

async function openYourTable(w: Walk) {
  // The glyph on the desktop rail, the Your Table tab at the bottom on the phone.
  await w.page.getByRole('button', { name: /^(Your Table|Account|Open Your Table)/i }).first().click();
  await w.page.waitForTimeout(600);
}

for (const who of ['ana', 'jun'] as const) {
  test(`W2 ${who}: the host from "I would like to host" to credit earned`, async ({ page }, info) => {
    test.setTimeout(480_000);
    const w: Walk = { page, info, who, size: info.project.name, ids: new Set() };
    const watch = quiet(page, [/\/api\/me\/tea-credit/]);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const session = await signIn(page, who);
    const owner = await login(page, 'owner');
    owner.account = BALI;
    const isAna = who === 'ana';

    // The owner's part, before the host starts. An open door is the owner's to give (host_reach, set by
    // Adrian alone), so give it and say so. Without it neither fixture host is offered the open door (W2-4).
    if (isAna) {
      const me = await call(page, session, '/api/auth/me');
      const id = me.body.id ?? me.body.user?.id ?? me.body.sub;
      const reach = await call(page, owner, `/api/platform/users/${id}/host-reach`, { method: 'PUT', data: { reach: 'teajia' } });
      note(w, 'setup', `owner gives ${who} reach teajia: ${reach.status}`);
    }

    // ── 1. From Home, starts a table (2) ────────────────────────────────────
    await openHome(w);
    let first = '';
    let firstSent = { door: '', seats: '' } as { door: string | null; seats: string };
    await step(w, '1', 'from Home, start a table', { clicks: 2 }, async () => {
      await w.page.getByRole('link', { name: /Host a table/ }).first().click();
      await expect(w.page.getByRole('heading', { name: 'Host a table' })).toBeVisible({ timeout: 20_000 });
      note(w, 'form', `fields on the make-a-table form: ${JSON.stringify(await formFieldsAsked(w))}`);
      const doors = await w.page.locator('input[name="door"]').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
      note(w, 'form', `doors offered: ${doors.join(', ')}`);
      firstSent = await makeTable(w, { daysAhead: 9 });
      first = await readyTableId(w);
    });

    // ── 7. Shares the table: copies the link (1) ────────────────────────────
    await step(w, '7', 'copy the link', 1, async () => {
      await w.page.getByRole('button', { name: 'Copy link' }).click();
      await expect(w.page.getByText('Link copied.')).toBeVisible();
    }, { history: false });

    // ── 2. Door by request (the default), a second table by link and a third open (1 each) ──
    // After a table is made the form is hidden. The only ways back to it are Back, or Home then "Host a table".
    const another = await w.page.getByRole('button', { name: /another|again|new table/i }).count()
      + await w.page.getByRole('link', { name: /another|again|new table/i }).count();
    finding(w, 'W2-2', another > 0, 'after a table is made there is no "make another" control; the form comes back only by browser Back, or Home then Host a table');
    let second = '';
    if (isAna) {
      await step(w, '2a', 'a second table, by link', 1, async () => {
        await w.page.getByRole('button', { name: 'Make another table' }).click();
        await expect(w.page.getByRole('heading', { name: 'Host a table' })).toBeVisible();
        const dayHeld = await w.page.locator('input[name="date"]').inputValue();
        const doorHeld = await w.page.locator('input[name="door"]:checked').getAttribute('value');
        note(w, 'form', `after "Make another table" the day holds "${dayHeld}", the door is ${doorHeld}`);
        finding(w, 'W2-1', dayHeld === '' && doorHeld === firstSent.door && (await w.page.locator('input[name="seats"]').inputValue()) === firstSent.seats, 'the second form opens with the day empty and the seats and door of the last table');
        await makeTable(w, { daysAhead: 12, door: 'link' });
        second = await readyTableId(w);
      }, { history: false });
      await step(w, '2b', 'a third table, open', 1, async () => {
        await w.page.getByRole('button', { name: 'Make another table' }).click();
        await expect(w.page.getByRole('heading', { name: 'Host a table' })).toBeVisible();
        finding(w, 'W2-1', (await w.page.locator('input[name="door"]:checked').getAttribute('value')) === 'link', 'the third form opens with the door of the last table (link)');
        await makeTable(w, { daysAhead: 15, door: 'open' });
      }, { history: false });
    } else {
      note(w, 'jun', 'jun is offered only the request door, so no table by link and none open');
    }

    // ── 4. Teas to pour: a shop tea, one of her own, one by name only (2 each) ──
    await openTable(w, first, 'teas');
    const ownTea = `Own chest tea ${RUN}`;
    // Ana\u2019s Tea Chest is her personal stock account (the fixture holds \u201cAna\u2019s chest oolong, test\u201d), so only Jun adds one to the Tea Chest page.
    const added = isAna ? { status: 0, body: 'fixture' } : await call(page, session, '/api/me/cellar', { method: 'POST', data: { name: ownTea, type: 'Oolong', grams: 50, costAmount: 10, costCurrency: 'USD' } });
    note(w, 'setup', `${who}'s chest tea ${ownTea}: ${added.status} ${JSON.stringify(added.body).slice(0, 120)}`);
    await step(w, '4a', 'add one of the shop’s teas', { clicks: 2 }, async () => {
      await w.page.getByLabel('Add a tea').fill('white');
      const match = w.page.locator('[data-host-tea-match="shop"]').first();
      await expect(match).toBeVisible({ timeout: 15_000 });
      await match.click();
      await expect(w.page.locator('[data-host-tea]')).toHaveCount(1);
    });
    await step(w, '4b', 'add one of her own', { clicks: 2 }, async () => {
      await w.page.getByLabel('Add a tea').fill(isAna ? 'chest oolong' : 'Own chest');
      const match = w.page.locator('[data-host-tea-match="chest"]').first();
      const found = await match.isVisible({ timeout: 8_000 }).catch(() => false);
      if (isAna) expect.soft(found, 'ana\u2019s chest tea is offered').toBe(true); else note(w, 'jun', `a first-time host has no Tea Chest stock to pour from: found=${found}`);
      if (found) await match.click(); else await w.page.getByRole('button', { name: /as written/ }).click();
      await expect(w.page.locator('[data-host-tea]')).toHaveCount(2);
    });
    await step(w, '4c', 'add one by name only', { clicks: 2 }, async () => {
      await w.page.getByLabel('Add a tea').fill('Jasmine pearls from my neighbour');
      await w.page.getByRole('button', { name: /as written/ }).click();
      await expect(w.page.locator('[data-host-tea]')).toHaveCount(3);
    });

    // ── 5. The way to the house, three photographs through the shared editor (per photograph 2) ──
    await step(w, '5a', 'open the way in', 1, async () => {
      await partTab(w, 'The way in');
      await expect(w.page.getByRole('heading', { name: 'The way in', level: 2 })).toBeVisible();
      // No photograph goes up without the editor: the page has no visible file input.
      await expect(w.page.locator('input[type=file]:visible')).toHaveCount(0);
    });
    for (const n of [1, 2, 3]) {
      await step(w, `5-photo-${n}`, `step ${n} of the way with a photograph`, 2, async () => {
        await addWayStep(w, n, ['The blue gate after the warung.', 'Shoes off at the step.', 'Through the garden, left at the frangipani.'][n - 1]);
      }, { history: false });
    }
    await step(w, '5b', 'save the way and keep the place', { clicks: 2 }, async () => {
      await w.page.getByLabel('Address').fill('Jalan Raya Ubud 12');
      await w.page.getByRole('button', { name: 'Save the way in' }).click();
      await expect(w.page.getByText('Saved.')).toBeVisible();
      await w.page.getByLabel('Place name').fill('Ubud house');
      await w.page.getByRole('button', { name: 'Keep this for next time' }).click();
      await expect(w.page.getByText('Kept as Ubud house for next time.')).toBeVisible();
    });

    // ── 3. The place on the next table without typing it again (1); named as her table in Your Table ──
    if (isAna && second) {
      await openTable(w, second, 'way');
      await step(w, '3a', 'use the place on the next table', 1, async () => {
        await w.page.getByRole('button', { name: 'Use the way to Ubud house' }).click();
        await expect(w.page.getByLabel('Step 1', { exact: true })).toHaveValue('The blue gate after the warung.');
        const address = await w.page.getByLabel('Address').inputValue();
        finding(w, 'W2-6', address === 'Jalan Raya Ubud 12', 'using the kept way copies the steps but not the place’s address');
        await w.page.getByRole('button', { name: 'Save the way in' }).click();
        await expect(w.page.getByText('Saved.')).toBeVisible();
      });
    }
    await w.page.goto('/account/host');
    await step(w, '3b', 'name the place as her table in Your Table', { clicks: 2 }, async () => {
      const add = w.page.getByRole('button', { name: 'Add your table' }).or(w.page.getByRole('button', { name: 'Choose another place' }));
      await add.first().click();
      await w.page.getByRole('radio', { name: 'Ubud house' }).check();
      const area = w.page.getByLabel('The area people see');
      note(w, 'form', `area people see, before typing: "${await area.inputValue()}"`);
      await area.fill('Ubud, near the market');
      await w.page.getByRole('button', { name: 'Make this my table' }).click();
      await expect(w.page.getByText('Ubud house is your table.')).toBeVisible();
    });

    // ── 6. A request, the waiting list, a freed seat (1 each from the table's page) ──
    // Fresh tables for this run (the host makes them through the same route as the form), and guests ask
    // through the public door, so a second run on the same rig meets the same starting state.
    let requestTable = '';
    let linkTable = '';
    if (isAna) {
      const made = async (door: string, seats: number, offset: number) => (await call(page, session, '/api/me/tables', { method: 'POST', data: { date: day(offset), time: '10:00', timezone: 'Asia/Makassar', seats, door } }));
      const r1 = await made('request', 2, 20);
      const r2 = await made('link', 5, 21);
      requestTable = r1.body.id ?? r1.body.table?.id;
      linkTable = r2.body.id ?? r2.body.table?.id;
      note(w, 'setup', `request table ${r1.status} ${requestTable}; link table ${r2.status} ${linkTable}`);
      const slugOf = async (id: string) => (await call(page, session, `/api/me/tables/${id}`)).body.table.slug;
      let phone = 100;
      const rsvp = async (slug: string, name: string, contact: boolean) => {
        const data: Record<string, unknown> = { full_name: `${name} ${RUN}`, seat_key: `${RUN}-${name}-${w.size}`.replace(/\s/g, '-') };
        if (contact) Object.assign(data, { contact_method: 'whatsapp', phone_number: `+62812000${phone++}${w.size.length}` });
        const r = await call(page, null, `/api/events/${slug}/rsvp`, { method: 'POST', data });
        note(w, 'setup', `${name}: ${r.status} ${r.body.status ?? JSON.stringify(r.body).slice(0, 80)}`);
      };
      const requestSlug = await slugOf(requestTable);
      for (const name of ['Asks One', 'Asks Two']) await rsvp(requestSlug, name, true);
      const linkSlug = await slugOf(linkTable);
      for (const name of ['Seat One', 'Seat Two', 'Seat Three']) await rsvp(linkSlug, name, false);

      await openTable(w, requestTable);
      await step(w, '6a', 'see a request and confirm it', 1, async () => {
        await expect(w.page.getByText(`Asks One ${RUN}`)).toBeVisible();
        await w.page.getByRole('button', { name: `Yes to Asks One ${RUN}` }).click();
        await expect(w.page.locator('[data-host-group="coming"]').getByText(`Asks One ${RUN}`)).toBeVisible();
      });
      // The second yes and two later askers, through the API: the table is full, so the later ones wait.
      const detail = (await call(page, session, `/api/me/tables/${requestTable}`)).body;
      const two = detail.guests.find((x: any) => x.full_name === `Asks Two ${RUN}`);
      note(w, 'setup', `yes to Asks Two: ${(await call(page, session, `/api/me/tables/${requestTable}/guests/${two.id}/yes`, { method: 'PUT' })).status}`);
      for (const name of ['Asks Three', 'Asks Four']) await rsvp(requestSlug, name, true);
      await openTable(w, requestTable);
      await step(w, '6b', 'see the waiting list', 0, async () => {
        const waiting = await w.page.locator('[data-host-group="waiting"]').innerText();
        note(w, 'waiting-group', waiting.replace(/\s+/g, ' '));
        await expect(w.page.locator('[data-host-group="waiting"]')).toContainText('Waiting for a seat to open');
      });
      await step(w, '6c', 'give back a seat', { clicks: 2 }, async () => {
        await w.page.getByRole('button', { name: `Release the seat of Asks One ${RUN}` }).click();
        await w.page.getByRole('button', { name: `Yes, release the seat of Asks One ${RUN}` }).click();
        await expect(w.page.getByRole('button', { name: `Yes to Asks Three ${RUN}` })).toBeVisible({ timeout: 15_000 });
      });
      await step(w, '6d', 'say yes to the one who waited longest, now asking again', 1, async () => {
        await w.page.getByRole('button', { name: `Yes to Asks Three ${RUN}` }).click();
        await expect(w.page.locator('[data-host-group="coming"]').getByText(`Asks Three ${RUN}`)).toBeVisible({ timeout: 15_000 });
      });
    }

    // ── 8. After the session ───────────────────────────────────────────────
    if (isAna) {
      await openTable(w, 'fh-event');
      await step(w, '8a', 'open After', 1, async () => {
        await partTab(w, 'After');
        await expect(w.page.getByRole('heading', { name: 'After', level: 2 })).toBeVisible();
      });
      note(w, 'after-text', (await w.page.locator('[data-host-page="table"]').innerText()).replace(/\s+/g, ' ').slice(0, 1500));
      await step(w, '8b', 'mark who came and copy the thank-you', { clicks: 3 }, async () => {
        await w.page.getByRole('button', { name: 'Mark who came' }).click();
        await w.page.getByRole('button', { name: 'Save' }).click();
        await w.page.getByRole('button', { name: /Copy their thank-you link/ }).first().click();
        await expect(w.page.getByText(/Copied\. Send it only to/)).toBeVisible();
      });
      await step(w, '8c', 'review the guest book', 0, async () => {
        const guestBook = await w.page.getByText(/guest book/i).count();
        finding(w, 'W2-7', guestBook > 0, 'After shows no guest book review for a finished table');
      });
      await step(w, '8d', 'make the recap and put it on the Tea Table', 1, async () => {
        const recap = await w.page.getByRole('button', { name: /recap/i }).count() + await w.page.getByRole('link', { name: /recap/i }).count();
        note(w, 'after', `recap controls on the table's page: ${recap}`);
        const onTable = await w.page.getByRole('button', { name: /Tea Table/i }).count() + await w.page.getByRole('link', { name: /Tea Table/i }).count();
        finding(w, 'W2-8a', recap + onTable > 0, 'no part of the table’s page links to a recap or to the Tea Table');
      });
    }

    if (isAna) {
      // The recap is made and put on the Tea Table in Manage (EventDetail), after it is published. Walk there the way a person would.
      await openTable(w, 'fh-event', 'after');
      await step(w, '8e', 'from the table\u2019s page to its recap in Manage', 4, async () => {
        const hops: string[] = [];
        const tap = async (label: string, locator: ReturnType<Page['locator']>) => {
          try { await locator.first().click({ timeout: 6000 }); hops.push(label); await w.page.waitForTimeout(1200); } catch { hops.push(`${label} (not found)`); }
        };
        const manage = w.page.getByRole('button', { name: /^manage$/i }).or(w.page.getByRole('link', { name: /^manage$/i }));
        if (await manage.count() === 0) {
          // On the phone Manage is behind Your Table.
          await tap('Your Table', w.page.getByRole('button', { name: /^(Your Table|Account|Open Your Table)/i }));
          await tap('manage tile', w.page.getByRole('button', { name: /^manage/i }));
        } else await tap('Manage', manage);
        await tap('Sessions', w.page.getByRole('link', { name: /^Sessions$/ }).or(w.page.getByRole('button', { name: /^Sessions$/ })));
        await tap('Events', w.page.getByRole('link', { name: /^Events$/ }).or(w.page.getByRole('button', { name: /^Events$/ })));
        await tap('the table', w.page.getByText('Ana’s table, a test sit').first());
        await w.page.waitForTimeout(2500);
        const text = (await w.page.locator('body').innerText()).replace(/\s+/g, ' ');
        note(w, 'manage-event', `hops ${hops.join(' > ')}; at ${w.page.url()}; ${text.slice(0, 500)}`);
        finding(w, 'W2-8', /recap/i.test(text) && /Tea Table/i.test(text), `from the table\u2019s page the host reaches no recap and no Tea Table control (hops: ${hops.join(' > ')})`);
      }, { history: false });
    }

    // ── 9. A circle and a series, and an earlier guest asked back (2) ───────
    await w.page.goto('/account/host');
    await step(w, '9a', 'make a circle', 2, async () => {
      await w.page.getByRole('button', { name: 'Make a circle or series' }).click();
      await w.page.getByTestId('host-circle-new').getByPlaceholder('Thursday tea').fill(`Thursday tea ${RUN}`);
      await w.page.getByRole('button', { name: 'Make it' }).click();
      await expect(w.page.getByRole('article', { name: `Thursday tea ${RUN}` })).toBeVisible();
    });
    await step(w, '9b', 'make a series', 3, async () => {
      await w.page.getByRole('button', { name: 'Make a circle or series' }).click();
      const form = w.page.getByTestId('host-circle-new');
      await form.getByPlaceholder('Thursday tea').fill(`Spring series ${RUN}`);
      await form.getByLabel(/A series: several sessions/).check();
      await w.page.getByRole('button', { name: 'Make it' }).click();
      await expect(w.page.getByRole('article', { name: `Spring series ${RUN}` })).toBeVisible();
    });
    if (isAna) {
      await step(w, '9c', 'put two tables in the circle', 4, async () => {
        const circle = w.page.getByRole('article', { name: `Thursday tea ${RUN}` });
        for (const id of [requestTable, linkTable]) {
          await circle.getByLabel('Put a table in').selectOption(id);
          await circle.getByRole('button', { name: 'Put it in' }).click();
          await expect(circle.locator('li')).not.toHaveCount(0);
        }
      });
      await openTable(w, linkTable);
      await step(w, '9d', 'ask an earlier guest back', 2, async () => {
        const ask = w.page.getByRole('button', { name: 'Ask to this table' }).first();
        await expect(ask).toBeVisible({ timeout: 15_000 });
        await ask.click();
        await expect(w.page.getByText(/has a seat\./)).toBeVisible();
      });
    }

    // ── 10. Credit after the owner fills a guest's order, and asks to use it (2) ──
    if (isAna) {
      const paid = await call(page, owner, '/api/invoices/l5-guest-order/payments', { method: 'POST', data: { amount: 50, request_id: `w2-pay-${RUN}-${w.size}` } });
      const filled = await call(page, owner, '/api/rpc/ship-invoice', { method: 'POST', data: { invoice_id: 'l5-guest-order' } });
      note(w, 'setup', `owner records the payment ${paid.status} and ships the order ${filled.status}`);
      await w.page.goto('/');
      await step(w, '10a', 'from Home, to the credit page', 2, async () => {
        await openYourTable(w);
        await w.page.getByRole('button', { name: /tea credit/i }).first().click();
        await expect(w.page.getByRole('heading', { name: 'Tea credit', level: 1 })).toBeVisible({ timeout: 20_000 });
      });
      await step(w, '10b', 'ask to use it on an open order', 1, async () => {
        const row = w.page.getByRole('region', { name: 'Use it on an order' }).locator('li').first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.getByRole('button', { name: 'Use my tea credit' }).click();
        await expect(w.page.getByRole('region', { name: 'Credit you asked to use' })).toContainText('Waiting for the shop');
      });
    }

    // ── 11. An assistant key: made, seen once, disconnected (2) ─────────────
    await w.page.goto('/account/host');
    await step(w, '11a', 'make an assistant key', 2, async () => {
      await w.page.getByRole('button', { name: 'Connect an assistant' }).click();
      // W6-7: "Name it" opens as "My assistant", so the common case types nothing.
      await expect(w.page.getByLabel('Name it')).toHaveValue('My assistant');
      await w.page.getByRole('button', { name: 'Make the key' }).click();
      await expect(w.page.getByTestId('host-assistant-secret-value')).toBeVisible();
    }, { history: false });
    await step(w, '11b', 'see it once, then done', 1, async () => {
      await w.page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(w.page.getByTestId('host-assistant-secret-value')).toHaveCount(0);
    });
    await step(w, '11x', 'a second key: press Back and Forward while its secret shows', 2, async () => {
      await w.page.getByRole('button', { name: 'Connect an assistant' }).click();
      await w.page.getByLabel('Name it').fill(`Second ${RUN}`);
      await w.page.getByRole('button', { name: 'Make the key' }).click();
      await expect(w.page.getByTestId('host-assistant-secret-value')).toBeVisible();
      await w.page.goBack();
      await w.page.goForward();
      await w.page.waitForTimeout(800);
      const still = await w.page.getByTestId('host-assistant-secret-value').count();
      if (still > 0) note(w, 'history', '11x: the key shown once is still on the screen after Back and Forward');
      finding(w, 'W2-10', still > 0, 'Back then Forward on the screen that shows the key once leaves a blank "Name it" form: the key that was made is gone and cannot be shown again');
      const stray = w.page.getByRole('button', { name: 'Cancel' });
      if (await stray.count()) await stray.first().click();
    }, { history: false });
    await step(w, '11c', 'disconnect it', 2, async () => {
      const row = w.page.getByRole('listitem', { name: `ChatGPT ${RUN}` });
      await row.getByRole('button', { name: 'Disconnect' }).click();
      await w.page.getByTestId('host-assistant-disconnect').getByRole('button', { name: 'Disconnect' }).click();
      await expect(w.page.getByRole('listitem', { name: `ChatGPT ${RUN}` })).toHaveCount(0);
    });

    // ── 12. From anywhere in Your Table, reach any of her tables (2) ────────
    await w.page.goto('/');
    await step(w, '12a', 'from Home, open Your Table and reach a table', 2, async () => {
      await openYourTable(w);
      const links = await w.page.locator('a[href^="/account/host/"]').count();
      const names = await w.page.locator('[role=dialog] a, [role=dialog] button, main a, main button').evaluateAll(els => els.map(e => (e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean));
      note(w, 'your-table-controls', names.join(' | ').slice(0, 900));
      note(w, 'your-table-links', `links to a table on the first Your Table screen: ${links}`);
      finding(w, 'W2-9', links > 0, 'Your Table’s first screen links to none of her tables');
      if (links) await w.page.locator('a[href^="/account/host/"]').first().click();
    });

    await w.page.goto('/');
    await step(w, '12b', 'from Home, Your Table, Journey, then a table', 3, async () => {
      await openYourTable(w);
      const journey = w.page.getByRole('button', { name: /journey/i }).or(w.page.getByRole('link', { name: /journey/i }));
      const have = await journey.count();
      note(w, 'journey', `journey control on Your Table: ${have}`);
      if (have) await journey.first().click();
      await w.page.waitForTimeout(1500);
      const link = w.page.locator('a[href^="/account/host/"]').first();
      const there = await link.isVisible({ timeout: 8000 }).catch(() => false);
      note(w, 'journey', `a table link on the Journey screen: ${there}; at ${w.page.url()}`);
      if (there) await link.click();
    });

    watch.check(`${who} walk`);
    if (w.ids.size) test.fail(true, [...w.ids].join(', '));
  });
}
