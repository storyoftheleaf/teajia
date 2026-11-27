import { expect, test, type Page } from './fixtures';

// A person's page says their practice, not a title (src/lib/practiceLines.ts).
// With mocked routes. Closed (the live site), the person's page and their
// profile show and ask nothing new, and never call the practice route. With
// VITE_PRACTICE_LINES_OPEN=true on the site, a visitor reads the three lines
// and the owner answers each one in place.
//
// PRACTICE_SHOTS=<folder/> also saves the screenshots for Adrian, phone and
// desktop, into that folder.

const practiceOpen = process.env.VITE_PRACTICE_LINES_OPEN === 'true';
const shots = process.env.PRACTICE_SHOTS ?? '';

function fakeJWT(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}
const token = fakeJWT({ sub: 'mei', email: 'mei@example.test', name: 'Mei Lin', role: 'member', exp: Math.floor(Date.now() / 1000) + 86_400 });

const person = {
  id: 'mei', account_id: 'acct', display_name: 'Mei Lin', role: null, is_published: 1, location_line: 'Ubud, Bali',
  beginnings: 'I began with oolong, in a kitchen in Taipei.', inspirations: null, links: [], articles: [], featured_in: [],
  products: [], host_account: null, seasonal_line: null, pull_quotes: [], gallery_images: [], tea_selection: [],
  collection: null, hosting: null, page_tier: 'family', created_at: '2026-01-01', updated_at: '2026-01-01',
};

type Lines = { since: number | null; drawn: string | null; doings: string[] };

