/**
 * Launch 2, slice H8: the way to the house, at phone size, with mocked routes
 * (todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
 *
 * The host walks the way once: three steps, each photograph through the shared
 * photo editor, reordered, saved, and a saved place's way copied in. A
 * confirmed guest then steps through it, the page still shows all three steps
 * and photographs when the signal is gone, and after the session's end what
 * was kept is gone.
 *
 * "No signal" here: every API and media request fails, and the application's
 * own files come from what the first open loaded, as a phone's browser keeps
 * them. The steps and photographs must come from what the page itself kept.
 *
 * The host's page exists only while Launch 2 is open, so this spec needs a
 * site started with VITE_FEW_HOSTS_OPEN=true and is skipped otherwise.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

test.skip(process.env.VITE_FEW_HOSTS_OPEN !== 'true', 'Needs a site started with VITE_FEW_HOSTS_OPEN=true');
test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');
const picture = readFileSync(path.join(process.cwd(), 'public', 'icon-192.png'));
const photo = (name: string) => `https://media.teajia.co/accounts/ana-personal/venue-guide/${name}.png`;

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// ── The host ──

type Way = { address: string | null; map_link: string | null; venue_guide: any; place_id: string | null };

function hostState() {
  return {
    detail: {
      table: {
        id: 't-ana', slug: 'ana-next', title: 'Ana’s next table', event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        timezone: 'Asia/Makassar', door: 'request', seats: 4, seats_taken: 1, lifecycle_status: 'published',
        requires_approval: 1, public_visibility: 'unlisted', link: 'https://teajia.test/event/ana-next',
      },
      guests: [], teas: [], doors: ['request', 'link'],
    },
    way: { address: null, map_link: null, venue_guide: null, place_id: null } as Way,
    places: [] as Array<{ id: string; name: string; address: string | null; map_link: string | null; venue_guide: any }>,
    saved: [] as any[],
    kept: [] as string[],
    uploads: 0,
  };
}

async function openWay(page: Page, state: ReturnType<typeof hostState>) {
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === '/api/me/tables/t-ana' && method === 'GET') return route.fulfill({ json: state.detail });
    if (pathname === '/api/me/hosting') return route.fulfill({ json: { approved: true, account_id: 'ana-personal', doors: ['request', 'link'] } });
    if (pathname === '/api/me/tables/t-ana/way' && method === 'GET') return route.fulfill({ json: { way: state.way, places: state.places } });
    if (pathname === '/api/me/tables/t-ana/way' && method === 'PUT') {
      const body = request.postDataJSON();
      state.saved.push(body);
      state.way = { ...body, place_id: state.way.place_id };
      return route.fulfill({ json: { way: state.way, places: state.places } });
    }
    if (pathname === '/api/me/tables/t-ana/way/photos' && method === 'POST') {
      state.uploads += 1;
      expect(request.headers()['content-type']).toContain('multipart/form-data');
      return route.fulfill({ status: 201, json: { url: photo(`up-${state.uploads}`), key: `accounts/ana-personal/venue-guide/up-${state.uploads}.png` } });
    }
    if (pathname === '/api/me/tables/t-ana/way/keep' && method === 'POST') {
      const { name } = request.postDataJSON();
      state.kept.push(name);
      const place = { id: 'p-new', name, address: state.way.address, map_link: state.way.map_link, venue_guide: state.way.venue_guide };
      state.places = [place];
      state.way.place_id = 'p-new';
      return route.fulfill({ json: { place } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host/t-ana?part=way');
  await expect(page.getByRole('heading', { name: 'The way in', level: 2 })).toBeVisible();
}

async function addStep(page: Page, n: number, line: string) {
  await page.getByRole('button', { name: 'Add a step' }).click();
  await page.getByLabel(`Step ${n}`, { exact: true }).fill(line);
  // The photograph is picked, then opens in the shared photo editor; only the framed photograph is uploaded.
  await page.getByTestId(`way-step-photo-picker-${n}`).setInputFiles({ name: `step-${n}.png`, mimeType: 'image/png', buffer: picture });
  const editor = page.getByRole('dialog', { name: `Photograph for step ${n}` });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Use photograph' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(`[data-way-step="${n}"] img`)).toHaveAttribute('src', new RegExp(`up-${n}\\.png$`));
}

test('a host adds three steps with photographs through the editor, reorders them and keeps the way', async ({ page }) => {
  const state = hostState();
  await openWay(page, state);
  await expect(page.getByText('Guests see this only after your yes, and only until the session ends. A guest can still take a screenshot.')).toBeVisible();
  await expect(page.getByText('Shown only to guests you have said yes to')).toBeVisible();
  // No photograph is uploaded without the editor: the page has no visible file input.
  await expect(page.locator('input[type=file]:visible')).toHaveCount(0);

  await addStep(page, 1, 'The blue gate after the warung.');
  await addStep(page, 2, 'Shoes off at the step.');
  await addStep(page, 3, 'Through the garden, left at the frangipani.');
  expect(state.uploads).toBe(3);

  await page.getByRole('button', { name: 'Move step 3 up' }).click();
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Through the garden, left at the frangipani.');
  await expect(page.locator('[data-way-step="2"] img')).toHaveAttribute('src', /up-3\.png$/);

  await page.getByLabel('Where to park').fill('Scooters by the wall.');
  await page.getByLabel('What to bring or wear').fill('Something warm for the evening.');
  await page.getByLabel('A number to call if lost').fill('+62 812 0000 0009');
  await page.getByLabel('Address').fill('Jalan Raya Ubud 12');
  await page.getByLabel('Map link').fill('https://maps.example.test/?q=ubud');
  await noSideScroll(page);

  await page.getByRole('button', { name: 'Save the way in' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  const saved = state.saved.at(-1);
  expect(saved.venue_guide.steps.map((step: any) => step.description)).toEqual([
    'The blue gate after the warung.', 'Through the garden, left at the frangipani.', 'Shoes off at the step.',
  ]);
  expect(saved.venue_guide.steps.map((step: any) => step.image_url)).toEqual([photo('up-1'), photo('up-3'), photo('up-2')]);
  expect(saved).toMatchObject({
    address: 'Jalan Raya Ubud 12', map_link: 'https://maps.example.test/?q=ubud',
    venue_guide: { parking_notes: 'Scooters by the wall.', arrival_notes: 'Something warm for the evening.', lost_phone: '+62 812 0000 0009' },
  });

  await page.getByLabel('Place name').fill('Ubud house');
  await page.getByRole('button', { name: 'Keep this for next time' }).click();
  await expect(page.getByText('Kept as Ubud house for next time.')).toBeVisible();
  expect(state.kept).toEqual(['Ubud house']);
  await expect(page.getByRole('button', { name: 'Use the way to Ubud house' })).toBeVisible();
});

test('a saved place’s way is copied in and saved for this table', async ({ page }) => {
  const state = hostState();
  state.places = [
    { id: 'p-empty', name: 'Studio', address: 'Somewhere', map_link: null, venue_guide: null },
    {
      id: 'p-ubud', name: 'Ubud house', address: 'Jalan Raya Ubud 12', map_link: 'https://maps.example.test/?q=ubud',
      venue_guide: { steps: [{ description: 'Blue gate.', image_url: photo('kept-1') }, { description: 'Garden path.', image_url: photo('kept-2') }], parking_notes: 'By the wall.' },
    },
  ];
  await openWay(page, state);
  // Only a place with a way to copy is offered.
  await expect(page.getByRole('button', { name: 'Use the way to Studio' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Use the way to Ubud house' }).click();
  await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Blue gate.');
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Garden path.');
  await expect(page.getByLabel('Where to park')).toHaveValue('By the wall.');
  await expect(page.getByLabel('Address')).toHaveValue('Jalan Raya Ubud 12');
  await expect(page.getByLabel('Place name')).toHaveValue('Ubud house');
  await page.getByRole('button', { name: 'Save the way in' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  expect(state.saved.at(-1).venue_guide.steps).toEqual(state.places[1].venue_guide.steps);
  await noSideScroll(page);
});

// ── The guest ──

const hour = 3600_000;

function guestAnswer(startsInMs: number) {
  return {
    attendee: {
      id: 'g-rui', full_name: 'Rui Comes', status: 'confirmed', magic_token: 'tok-rui', plus_one: 0, photo_consent: 1,
      first_visit_briefed: 1, created_at: '2026-11-25T00:00:00Z',
    },
    event: {
      id: 't-ana', slug: 'ana-next', title: 'Ana’s next table', event_date: new Date(Date.now() + startsInMs).toISOString(),
      event_end_date: null, timezone: 'Asia/Makassar', status: 'active', lifecycle_status: 'published',
      location_name: 'Ubud', address_text: 'Jalan Raya Ubud 12', map_link: 'https://maps.example.test/?q=ubud',
      venue_guide: JSON.stringify({
        steps: [
          { description: 'The blue gate after the warung.', image_url: photo('s1') },
          { description: 'Through the garden, left at the frangipani.', image_url: photo('s2') },
          { description: 'Shoes off at the step.', image_url: photo('s3') },
        ],
        parking_notes: 'Scooters by the wall.',
        lost_phone: '+62 812 0000 0009',
      }),
      venue_photos: [],
    },
    tea_menu: [],
    guest_invites: [],
  };
}

/**
 * Answers the guest page. While `signal.on`, the application's files are
 * fetched and remembered; once it is off, they come from what was remembered
 * (as a phone's browser keeps them) and every API and media request fails.
 */
