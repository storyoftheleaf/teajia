import { expect, test } from './fixtures';

test('event sign-in uses the shared page and returns to the unfinished RSVP', async ({ page }) => {
  let submissions = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/events/tea-evening/public') return route.fulfill({ json: {
      id: 'event-signin', slug: 'tea-evening', title: 'Tea Evening',
      event_date: '2027-01-10T10:00:00Z', status: 'active', seats_remaining: 8,
      confirmed_count: 0, requires_approval: 0,
    } });
    if (path.endsWith('/rsvp') && route.request().method() === 'POST') {
      submissions++;
      return route.fulfill({ json: { magicToken: 'test-rsvp' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/event/tea-evening?source=invitation');
  await page.getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  await page.getByLabel('Your name').fill('Guest draft');
  await page.getByLabel('Anything we should know?', { exact: false }).fill('Bringing a friend');
  await page.getByRole('button', { name: 'Already a member? Sign in to pre-fill' }).click();
  await expect(page).toHaveURL(/\/signin\?/);
  const returnTo = new URL(page.url()).searchParams.get('returnTo');
  expect(returnTo).toBe('/event/tea-evening?source=invitation&rsvp=1');
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'event-reader', name: 'Signed-in Reader', email: 'reader@example.com', role: 'user', memberships: [], exp: Math.floor(Date.now() / 1000) + 86400 * 30 })).toString('base64url'),
    'signature',
  ].join('.');
  await page.route('**/api/auth/login', route => route.fulfill({ json: { token } }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { name: 'Signed-in Reader', email: 'reader@example.com', role: 'user' } }));
  await page.getByLabel('Email or Username').fill('reader@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByRole('dialog', { name: 'Reserve your seat' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue('Guest draft');
  await expect(page.getByLabel('Anything we should know?', { exact: false })).toHaveValue('Bringing a friend');
  expect(submissions).toBe(0);
  await expect(page.getByText('Signed in as', { exact: false })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  await expect.poll(() => submissions).toBe(1);
});
