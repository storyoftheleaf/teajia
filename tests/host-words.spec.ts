/**
 * Launch 2, slices H10 and H5, on a phone, with mocked routes
 * (todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H10" and hard
 * question 8): a session's page says who it is hosted by and who is pouring,
 * says in one line that photographs may be taken, lets a guest say "please
 * not me", and at a by-link door seats a guest by name and hands them their
 * own link at once.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

type Session = Record<string, unknown>;

function session(overrides: Session = {}): Session {
  return {
    id: 'ev-ana', slug: 'ana-table', title: 'Saturday at Ana’s table', status: 'active',
    event_date: new Date(Date.now() + 7 * 86400000).toISOString(), timezone: 'UTC',
    location_name: 'At home', area_hint: 'Near the market',
    total_capacity: 6, confirmed_count: 1, offered_count: 0, seats_remaining: 5, confirmed_names: [],
    requires_approval: 1, door: 'request', hosts: [], host: null, pouring: [],
    ...overrides,
  };
}

async function mock(page: Page, answer: Session) {
  const sent: Array<Record<string, unknown>> = [];
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/events/${answer.slug}/public`) return route.fulfill({ json: answer });
    if (url.pathname === `/api/events/${answer.slug}/availability`) {
      return route.fulfill({ json: { total_capacity: 6, confirmed_count: 1, offered_count: 0, seats_remaining: answer.seats_remaining, is_full: answer.seats_remaining === 0 } });
    }
    if (url.pathname === `/api/events/${answer.slug}/rsvp` && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sent.push(body);
      const confirmed = answer.door === 'link';
      return route.fulfill({ status: 201, json: {
        magic_token: 'token-mei', status: confirmed ? 'confirmed' : 'requested', redirect_url: '/m/token-mei',
        ...(confirmed ? { link: 'https://teajia.test/m/token-mei' } : {}),
      } });
    }
    return route.fulfill({ json: [] });
  });
  return sent;
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('names a host with a page as a link, and one person pouring without a page in plain words', async ({ page }) => {
  await mock(page, session({
    host: { name: 'Ana Lestari', path: '/people/ana-lestari' },
    pouring: [{ name: 'Bo', path: null }],
  }));
  await page.goto('/event/ana-table');
  const host = page.getByTestId('session-host');
  await expect(host).toHaveText('Hosted by Ana Lestari');
  await expect(host.getByRole('link', { name: 'Ana Lestari' })).toHaveAttribute('href', '/people/ana-lestari');
  const pouring = page.getByTestId('session-pouring');
  await expect(pouring).toHaveText('Pouring: Bo');
  await expect(pouring.getByRole('link')).toHaveCount(0);
  await expect(page.getByText('master', { exact: false })).toHaveCount(0);
  await expect(page.getByText('curated', { exact: false })).toHaveCount(0);
  await noSideScroll(page);
});

test('names a host only, as plain words, with no pouring line and no second "Hosted by" at the foot', async ({ page }) => {
  await mock(page, session({ host: { name: 'Ana', path: null }, account_name: 'Ana' }));
  await page.goto('/event/ana-table');
  await expect(page.getByTestId('session-host')).toHaveText('Hosted by Ana');
  await expect(page.getByTestId('session-host').getByRole('link')).toHaveCount(0);
  await expect(page.getByTestId('session-pouring')).toHaveCount(0);
  await expect(page.getByText(/Hosted by/)).toHaveCount(1);
  await noSideScroll(page);
});

test('says photographs may be taken, and sends photo_consent false only when the guest ticks "Please, no photographs of me"', async ({ page }) => {
  const sent = await mock(page, session());
  await page.goto('/event/ana-table');
  await expect(page.getByTestId('photographs-line'))
    .toHaveText('Photographs are sometimes taken at the table. Tell the host if you would rather not be in them.');

  await page.getByRole('button', { name: 'Request your seat', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Request your seat' });
  const choice = sheet.getByRole('checkbox', { name: 'Please, no photographs of me' });
  await expect(choice).not.toBeChecked();
  await sheet.getByLabel('Your name').fill('Mei');
  await sheet.getByLabel('WhatsApp number').fill('811222333');
  await choice.check();
  await noSideScroll(page);
  await sheet.getByRole('button', { name: 'Request my seat', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].photo_consent).toBe(false);
  // A by-request door asks for no browser key; contact tells guests apart there.
  expect(sent[0]).not.toHaveProperty('seat_key');
});

test('leaves photo_consent out when the guest does not tick the choice', async ({ page }) => {
  const sent = await mock(page, session());
  await page.goto('/event/ana-table');
  await page.getByRole('button', { name: 'Request your seat', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Request your seat' });
  await sheet.getByLabel('Your name').fill('Tao');
  await sheet.getByLabel('WhatsApp number').fill('811222444');
  await sheet.getByRole('button', { name: 'Request my seat', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).not.toHaveProperty('photo_consent');
});

test('at a by-link door, a name is a seat, and the guest is handed their own link to keep', async ({ page }) => {
  const sent = await mock(page, session({ door: 'link', requires_approval: 0 }));
  await page.goto('/event/ana-table');
  await page.getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Reserve your seat' });
  await expect(sheet.getByText('(optional)').first()).toBeVisible();
  await sheet.getByLabel('Your name').fill('Mei');
  await sheet.getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).not.toHaveProperty('phone_number');
  expect(sent[0]).not.toHaveProperty('email');
  expect(String(sent[0].seat_key)).toMatch(/^[A-Za-z0-9_-]{22,128}$/);
  const done = sheet.getByTestId('seat-by-link-done');
  await expect(done.getByText('You have a seat.')).toBeVisible();
  await expect(done.getByText('https://teajia.test/m/token-mei')).toBeVisible();
  await expect(done.getByRole('button', { name: 'Copy my link' })).toBeVisible();
  await noSideScroll(page);
});

test('at a full by-link table, says so and offers no waiting list', async ({ page }) => {
  await mock(page, session({ door: 'link', requires_approval: 0, seats_remaining: 0, confirmed_count: 6 }));
  await page.goto('/event/ana-table');
  await expect(page.getByTestId('table-full')).toHaveText('This table is full.');
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(0);
  await noSideScroll(page);
});
