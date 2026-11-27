/**
 * Launch 4, "what happened becomes visible": every surface walked the way
 * people use it, at phone and desktop size, then the same shop with every
 * Launch 4 switch off. (A4 finish: the Tea Table, favourites, the Your Table
 * page and place, host articles, top teas and tea houses.)
 *
 * Runs against the offline fixture sandbox, never the live shop, on its own
 * ports: one state directory (worker/sandbox/offline-fixtures.mjs, which also
 * seeds worker/sandbox/launch-4-fixture.mjs), two workers on it.
 *   worker ON   port 8881, FIRST_TABLE_OPEN FEW_HOSTS_OPEN ANYONE_HOSTS_OPEN and
 *               all seven Launch 4 switches true (TEAJIA_OFFLINE_FIXTURES_PORT=8881)
 *   worker OFF  port 8882, the same without the Launch 4 switches
 *   site  L4_ON_URL   (default http://127.0.0.1:7881, TEAJIA_API_PROXY=http://127.0.0.1:8881,
 *                      every VITE_ switch above true)
 *   site  L4_OFF_URL  (default http://127.0.0.1:7882, TEAJIA_API_PROXY=http://127.0.0.1:8882,
 *                      the seven Launch 4 VITE_ switches false)
 *   L4_RUN      optional, one name for the whole run, so the pieces are put back once
 *               per size even when Playwright starts a fresh worker after a failure
 *   L4_STATE    the workers' --persist-to directory
 *   L4_CHROME   optional, a Chromium to launch instead of Playwright's own
 * Run it with one worker: npx playwright test tests/launch-4.spec.ts --project chromium --workers 1
 *
 * People: mei / mei (a member with a tasting to share), jun / jun (whose
 * tasting is on the table), ana / ana (an approved host), lin / lin (a tea
 * master), and the platform owner sandbox / sandbox.
 *
 * Before each size the fixture pieces are put back (tests/helpers/launch4Setup.ts).
 * The journal's tasting card nests one button in another, which React reports;
 * that is older than Launch 4 (TastingJournalView) and is the one console error let pass.
 * Each step asserts no horizontal overflow and no console errors. Every check is
 * soft, so a step that fails does not stop the ones after it.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, stubBrowserServices, test } from './fixtures';
import { launch4State, resetLaunch4 } from './helpers/launch4Setup';

const ON_URL = process.env.L4_ON_URL ?? 'http://127.0.0.1:7881';
const OFF_URL = process.env.L4_OFF_URL ?? 'http://127.0.0.1:7882';
const SHOT_DIR = process.env.L4_SHOTS ?? join(process.env.TMPDIR ?? '/tmp', 'launch-4-shots');

const RUN = Date.now().toString(36).slice(-5);
const MEI_TEA = 'Old tree white, test';
const JUN_TEA = 'Mountain red, test';
const RECAP = 'Autumn oolongs, a test recap';
const ARTICLE = 'Before a white tea';
const HOUSE = 'Garden House, test';

test.skip(!launch4State(), 'Needs the offline fixture sandbox: set L4_STATE (see the header).');
test.use({ actionTimeout: 10_000, navigationTimeout: 30_000 });
// L4_CHROME names a Chromium already on the machine, when Playwright's own download is not there.
if (process.env.L4_CHROME) test.use({ launchOptions: { executablePath: process.env.L4_CHROME } });
test.describe.configure({ mode: 'default', timeout: 240_000 });

const SIZES = [
  { name: 'phone 390x844', width: 390, height: 844 },
  { name: 'desktop 1280x800', width: 1280, height: 800 },
];

/** Failed loads from sandbox routes that no step of this journey reads. */
const QUIET_FAILED_LOADS = [
  /\/api\/me\/pay-access/, /\/api\/me\/samples/, /\/api\/s\/[^/]+\/events/, /\/api\/read\/session/,
  /\/api\/story-content\//, /\/api\/events\/[^/]+\/find-rsvp/,
];

