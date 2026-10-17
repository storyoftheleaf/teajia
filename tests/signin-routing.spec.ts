import { test, expect } from './fixtures';
import { primaryNav } from './helpers/navigation';

const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'signin-routing', email: 'reader@example.com', name: 'Routing Reader', role: 'user',
    memberships: [], active_account_id: null, exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  })).toString('base64url'), 'signature',
].join('.');

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } }));
  for (const path of ['auth/login', 'verify/confirm', 'auth/signup/verify']) {
    await page.route(`**/api/${path}`, route => route.fulfill({ json: { token } }));
  }
  await page.route('**/api/verify/request', route => route.fulfill({ status: 202, json: { accepted: true } }));
});

test('account-panel sign-in opens the canonical form', async ({ page }) => {
  await page.goto('/account');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL('/signin?returnTo=%2Faccount');
  await expect(page.getByLabel('Email or Username')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await page.screenshot({ path: `test-results/canonical-signin-${test.info().project.name.replaceAll(' ', '-')}.png` });
});

for (const method of ['password', 'email code'] as const) {
  test(`${method} sign-in defaults to Your Table instead of browser history`, async ({ page }) => {
    await page.goto('/signin');
    if (method === 'password') {
      await page.getByLabel('Email or Username').fill('reader@example.com');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    } else {
      await page.getByRole('button', { name: 'Use email code instead' }).click();
      await page.getByLabel('Email address', { exact: true }).fill('reader@example.com');
      await page.getByRole('button', { name: 'Email me a code' }).click();
      await page.getByLabel('Verification code').fill('123456');
    }
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL('/account');
    await expect(page.getByText('Routing Reader', { exact: true }).and(page.locator('div'))).toBeVisible();
  });
}

test('all methods and signup links retain the same deep-link destination', async ({ page }) => {
  const destination = '/read?view=books#tea';
  await page.goto(`/signin?returnTo=${encodeURIComponent(destination)}`);
  const googleHref = await page.getByRole('link', { name: 'Continue with Google' }).getAttribute('href');
  const googleReturn = new URL(googleHref!, 'http://localhost:7777').searchParams.get('return');
  expect(new URL(googleReturn!, 'http://localhost:7777').pathname).toBe('/signin');
  expect(new URL(googleReturn!, 'http://localhost:7777').searchParams.get('returnTo')).toBe(destination);
  await page.getByRole('button', { name: /Create an account/i }).click();
  await expect(page).toHaveURL(`/signup?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole('button', { name: /Already have an account/i }).click();
  await expect(page).toHaveURL(`/signin?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email or Username').fill('reader@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(destination);
});

test('Google callback to the canonical form completes the same destination without a covering account panel', async ({ page }) => {
  await page.goto(`/signin?returnTo=${encodeURIComponent('/read?view=books#tea')}#oauth_token=${token}`);
  await expect(page).toHaveURL('/read?view=books#tea');
  await expect(page.getByText('Logged in to your account', { exact: true })).toHaveCount(0);
});

test('signup verification defaults to Your Table when opened directly', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teajia_pending_signup', JSON.stringify({
    email: 'reader@example.com', signupToken: 'pending-proof',
    expiresAt: Date.now() + 600000, recoverableUntil: Date.now() + 86400000,
  })));
  await page.goto('/signup');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page).toHaveURL('/account');
});

for (const destination of ['/admin/orders?status=paid#invoice', '/admin/oauth-consent/request-42?scope=stock']) {
  test(`admin entry preserves its destination through shared sign-in: ${destination}`, async ({ page }) => {
    const entry = destination.includes('oauth-consent') ? `/admin?next=${encodeURIComponent(destination)}` : destination;
    await page.goto(entry);
    await expect(page).toHaveURL(`/signin?returnTo=${encodeURIComponent(destination)}`);
    await page.getByLabel('Email or Username').fill('reader@example.com');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(destination);
  });
}

test('Google cancellation stays on the shared sign-in form with the destination intact', async ({ page }) => {
  const destination = '/account/orders';
  await page.goto(`/signin?returnTo=${encodeURIComponent(destination)}&oauth_error=access_denied`);
  await expect(page).toHaveURL(`/signin?returnTo=${encodeURIComponent(destination)}`);
  await expect(page.getByLabel('Email or Username')).toBeVisible();
  await expect(page.getByText('Google sign-in was cancelled.', { exact: true })).toBeVisible();
  await expect(page.getByText('Gather', { exact: true })).toHaveCount(0);
});

test('account sign-in preserves its original page and reopens Your Table after the shared flow', async ({ page }) => {
  await page.goto('/read?view=books#tea');
  await primaryNav(page).getByRole('button', { name: 'Your Table', exact: true }).click();
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(`/signin?returnTo=${encodeURIComponent('/read?view=books&account=1#tea')}`);
  await page.getByLabel('Email or Username').fill('reader@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByText('Routing Reader', { exact: true }).and(page.locator('div'))).toBeVisible();
  await expect(page).toHaveURL('/read?view=books#tea');
});