async function prepare(page: Page, options: { owner: boolean; lines: Lines }) {
  const state = { lines: { ...options.lines } };
  const practiceCalls: string[] = [];
  if (options.owner) {
    await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  }
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? route.fallback() : route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/media/')) return route.fallback();
    if (path === '/api/people/mei/practice' || path === '/api/public/people/mei/practice') {
      practiceCalls.push(`${request.method()} ${path}`);
      if (!practiceOpen) return route.fulfill({ status: 404, json: { error: 'Not found' } });
      const signedIn = Boolean(request.headers().authorization);
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as Partial<Lines>;
        if ('since' in body) state.lines.since = body.since ?? null;
        if ('drawn' in body) state.lines.drawn = body.drawn ?? null;
        if ('doings' in body) state.lines.doings = body.doings ?? [];
      }
      return route.fulfill({ json: { can_edit: options.owner && signedIn, lines: state.lines } });
    }
    if (path === '/api/people/mei') return route.fulfill({ json: person });
    if (path === '/api/me/public-profile') {
      return route.fulfill({ json: options.owner ? {
        contributor: { ...person, slug: 'mei', publication_state: 'published', associations: [], accounts: [], live_profile: person, pending_profile: null },
        can_create: false,
      } : { contributor: null, can_create: false } });
    }
    if (path === '/api/me/public-profile/favorites') return route.fulfill({ json: { favorites: [] } });
    if (path === '/api/me/people/mei/sit-placements') return route.fulfill({ json: { recaps: [] } });
    if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] });
    if (path === '/api/auth/me') return route.fulfill({ json: options.owner ? { user: { id: 'mei', email: 'mei@example.test', name: 'Mei Lin' } } : {} });
    return route.fulfill({ json: {} });
  });
  return { state, practiceCalls };
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function shot(page: Page, name: string, focus?: string) {
  if (!shots) return;
  if (focus) await page.getByTestId(focus).evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}${name}.png`, fullPage: false });
}

const answeredLines: Lines = { since: 2009, drawn: 'The quiet of the first pour, before anyone speaks.', doings: ['pours', 'hosts', 'daily'] };

test.describe('closed, as the live site is', () => {
  test.skip(practiceOpen, 'Runs with the practice lines closed; unset VITE_PRACTICE_LINES_OPEN');

  test('the person page and the profile show nothing new and never ask for the lines', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { practiceCalls } = await prepare(page, { owner: true, lines: answeredLines });
    await page.goto('/people/mei');
    await expect(page.getByTestId('profile-cover')).toContainText('Mei');
    await expect(page.getByTestId('practice-lines')).toHaveCount(0);
    await expect(page.getByText('With tea since')).toHaveCount(0);
    await page.goto('/account/profile');
    await expect(page.getByRole('heading', { name: 'Your public profile' })).toBeVisible();
    await expect(page.getByTestId('practice-lines')).toHaveCount(0);
    expect(practiceCalls).toEqual([]);
  });
});

test.describe('open', () => {
  test.skip(!practiceOpen, 'The practice lines are closed; run with VITE_PRACTICE_LINES_OPEN=true');

  for (const [label, width, height] of [['phone', 390, 844], ['desktop', 1280, 900], ['narrow', 320, 640]] as const) {
    test(`a visitor reads the three lines, at ${label} width`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await prepare(page, { owner: false, lines: answeredLines });
      await page.goto('/people/mei');
      const lines = page.getByTestId('practice-lines');
      await expect(lines.getByTestId('practice-since')).toContainText('With tea since');
      await expect(lines.getByTestId('practice-since')).toContainText('2009');
      await expect(lines.getByTestId('practice-drawn')).toContainText('The quiet of the first pour');
      await expect(lines.getByTestId('practice-doings')).toContainText('I pour for others. I host a table. I drink tea every day.');
      // A visitor is asked nothing and can change nothing; no number of years, no title.
      await expect(lines.getByRole('button')).toHaveCount(0);
      expect(await lines.innerText()).not.toMatch(/years|master|level/i);
      await noHorizontalOverflow(page);
      await lines.scrollIntoViewIfNeeded();
      if (label !== 'narrow') await shot(page, `public-page-${label}`);
    });

    test(`a visitor sees nothing where nothing was answered, at ${label} width`, async ({ page }) => {
      test.skip(label !== 'phone', 'Once is enough');
      await page.setViewportSize({ width, height });
      await prepare(page, { owner: false, lines: { since: null, drawn: null, doings: [] } });
      await page.goto('/people/mei');
      await expect(page.getByTestId('profile-cover')).toContainText('Mei');
      await expect(page.getByTestId('practice-lines')).toHaveCount(0);
    });

    test(`the owner answers each line in place, at ${label} width`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const { state } = await prepare(page, { owner: true, lines: { since: null, drawn: null, doings: [] } });
      await page.goto('/people/mei');
      const lines = page.getByTestId('practice-lines');
      await expect(lines.getByRole('button', { name: 'Add the year you came to tea' })).toBeVisible();
      await expect(lines).toContainText('Only you see the lines you have not answered.');
      await lines.scrollIntoViewIfNeeded();
      if (label !== 'narrow') await shot(page, `own-page-asks-${label}`);

      // With tea since: one line. Opening it is a step in the address.
      await lines.getByRole('button', { name: 'Add the year you came to tea' }).click();
      await expect(page).toHaveURL(/[?&]practice=since/);
      await lines.getByLabel('The year you came to tea').fill('2009');
      await noHorizontalOverflow(page);
      if (label !== 'narrow') await shot(page, `answer-since-${label}`, 'practice-since-answer');
      await lines.getByRole('button', { name: 'Save' }).click();
      await expect(lines.getByTestId('practice-since')).toContainText('2009');
      expect(state.lines.since).toBe(2009);
      await expect(page).not.toHaveURL(/practice=/);

      // What draws me: one line, typed here (or said through the transcription).
      await lines.getByRole('button', { name: 'Say what draws you to tea' }).click();
      await expect(lines.getByRole('button', { name: 'Say it' })).toBeVisible();
      await lines.getByLabel('What draws you to tea').fill('The quiet of the first pour, before anyone speaks.');
      await noHorizontalOverflow(page);
      if (label !== 'narrow') await shot(page, `answer-drawn-${label}`, 'practice-drawn-answer');
      await lines.getByRole('button', { name: 'Save' }).click();
      await expect(lines.getByTestId('practice-drawn')).toContainText('The quiet of the first pour');

      // What I do: each tap is the answer.
      await lines.getByRole('button', { name: 'Tap what you do with tea' }).click();
      await lines.getByRole('button', { name: 'I pour for others' }).click();
      await expect(lines.getByRole('button', { name: 'I pour for others' })).toHaveAttribute('aria-pressed', 'true');
      await lines.getByRole('button', { name: 'I host a table' }).click();
      await expect(lines.getByRole('button', { name: 'I host a table' })).toHaveAttribute('aria-pressed', 'true');
      expect(state.lines.doings).toEqual(['pours', 'hosts']);
      await noHorizontalOverflow(page);
      if (label !== 'narrow') await shot(page, `answer-doings-${label}`, 'practice-doings-answer');
      await lines.getByRole('button', { name: 'Done' }).click();
      await expect(lines.getByTestId('practice-doings')).toContainText('I pour for others. I host a table.');
      await expect(lines).not.toContainText('Only you see');
      await lines.scrollIntoViewIfNeeded();
      if (label !== 'narrow') await shot(page, `own-page-answered-${label}`);
    });
  }

  test('back closes a line that was opened to answer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, { owner: true, lines: answeredLines });
    await page.goto('/people/mei');
    const lines = page.getByTestId('practice-lines');
    await lines.getByRole('button', { name: 'Change: With tea since' }).click();
    await expect(lines.getByLabel('The year you came to tea')).toHaveValue('2009');
    await page.goBack();
    await expect(page).not.toHaveURL(/practice=/);
    await expect(lines.getByLabel('The year you came to tea')).toHaveCount(0);
    await expect(lines.getByTestId('practice-since')).toContainText('2009');
  });

  test('the owner answers on their profile in Your Table too', async ({ page }) => {
    for (const [label, width, height] of [['phone', 390, 844], ['desktop', 1280, 900]] as const) {
      await page.setViewportSize({ width, height });
      if (label === 'phone') await prepare(page, { owner: true, lines: { since: 2009, drawn: null, doings: [] } });
      await page.goto('/account/profile');
      const lines = page.getByTestId('practice-lines');
      await expect(lines.getByRole('heading', { name: 'On your page' })).toBeVisible();
      await expect(lines.getByTestId('practice-since')).toContainText('2009');
      await expect(lines.getByRole('button', { name: 'Say what draws you to tea' })).toBeVisible();
      await noHorizontalOverflow(page);
      await lines.scrollIntoViewIfNeeded();
      await shot(page, `your-table-profile-${label}`);
    }
  });
});