/** Console errors older than Launch 4, on pages this journey passes through. */
const KNOWN_CONSOLE = [/cannot be a descendant of|cannot contain a nested/];

type Person = { context: BrowserContext; page: Page; errors: string[]; allow: RegExp[]; seen: string[] };

async function newPerson(browser: Browser, size: { width: number; height: number }, base = ON_URL, allow: RegExp[] = []): Promise<Person> {
  const context = await browser.newContext({ baseURL: base, viewport: { width: size.width, height: size.height } });
  await stubBrowserServices(context);
  const page = await context.newPage();
  const person: Person = { context, page, errors: [], allow, seen: [] };
  page.on('pageerror', error => person.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const where = message.location().url;
    if ([...QUIET_FAILED_LOADS, ...person.allow].some(pattern => pattern.test(where))) return;
    if (KNOWN_CONSOLE.some(pattern => pattern.test(message.text()))) return;
    person.errors.push(`console: ${message.text()} (${where})`);
  });
  page.on('response', async response => {
    if (!/\/api\//.test(response.url())) return;
    try { person.seen.push(`${response.request().method()} ${new URL(response.url()).pathname}\n${await response.text()}`); } catch { /* no body */ }
  });
  return person;
}

async function assertNoOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `horizontal overflow in px, ${where}`).toBeLessThanOrEqual(0);
}

async function clean(person: Person, where: string) {
  await assertNoOverflow(person.page, where);
  expect.soft(person.errors, `console errors, ${where}`).toEqual([]);
  person.errors.length = 0;
}

async function shoot(person: Person, name: string) {
  try {
    mkdirSync(SHOT_DIR, { recursive: true });
    await person.page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
  } catch { /* the page may be gone */ }
}

/** One check. A throw is recorded as a failed soft check with a picture, and the step carries on. */
async function check(person: Person, label: string, shot: string, body: () => Promise<void>) {
  try { await body(); } catch (error) {
    const line = String((error as Error).message ?? error).split('\n').filter(Boolean).slice(0, 3).join(' / ');
    expect.soft(line, `CHECK FAILED: ${label}`).toBe('passed');
    await shoot(person, `${shot}-FAIL-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`);
  }
}

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/signin');
  await page.locator('#signin-identifier').fill(identifier);
  await page.locator('#signin-password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#signin-identifier')).toHaveCount(0);
}

/** A page that says it does not exist, the way an address nobody made does. */
async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText('Page not found')).toBeVisible();
}

const teaTablePiece = (page: Page, name: string) =>
  page.getByTestId('tea-table-page').locator('article, li, section > div').filter({ hasText: name }).first();

const picture = readFileSync(join(process.cwd(), 'public', 'icon-192.png'));

/** No number of keeps, likes or followers, and no score, in anything public. */
function expectNoCount(text: string, where: string) {
  expect.soft(text, `${where}: no keep count`).not.toMatch(/\b\d+\s+(?:kept|keeps|people kept|likes?|followers?)\b/i);
  expect.soft(text, `${where}: no count field`).not.toMatch(/"(?:keeps|keep_count|likes|followers|view_count)"\s*:/);
}

