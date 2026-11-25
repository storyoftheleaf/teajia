import { expect, tapFloor, test, type Page } from './fixtures';

const event = {
  id: 'session-1',
  slug: 'spring-tea-session',
  title: 'Spring Tea Session',
  event_date: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'active',
  total_capacity: 8,
  seats_remaining: 0,
  confirmed_count: 8,
};
const calendarAPI = /\/api\/events$/;
const eventPath = `/event/${event.slug}?source=invitation`;
const seatToken = 'fixture-confirmed-seat';
const confirmation = 'If your details match an RSVP, check the email address on file for its private link.';

async function stubApp(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/events/${event.slug}/public` || path === `/api/events/${event.slug}/availability`) {
      return route.fulfill({ json: event });
    }
    if (path === `/api/rsvp/${seatToken}`) {
      return route.fulfill({ json: {
        event,
        attendee: { id: 'attendee-1', full_name: 'Fixture Guest', status: 'confirmed' },
      } });
    }
    return route.fulfill({ json: [] });
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test('the calendar shows loading, failure and recovered sessions as distinct states', async ({ page }, testInfo) => {
  await stubApp(page);
  let reads = 0;
  let releaseFailure!: () => void;
  const showFailure = new Promise<void>(resolve => { releaseFailure = resolve; });
  await page.route(calendarAPI, async route => {
    if (++reads === 1) {
      await showFailure;
      await route.fulfill({ status: 500, json: { error: 'Fixture unavailable', retryable: false } });
    } else {
      await route.fulfill({ json: [event] });
    }
  });
  await page.goto('/events');
  await expect(page.getByText('Loading sessions', { exact: true })).toBeAttached();
  await expect(page.getByText('No upcoming sessions')).toHaveCount(0);

  releaseFailure();
  await expect(page.getByRole('alert')).toHaveText('Could not load sessions.');
  const retry = page.getByRole('button', { name: 'Try again' });
  expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(tapFloor());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('failed-calendar.png') });
  await expect(page.getByText('No upcoming sessions')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Enter its code' })).toHaveAttribute('href', '/join');

  await retry.click();
  const session = page.getByRole('button', { name: /Spring Tea Session/ });
  await expect(session).toContainText('Full');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(reads).toBe(2);
  await session.click();
  await expect(page).toHaveURL(`/event/${event.slug}`);
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find my RSVP' })).toBeVisible();
});

test('a genuinely empty calendar keeps both tab empty states', async ({ page }) => {
  await stubApp(page);
  await page.route(calendarAPI, route => route.fulfill({ json: [] }));
  await page.goto('/events');
  await expect(page.getByText('No upcoming sessions')).toBeVisible();
  await page.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(page.getByText('No past sessions yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('a full session invite supports private guest RSVP recovery and the confirmed seat', async ({ page }, testInfo) => {
  await stubApp(page);
  const inputs: unknown[] = [];
  await page.route(`**/api/events/${event.slug}/find-rsvp`, route => {
    expect(route.request().headers().authorization).toBeUndefined();
    inputs.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, message: 'Generic server response' } });
  });
  await page.goto(eventPath);
  await page.getByRole('button', { name: 'Find my RSVP' }).click();
  const recovery = page.getByRole('dialog', { name: 'Find my RSVP' });
  const find = recovery.getByRole('button', { name: 'Find my RSVP' });
  await recovery.getByLabel('Phone number').fill('+621234567890');
  await find.click();
  await expect(recovery.getByRole('status')).toHaveText(confirmation);
  await expect(page).toHaveURL(eventPath);

  await recovery.getByRole('button', { name: 'Email', exact: true }).click();
  await expect(recovery.getByRole('status')).toHaveCount(0);
  await recovery.getByLabel('Email address').fill('fixture@example.com');
  await find.click();
  await expect(recovery.getByRole('status')).toHaveText(confirmation);
  await expect(page).toHaveURL(eventPath);
  expect(inputs).toEqual([{ phone_number: '+621234567890' }, { email: 'fixture@example.com' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('guest-rsvp-recovery.png') });

  // The guest opens the private link delivered independently of the lookup response.
  await page.goto(`/m/${seatToken}`);
  await expect(page.getByText('Your seat is confirmed')).toBeVisible();
  await expect(page.getByText('Fixture Guest', { exact: true })).toBeVisible();
});

test('a verified account lookup opens the seat only when it returns a token', async ({ page }) => {
  await stubApp(page);
  const claims = {
    sub: 'fixture-guest', name: 'Fixture Guest', email: 'fixture@example.com', role: 'user',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  };
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fake`;
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), token);
  await page.route('**/api/auth/me', route => route.fulfill({ json: claims }));
  let attempts = 0;
  await page.route(`**/api/events/${event.slug}/find-rsvp`, route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return ++attempts < 3
      ? route.fulfill({ json: { ok: true } })
      : route.fulfill({ json: { magic_token: seatToken, status: 'confirmed' } });
  });

  const initialLookup = page.waitForResponse(`**/api/events/${event.slug}/find-rsvp`);
  await page.goto(eventPath);
  await initialLookup;
  await page.getByRole('button', { name: 'Find my RSVP' }).click();
  const recovery = page.getByRole('dialog', { name: 'Find my RSVP' });
  await expect(recovery.getByText('Looking up RSVP for')).toBeVisible();
  const find = recovery.getByRole('button', { name: 'Find my RSVP' });
  await find.click();
  await expect(recovery.getByRole('alert')).toHaveText('Something went wrong. Please try again.');
  await expect(page).toHaveURL(eventPath);

  await find.click();
  await expect(page).toHaveURL(`/m/${seatToken}`);
  await expect(page.getByText('Your seat is confirmed')).toBeVisible();
});

test('a guest seat invitation can still be claimed through its private link', async ({ page }) => {
  await stubApp(page);
  await page.route('**/api/guest-invite/fixture-invite', route => route.fulfill({ json: {
    status: 'pending',
    parentAttendeeName: 'Fixture Host',
    event: { title: event.title, eventDate: event.event_date },
  } }));
  await page.route('**/api/guest-invite/fixture-invite/claim', route => {
    expect(route.request().postDataJSON()).toEqual({ name: 'Fixture Guest', email: 'fixture@example.com' });
    return route.fulfill({ status: 201, json: { magic_token: seatToken, redirect_url: `/m/${seatToken}` } });
  });
  await page.goto('/invite/fixture-invite');
  await expect(page.getByText('Fixture Host invited you')).toBeVisible();
  await page.getByLabel('Your name').fill('Fixture Guest');
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await page.getByPlaceholder('your@email.com').fill('fixture@example.com');
  await page.getByRole('button', { name: 'Claim Your Seat' }).click();
  await expect(page).toHaveURL(`/m/${seatToken}`);
  await expect(page.getByText('Your seat is confirmed')).toBeVisible();
});