async function guestPage(context: BrowserContext, answer: () => object, signal: { on: boolean }) {
  const shell = new Map<string, { status: number; headers: Record<string, string>; body: Buffer }>();
  const media: string[] = [];
  await context.route(/\/api\/media\//, async route => {
    if (!signal.on) return route.abort('internetdisconnected');
    media.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'image/png', body: picture, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await context.route(url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/media/'), async route => {
    if (!signal.on) return route.abort('internetdisconnected');
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/rsvp/tok-rui') return route.fulfill({ json: answer() });
    return route.fulfill({ json: {} });
  });
  await context.route(url => !url.pathname.startsWith('/api/') && url.hostname === 'localhost', async (route: Route) => {
    const key = route.request().url();
    if (signal.on) {
      const response = await route.fetch();
      const body = await response.body();
      shell.set(key, { status: response.status(), headers: response.headers(), body });
      return route.fulfill({ response, body });
    }
    const kept = shell.get(key);
    return kept ? route.fulfill(kept) : route.abort('internetdisconnected');
  });
  return media;
}

async function stepThrough(page: Page) {
  const reader = page.locator('[data-way-reader]');
  const lines = ['The blue gate after the warung.', 'Through the garden, left at the frangipani.', 'Shoes off at the step.'];
  for (let i = 0; i < lines.length; i++) {
    await expect(reader.getByText(`Step ${i + 1} of 3`)).toBeVisible();
    await expect(reader.locator('[data-way-line]')).toHaveText(lines[i]);
    const img = reader.locator(`img[data-way-photo="${i + 1}"]`);
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    if (i < lines.length - 1) await reader.getByRole('button', { name: 'Next' }).click();
  }
  await expect(reader.getByRole('button', { name: 'Next' })).toBeDisabled();
  await reader.getByRole('button', { name: 'Back' }).click();
  await expect(reader.getByText('Step 2 of 3')).toBeVisible();
}