for (const size of SIZES) {
  test.describe(`Launch 4 at ${size.name}`, () => {
    test.beforeAll(() => { resetLaunch4(`${process.env.L4_RUN ?? ''}-${size.width}`); });

    test('1. mei puts her tasting on the Tea Table from her journal', async ({ browser }) => {
      const mei = await newPerson(browser, size);
      const shot = `${size.width}-1`;
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'share from the journal', shot, async () => {
        await mei.page.goto('/account/journal');
        const line = mei.page.getByTestId('journal-share-line').filter({ hasText: 'Private' }).first();
        await line.click();
        const step = mei.page.getByRole('dialog', { name: 'Share this tasting' });
        await step.getByRole('button', { name: 'On my page and the Tea Table', exact: true }).click();
        await expect(step.getByRole('button', { name: 'Close' })).toBeVisible();
        await step.getByRole('button', { name: 'Close' }).click();
        await expect(mei.page.getByTestId('journal-share-line').filter({ hasText: 'On your page and the Tea Table' })).toBeVisible();
      });
      await clean(mei, 'journal');
      await check(mei, 'on the table, newest first, with her words', shot, async () => {
        await mei.page.goto('/tea-table');
        const items = mei.page.getByTestId('tea-table-day');
        await expect(items.first()).toContainText(MEI_TEA);
        await expect(items.first()).toContainText('Honey on the lid');
        const text = await mei.page.getByTestId('tea-table-page').innerText();
        expect.soft(text.indexOf(MEI_TEA), 'newest first').toBeLessThan(text.indexOf(JUN_TEA));
        expect.soft(text, 'nothing about what is coming').not.toMatch(/Next at a table/);
      });
      await clean(mei, 'tea table');
      await shoot(mei, `${shot}-tea-table`);
      await mei.context.close();
    });

    test('2. the host puts a recap on and holds it at the top', async ({ browser }) => {
      const owner = await newPerson(browser, size);
      const shot = `${size.width}-2`;
      await check(owner, 'sign in', shot, () => signIn(owner.page, 'sandbox', 'sandbox'));
      await check(owner, 'put on and hold', shot, async () => {
        await owner.page.goto('/admin/events/l4-recap?tab=post-session');
        const control = owner.page.getByTestId('tea-table-recap-control');
        await control.scrollIntoViewIfNeeded();
        await control.getByRole('button', { name: 'Put on the Tea Table' }).click();
        await control.getByRole('button', { name: /^Hold at the top for \d+ days$/ }).click();
        await expect(control.getByRole('button', { name: 'Let it go' })).toBeVisible();
      });
      await clean(owner, 'event manage');
      await check(owner, 'held at the top of the table', shot, async () => {
        await owner.page.goto('/tea-table');
        await expect(owner.page.getByTestId('tea-table-held')).toContainText(RECAP);
      });
      await clean(owner, 'tea table held');
      await owner.context.close();
    });

    test('3. mei keeps a piece and lets it go, and no count shows anywhere public', async ({ browser }) => {
      const mei = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      const shot = `${size.width}-3`;
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'keep', shot, async () => {
        await mei.page.goto('/tea-table');
        const keep = teaTablePiece(mei.page, JUN_TEA).getByTestId('tea-table-keep');
        await keep.click();
        await expect(keep).toHaveAttribute('aria-pressed', 'true');
      });
      await check(mei, 'kept privately in favourites', shot, async () => {
        await mei.page.goto('/account/favourites');
        const section = mei.page.getByRole('region', { name: 'From the Tea Table' });
        await expect(section).toContainText(JUN_TEA);
        await section.getByRole('button', { name: `Take ${JUN_TEA} off` }).click();
        await expect(mei.page.getByRole('region', { name: 'From the Tea Table' })).toHaveCount(0);
      });
      await clean(mei, 'favourites');
      await check(mei, 'let go on the table too', shot, async () => {
        await mei.page.goto('/tea-table');
        await expect(teaTablePiece(mei.page, JUN_TEA).getByTestId('tea-table-keep')).toHaveAttribute('aria-pressed', 'false');
      });
      await check(visitor, 'no count on the table or a person page', shot, async () => {
        for (const path of ['/tea-table', '/people/l4-jun', '/people']) {
          await visitor.page.goto(path);
          await visitor.page.waitForLoadState('networkidle');
          expectNoCount(await visitor.page.locator('body').innerText(), path);
        }
        expectNoCount(visitor.seen.join('\n'), 'public answers');
      });
      await clean(mei, 'tea table keep');
      await clean(visitor, 'public pages');
      await mei.context.close();
      await visitor.context.close();
    });

    test('4. mei takes her own tasting off the table', async ({ browser }) => {
      const mei = await newPerson(browser, size);
      const shot = `${size.width}-4`;
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'take off', shot, async () => {
        await mei.page.goto('/tea-table');
        const piece = teaTablePiece(mei.page, MEI_TEA);
        await piece.getByTestId('tea-table-take-off').click();
        await expect(mei.page.getByTestId('tea-table-page')).not.toContainText(MEI_TEA);
      });
      await clean(mei, 'take off');
      await mei.context.close();
    });

    test('5. the owner hides a piece from the whole table', async ({ browser }) => {
      const owner = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      const shot = `${size.width}-5`;
      await check(owner, 'sign in', shot, () => signIn(owner.page, 'sandbox', 'sandbox'));
      await check(owner, 'hide in Guest notes', shot, async () => {
        await owner.page.goto('/admin/tasting-notes');
        const row = owner.page.getByTestId('tea-table-manage-row').filter({ hasText: JUN_TEA });
        await row.scrollIntoViewIfNeeded();
        await row.getByRole('button', { name: 'Hide it' }).click();
        await expect(row).toContainText('Hidden');
      });
      await clean(owner, 'guest notes');
      await check(visitor, 'gone for everyone', shot, async () => {
        await visitor.page.goto('/tea-table');
        await expect(visitor.page.getByTestId('tea-table-page')).toContainText(RECAP);
        await expect(visitor.page.getByTestId('tea-table-page')).not.toContainText(JUN_TEA);
      });
      await clean(visitor, 'tea table after hide');
      await owner.context.close();
      await visitor.context.close();
    });

    test('6. mei keeps an article and takes it off', async ({ browser }) => {
      const mei = await newPerson(browser, size);
      const shot = `${size.width}-6`;
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'keep the article', shot, async () => {
        await mei.page.goto('/article/ft-before-a-white-tea');
        const keep = mei.page.getByTestId('keep-article').first();
        await keep.click();
        await expect(keep).toHaveText('Kept');
      });
      await clean(mei, 'article');
      await check(mei, 'in favourites, and taken off', shot, async () => {
        await mei.page.goto('/account/favourites');
        const section = mei.page.getByRole('region', { name: 'Articles' });
        await expect(section).toContainText(ARTICLE);
        expectNoCount(await mei.page.locator('body').innerText(), 'favourites');
        await section.getByRole('button', { name: `Take ${ARTICLE} off` }).click();
        await expect(mei.page.getByRole('region', { name: 'Articles' })).toHaveCount(0);
      });
      await clean(mei, 'favourites articles');
      await mei.context.close();
    });

    test('7. Your Table is a page, with its own addresses', async ({ browser }) => {
      const mei = await newPerson(browser, size);
      const shot = `${size.width}-7`;
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'the page and its steps', shot, async () => {
        await mei.page.goto('/account');
        await expect(mei.page).toHaveURL(/\/account$/);
        await expect(mei.page.getByText('Page not found')).toHaveCount(0);
        await assertNoOverflow(mei.page, '/account');
        for (const path of ['/account/sessions', '/account/tea-houses']) {
          await mei.page.goto(path);
          await expect(mei.page.getByText('Page not found')).toHaveCount(0);
          await assertNoOverflow(mei.page, path);
        }
        await mei.page.goBack();
        await expect(mei.page).toHaveURL(/\/account\/sessions$/);
        await mei.page.goForward();
        await expect(mei.page).toHaveURL(/\/account\/tea-houses$/);
      });
      await clean(mei, 'your table page');
      await shoot(mei, `${shot}-account`);
      await mei.context.close();
    });

    test('8. ana names her table, then undoes it', async ({ browser }) => {
      const ana = await newPerson(browser, size);
      const shot = `${size.width}-8`;
      await check(ana, 'sign in', shot, () => signIn(ana.page, 'ana', 'ana'));
      await check(ana, 'add your table', shot, async () => {
        await ana.page.goto('/account/host');
        const section = ana.page.getByTestId('your-table');
        await section.scrollIntoViewIfNeeded();
        await section.getByRole('button', { name: 'Add your table' }).click();
        await expect(ana.page).toHaveURL(/[?&]your-table=choose/);
        const form = ana.page.getByTestId('your-table-choose');
        await form.getByRole('textbox', { name: 'The area people see' }).fill('Ubud, near the river');
        await form.getByRole('button', { name: 'Make this my table' }).click();
        await expect(section.getByTestId('your-table-chosen')).toContainText('is your table');
        await expect(section).toContainText('Ubud, near the river');
        await expect(section).not.toContainText('Jalan Courtyard');
        await section.getByRole('button', { name: 'Undo' }).click();
        await expect(section.getByRole('button', { name: 'Add your table' })).toBeVisible();
      });
      await clean(ana, 'your table place');
      await ana.context.close();
    });

    test('9. ana offers an article and Adrian publishes it', async ({ browser }) => {
      const ana = await newPerson(browser, size);
      const owner = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      const title = `A morning at my table ${RUN}${size.width}`;
      const shot = `${size.width}-9`;
      await check(ana, 'sign in', shot, () => signIn(ana.page, 'ana', 'ana'));
      await check(ana, 'offer', shot, async () => {
        await ana.page.goto('/account/profile');
        await ana.page.getByRole('button', { name: 'Offer an article' }).click();
        await ana.page.getByLabel('Title').fill(title);
        await ana.page.getByRole('textbox', { name: 'Article' }).fill('We poured a spring green for six people and nobody spoke for a while.');
        await ana.page.getByRole('button', { name: 'Send to Adrian' }).click();
        await expect(ana.page.getByRole('region', { name: 'Your articles' })).toContainText(title);
      });
      await clean(ana, 'offer');
      await check(owner, 'sign in', shot, () => signIn(owner.page, 'sandbox', 'sandbox'));
      await check(owner, 'review and publish', shot, async () => {
        await owner.page.goto('/admin/magazine');
        await owner.page.getByRole('button', { name: 'Article offers' }).click();
        const row = owner.page.getByRole('listitem').filter({ hasText: title });
        await row.getByRole('button', { name: 'Review offer' }).click();
        await owner.page.getByRole('button', { name: 'Publish article' }).click();
        await expect(owner.page.getByRole('link', { name: 'Read published article' })).toBeVisible();
      });
      await clean(owner, 'magazine review');
      await check(visitor, 'the article is public', shot, async () => {
        await visitor.page.goto('/read');
        await visitor.page.waitForLoadState('networkidle');
        const href = await owner.page.getByRole('link', { name: 'Read published article' }).getAttribute('href');
        await visitor.page.goto(href!);
        await expect(visitor.page.getByText(title).first()).toBeVisible();
      });
      await clean(visitor, 'published article');
      for (const person of [ana, owner, visitor]) await person.context.close();
    });

    test('10. lin chooses a top tea, and it shows with no score', async ({ browser }) => {
      const lin = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      const name = `Grandfather roast ${RUN}`;
      const shot = `${size.width}-10`;
      await check(lin, 'sign in', shot, () => signIn(lin.page, 'lin', 'lin'));
      await check(lin, 'choose a top tea', shot, async () => {
        await lin.page.goto('/people/l4-lin');
        const section = lin.page.getByRole('region', { name: 'My top teas' });
        await section.scrollIntoViewIfNeeded();
        await section.getByRole('button', { name: 'Choose top teas' }).click();
        await expect(lin.page).toHaveURL(/[?&]top-tea=/);
        await section.getByLabel('Tea name').fill(name);
        await section.locator('input[type=file]').setInputFiles({ name: 'tea.png', mimeType: 'image/png', buffer: picture });
        await lin.page.getByRole('button', { name: 'Use photo' }).click();
        await section.getByRole('button', { name: 'Save pick' }).click();
        await expect(section).toContainText(name);
      });
      await clean(lin, 'top teas');
      await check(visitor, 'seen by a visitor, with no score', shot, async () => {
        await visitor.page.goto('/people/l4-lin');
        const section = visitor.page.getByRole('region', { name: 'My top teas' });
        await expect(section).toContainText(name);
        expect.soft(await section.innerText()).not.toMatch(/\bscore\b|\/\s*10\b|★/i);
        expect.soft(visitor.seen.filter(s => s.includes('/top-teas')).join('\n')).not.toMatch(/"(?:score|rating)"\s*:/);
      });
      await clean(visitor, 'top teas public');
      await lin.context.close();
      await visitor.context.close();
    });

    test('11. Adrian writes his part in a tea house and shows the page', async ({ browser }) => {
      const owner = await newPerson(browser, size);
      const visitor = await newPerson(browser, size);
      const words = `I laid out the room around one long table ${RUN}.`;
      const shot = `${size.width}-11`;
      await check(owner, 'sign in', shot, () => signIn(owner.page, 'sandbox', 'sandbox'));
      await check(owner, 'write and show', shot, async () => {
        await owner.page.goto('/admin/account-settings?house=l4-house');
        const form = owner.page.getByTestId('tea-house-form');
        await expect(form).toContainText(HOUSE);
        const part = form.getByTestId('part-room');
        await part.getByRole('button', { name: 'I did this here' }).click();
        await part.getByLabel('In a sentence or two, what you did here').fill(words);
        await part.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(part).toContainText(words);
        await form.getByRole('button', { name: 'Show the page' }).click();
        await expect(form.getByRole('button', { name: 'Keep the page back' })).toBeVisible();
      });
      await clean(owner, 'tea house manage');
      await check(visitor, 'the portfolio, in his words', shot, async () => {
        await visitor.page.goto('/tea-houses');
        await expect(visitor.page.getByRole('link', { name: 'Houses I have worked on' })).toBeVisible();
        await assertNoOverflow(visitor.page, '/tea-houses');
        await visitor.page.goto('/tea-houses/work');
        await expect(visitor.page.getByTestId('tea-houses-work')).toContainText(HOUSE);
        await assertNoOverflow(visitor.page, '/tea-houses/work');
        await visitor.page.goto('/tea-houses/work/l4-garden-house');
        await expect(visitor.page.getByText(words)).toBeVisible();
        await assertNoOverflow(visitor.page, 'house page');
        await visitor.page.goto('/tea-houses/build');
        await expect(visitor.page.getByTestId('tea-houses-build')).toContainText(HOUSE);
        await assertNoOverflow(visitor.page, '/tea-houses/build');
        await visitor.page.goto('/tea-houses/visit');
        await expect(visitor.page.locator('body')).toContainText(HOUSE);
        expectNoCount(await visitor.page.locator('body').innerText(), 'visit');
      });
      await clean(visitor, 'tea houses public');
      await check(owner, 'kept back, gone at once', shot, async () => {
        await owner.page.getByTestId('tea-house-form').getByRole('button', { name: 'Keep the page back' }).click();
        await expect(owner.page.getByTestId('tea-house-form').getByRole('button', { name: 'Show the page' })).toBeVisible();
        await visitor.page.goto('/tea-houses/work/l4-garden-house');
        await expect(visitor.page.getByText(words)).toHaveCount(0);
      });
      await shoot(visitor, `${shot}-house`);
      await owner.context.close();
      await visitor.context.close();
    });

    test('12. with every Launch 4 switch off, none of it shows', async ({ browser }) => {
      const visitor = await newPerson(browser, size, OFF_URL);
      const mei = await newPerson(browser, size, OFF_URL);
      const ana = await newPerson(browser, size, OFF_URL);
      const owner = await newPerson(browser, size, OFF_URL);
      const shot = `${size.width}-12`;
      await check(visitor, 'closed addresses are not found', shot, async () => {
        for (const path of ['/tea-table', '/tea-houses', '/tea-houses/visit', '/tea-houses/work', '/tea-houses/build', '/tea-houses/work/l4-garden-house']) {
          await expectNotFound(visitor.page, path);
          await assertNoOverflow(visitor.page, `${path} closed`);
        }
        await visitor.page.goto('/tea-feed');
        await expect(visitor.page).toHaveURL(new RegExp(`^${OFF_URL}/?$`));
      });
      await check(visitor, 'no top teas and no credit lines', shot, async () => {
        await visitor.page.goto('/people/l4-lin');
        await visitor.page.waitForLoadState('networkidle');
        await expect(visitor.page.getByRole('region', { name: 'My top teas' })).toHaveCount(0);
        await visitor.page.goto('/people');
        await visitor.page.waitForLoadState('networkidle');
        await expect(visitor.page.getByText('Pours at tables')).toHaveCount(0);
        const answers = visitor.seen.join('\n');
        for (const field of ['photograph_by', 'poured_with', '"pours"', 'next_session', 'cover_image_url']) {
          expect.soft(answers.includes(field), `no ${field} in a public answer`).toBe(false);
        }
      });
      await clean(visitor, 'closed public');
      await check(mei, 'sign in', shot, () => signIn(mei.page, 'mei', 'mei'));
      await check(mei, 'no favourites, no share lines, no keep, the panel at /account', shot, async () => {
        await expectNotFound(mei.page, '/account/favourites');
        await expectNotFound(mei.page, '/account/sessions');
        await mei.page.goto('/account/journal');
        await mei.page.waitForLoadState('networkidle');
        await expect(mei.page.getByTestId('journal-share-line')).toHaveCount(0);
        await mei.page.goto('/article/ft-before-a-white-tea');
        await mei.page.waitForLoadState('networkidle');
        await expect(mei.page.getByTestId('keep-article')).toHaveCount(0);
      });
      await check(ana, 'sign in', shot, () => signIn(ana.page, 'ana', 'ana'));
      await check(ana, 'no your table, no article offers', shot, async () => {
        await ana.page.goto('/account/host');
        await expect(ana.page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(ana.page.getByTestId('your-table')).toHaveCount(0);
        await ana.page.goto('/account/profile');
        await ana.page.waitForLoadState('networkidle');
        await expect(ana.page.getByRole('button', { name: 'Offer an article' })).toHaveCount(0);
      });
      await clean(ana, 'closed host');
      await check(owner, 'sign in', shot, () => signIn(owner.page, 'sandbox', 'sandbox'));
      await check(owner, 'no Tea Table, tea house or offer controls in Manage', shot, async () => {
        await owner.page.goto('/admin/events/l4-recap?tab=post-session');
        await owner.page.waitForLoadState('networkidle');
        await expect(owner.page.getByTestId('tea-table-recap-control')).toHaveCount(0);
        await owner.page.goto('/admin/tasting-notes');
        await owner.page.waitForLoadState('networkidle');
        await expect(owner.page.getByTestId('tea-table-manage')).toHaveCount(0);
        await owner.page.goto('/admin/account-settings');
        await owner.page.waitForLoadState('networkidle');
        await expect(owner.page.getByTestId('tea-house-portfolio-manage')).toHaveCount(0);
        await owner.page.goto('/admin/magazine');
        await owner.page.waitForLoadState('networkidle');
        await expect(owner.page.getByRole('button', { name: 'Article offers' })).toHaveCount(0);
      });
      await clean(owner, 'closed manage');
      for (const person of [visitor, mei, ana, owner]) await person.context.close();
    });
  });
}
