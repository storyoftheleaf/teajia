// Launch 3, J8: "this is a tasting". The host's choice in the session editor,
// the one button on a confirmed guest's page on the day, and the paper-notes
// line after a tasting. Every API answer is mocked.
import { expect, test, type Page } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const fixtureToken = (claims: Record<string, unknown>) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  exp: Math.floor(Date.now() / 1000) + 3600, ...claims,
})}.fixture`;
const memberships = [{ account_id: 'shop-1', account_name: 'Fixture shop', role: 'owner', bundles: ['gather', 'publish'] }];
const adminToken = fixtureToken({
  sub: 'host-1', email: 'host@test.invalid', role: 'owner', platform_role: 'platform_owner', active_account_id: 'shop-1', memberships,
});
const guestToken = fixtureToken({ sub: 'guest-1', email: 'guest@test.invalid', name: 'Guest' });

const adminEvent = {
  id: 'event-1', slug: 'tasting-test', title: 'A tasting, a test sit',
  event_date: '2026-12-01T10:00:00.000Z', event_end_date: '2026-12-01T12:00:00.000Z',
  status: 'active', lifecycle_status: 'published', total_capacity: 8,
  claim_window_minutes: 30, timezone: 'Asia/Taipei', reading_article_id: null, is_tasting: 0,
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
};

async function installAdminApi(page: Page) {
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(token => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'shop-1', activeUserId: 'host-1',
      memberships: [{ account_id: 'shop-1', account_name: 'Fixture shop', role: 'owner', bundles: ['gather', 'publish'] }],
    } }));
  }, adminToken);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/admin/events/event-1' && request.method() === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      if (body.is_tasting !== undefined) adminEvent.is_tasting = body.is_tasting ? 1 : 0;
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/admin/events/event-1') return route.fulfill({ json: { ...adminEvent } });
    if (path === '/api/admin/events') return route.fulfill({ json: [{ ...adminEvent }] });
    if (path.endsWith('/interest')) return route.fulfill({ json: { signups: [] } });
    if (path === '/api/compass/incoming') return route.fulfill({ json: { shares: [] } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test('the session editor saves "this is a tasting", and it survives a reload', async ({ page }) => {
  adminEvent.is_tasting = 0;
  const writes = await installAdminApi(page);
  await page.goto('/admin/events/event-1');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  const choice = page.getByLabel('This is a tasting. Guests can write about each tea as it is poured.');
  await expect(choice).not.toBeChecked();
  await choice.check();
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect.poll(() => writes.at(-1)?.is_tasting).toBe(true);
  expect(writes.at(-1)?.event_format).toBe('private_tasting');

  await page.reload();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('This is a tasting. Guests can write about each tea as it is poured.')).toBeChecked();
  await page.getByLabel('This is a tasting. Guests can write about each tea as it is poured.').uncheck();
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect.poll(() => writes.at(-1)?.is_tasting).toBe(false);
});

/** Today's date in Taipei, as a session there would be written. */
function taipeiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function openSeat(page: Page, seat: { status: string; isTasting: boolean; signedIn: boolean; day?: string }) {
  const opened: string[] = [];
  if (seat.signedIn) await page.addInitScript(token => localStorage.setItem('teajia_token', token), guestToken);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/rsvp/seat-token' && request.method() === 'GET') return route.fulfill({ json: {
      attendee: { id: 'a-1', full_name: 'Guest', status: seat.status, magic_token: 'seat-token', first_visit_briefed: 1 },
      event: {
        id: 'event-1', slug: 'sit-test', title: 'An evening sit', event_date: `${seat.day ?? taipeiToday()}T18:00`,
        timezone: 'Asia/Taipei', status: 'active', lifecycle_status: 'published',
        is_tasting: seat.isTasting, tasting_session_id: null,
      },
      tea_menu: [], guest_invites: [],
    } });
    if (path === '/api/rsvp/seat-token/tasting' && request.method() === 'POST') {
      opened.push(request.headers().authorization ?? '');
      return route.fulfill({ json: { session_id: 'sess-1' } });
    }
    if (path === '/api/sessions/sess-1') return route.fulfill({ json: {
      session: { id: 'sess-1', title: 'A tasting, a test sit', status: 'active', created_by_user_id: 'host-1', account_id: 'shop-1' },
      teas: [{ id: 't-1', product_id: 'white', tea_name: 'Old tree white', position: 0, tea_metadata: { name: 'Old tree white' } }],
      members: [], my_verdicts: [],
    } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/m/seat-token');
  await expect(page.getByText('Your seat is confirmed')).toBeVisible();
  return opened;
}

test('on the day of a tasting, a confirmed guest gets one button into the tasting', async ({ page }) => {
  const opened = await openSeat(page, { status: 'confirmed', isTasting: true, signedIn: true });
  await page.getByRole('button', { name: 'Open the tasting' }).click();
  await expect(page).toHaveURL(/\/session\/sess-1$/);
  await expect(page.getByText('Old tree white')).toBeVisible();
  expect(opened).toEqual([`Bearer ${guestToken}`]);
});

test('a guest who is not signed in is carried through sign-in and back', async ({ page }) => {
  await openSeat(page, { status: 'confirmed', isTasting: true, signedIn: false });
  await page.getByRole('button', { name: 'Open the tasting' }).click();
  await expect(page).toHaveURL(/\/signin\?returnTo=/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/m/seat-token?open=tasting');
});

test('nothing about tasting shows when the session is not a tasting, or not on the day', async ({ page }) => {
  await openSeat(page, { status: 'confirmed', isTasting: false, signedIn: true });
  await expect(page.getByRole('button', { name: 'Open the tasting' })).toHaveCount(0);
  await expect(page.getByText(/tasting/i)).toHaveCount(0);
});

test('a tasting on another day shows no button yet', async ({ page }) => {
  await openSeat(page, { status: 'confirmed', isTasting: true, signedIn: true, day: '2099-01-01' });
  await expect(page.getByRole('button', { name: 'Open the tasting' })).toHaveCount(0);
});

const credential = '8'.repeat(64);

async function openRecap(page: Page, extra: Record<string, unknown>) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/after-sit/recap') return route.fulfill({ json: {
      event: { id: 'event-1', title: 'A tasting, a test sit', event_date: '2026-11-26' },
      host_note: null,
      teas: [{ id: 'm-white', name: 'Old tree white', path: null }, { id: 'm-plain', name: 'A guest tin', path: null }],
      playlist_url: null, reading: null, ...extra,
    } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/after-sit#${credential}`);
  await expect(page.getByRole('heading', { level: 1, name: 'A tasting, a test sit' })).toBeVisible();
}

test('after a tasting, one line leads to the journal with the tea filled in', async ({ page }) => {
  await openRecap(page, { is_tasting: true, journal_teas: [{ id: 'm-white', name: 'Old tree white', product_id: 'white' }] });
  await expect(page.getByRole('link', { name: 'Wrote on paper? Add your notes' })).toHaveAttribute('href', '/account/journal?tea=white');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('after any other session, there is no paper line', async ({ page }) => {
  await openRecap(page, { is_tasting: false });
  await expect(page.getByText('Wrote on paper?')).toHaveCount(0);
});