// Opening a cache creates it, so photographs are counted only in caches that
// already exist, and never while checking that everything is gone.
const keptOnPhone = (page: Page, countPhotos = true) => page.evaluate(async (count) => {
  const names = (await caches.keys()).filter(name => name.startsWith('teajia-way:'));
  let photos = 0;
  if (count) for (const name of names) photos += (await (await caches.open(name)).keys()).length;
  return { records: Object.keys(localStorage).filter(key => key.startsWith('teajia.way.')), caches: names, photos };
}, countPhotos);

test('a confirmed guest steps through the way, and it still opens without signal until the session ends', async ({ page, context }) => {
  test.setTimeout(60_000);
  const signal = { on: true };
  await guestPage(context, () => guestAnswer(2 * hour), signal);
  await page.goto('/m/tok-rui');
  await expect(page.getByRole('heading', { name: 'The way in' })).toBeVisible();
  await expect(page.locator('[data-venue-guide]').getByRole('link', { name: 'Open in maps' })).toHaveAttribute('href', 'https://maps.example.test/?q=ubud');
  await stepThrough(page);
  await expect(page.getByRole('link', { name: /If you are lost/ })).toHaveAttribute('href', 'tel:+6281200000009');
  // Next and Back are large thumb targets: the large button (36px), and the
  // finger floor (--tap-min, 44px on a touch screen) through tap-target.
  const next = await page.locator('[data-way-reader]').getByRole('button', { name: 'Next' }).boundingBox();
  const tapMin = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap-min')));
  expect(next!.height).toBeGreaterThanOrEqual(Math.max(36, tapMin));
  expect(next!.width).toBeGreaterThanOrEqual(120);
  await noSideScroll(page);
  await expect.poll(() => keptOnPhone(page)).toEqual({ records: ['teajia.way.tok-rui'], caches: ['teajia-way:tok-rui'], photos: 3 });

  // The signal ends. A reload still shows all three steps and photographs.
  signal.on = false;
  await page.reload();
  await expect(page.getByText('No signal. This is the way in, kept on this phone.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Jalan Raya Ubud 12')).toBeVisible();
  await stepThrough(page);
  const src = await page.locator('[data-way-reader] img').getAttribute('src');
  expect(src).toMatch(/^blob:/);
  await noSideScroll(page);

  // After the session's end, opening the page removes what was kept, signal or not.
  // The phone's clock moves past the session's end (it starts in 2 hours and lasts 4).
  await page.addInitScript(later => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + later;
  }, 7 * hour);
  await page.reload();
  await expect(page.getByText('No signal. This is the way in, kept on this phone.')).toHaveCount(0);
  await expect.poll(() => keptOnPhone(page, false)).toEqual({ records: [], caches: [], photos: 0 });
  await expect(page.locator('[data-way-reader]')).toHaveCount(0);
});

test('a guest whose seat is no longer confirmed loses the kept way at once', async ({ page, context }) => {
  const signal = { on: true };
  let answer = guestAnswer(2 * hour);
  await guestPage(context, () => answer, signal);
  await page.goto('/m/tok-rui');
  await expect(page.locator('[data-way-reader]')).toBeVisible();
  await expect.poll(async () => (await keptOnPhone(page)).photos).toBe(3);

  answer = { ...answer, attendee: { ...answer.attendee, status: 'cancelled' }, event: { ...answer.event, venue_guide: null as never, address_text: null as never, map_link: null as never } };
  await page.reload();
  await expect.poll(() => keptOnPhone(page, false)).toEqual({ records: [], caches: [], photos: 0 });
  signal.on = false;
  await page.reload();
  await expect(page.getByText('No signal. This is the way in, kept on this phone.')).toHaveCount(0);
});
