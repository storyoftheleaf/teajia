import { test, expect } from '@playwright/test';

const jwt = [
  btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  btoa(JSON.stringify({
    sub: 'member-1', email: 'member@example.com', name: 'Member', role: 'customer',
    active_account_id: 'account-1',
    memberships: [{ account_id: 'account-1', account_name: 'Tea House', role: 'member' }],
  })),
  'signature',
].join('.');

test('email code is the default non-Google sign-in path', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/verify/request', async route => {
    requests.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
  });
  await page.route('**/api/verify/confirm', async route => {
    expect(JSON.parse(route.request().postData() || '{}')).toEqual({
      contact: 'member@example.com', code: '123456', purpose: 'signin',
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: jwt }) });
  });

  await page.goto('/signin?returnTo=/read');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use password instead' })).toBeVisible();
  await page.getByRole('button', { name: 'Use password instead' }).click();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await page.getByRole('button', { name: 'Use email code instead' }).click();
  await page.getByLabel('Email address').fill('member@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();

  expect(requests).toEqual([{ contact: 'member@example.com', method: 'email', purpose: 'signin' }]);
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/read');
  expect(await page.evaluate(() => localStorage.getItem('teajia_token'))).toBe(jwt);
  expect(await page.evaluate(async () => {
    const { useAppStore } = await import('/src/lib/store.ts');
    const state = useAppStore.getState();
    return { authUser: state.authUser, memberships: state.memberships, activeAccountId: state.activeAccountId };
  })).toMatchObject({
    authUser: { email: 'member@example.com', name: 'Member', role: 'customer' },
    memberships: [{ account_id: 'account-1', account_name: 'Tea House', role: 'member' }],
    activeAccountId: 'account-1',
  });
});

test('delivery failure keeps email editable and exposes retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/verify/request', async route => {
    attempts += 1;
    await route.fulfill({
      status: attempts === 1 ? 503 : 202,
      contentType: 'application/json',
      body: JSON.stringify(attempts === 1
        ? { error: 'We could not send the code.', retryable: true }
        : { accepted: true }),
    });
  });

  await page.goto('/signin');
  await page.getByLabel('Email address').fill('member@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('alert')).toHaveText('We could not send the code.');
  await expect(page.getByLabel('Email address')).toBeEditable();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  expect(attempts).toBe(2);
});

test('permanent delivery failure hides retry and confirmation failure keeps the code editable', async ({ page }) => {
  let requestAttempts = 0;
  await page.route('**/api/verify/request', async route => {
    requestAttempts += 1;
    await route.fulfill({
      status: requestAttempts === 1 ? 400 : 202,
      contentType: 'application/json',
      body: JSON.stringify(requestAttempts === 1
        ? { error: 'This email cannot receive a code.', retryable: false }
        : { accepted: true }),
    });
  });
  await page.route('**/api/verify/confirm', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Invalid or expired verification code' }),
  }));

  await page.goto('/signin');
  await page.getByLabel('Email address').fill('member@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('alert')).toHaveText('This email cannot receive a code.');
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid or expired verification code');
  await expect(page.getByLabel('Verification code')).toBeEditable();
  await expect(page.getByLabel('Verification code')).toHaveValue('123456');
});

test('event verification defaults to email and sends the event purpose', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  let confirmBody: Record<string, unknown> | undefined;
  let journeyUrl = '';
  await page.route('**/api/verify/request', async route => {
    requestBody = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
  });
  await page.route('**/api/verify/confirm', async route => {
    confirmBody = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ customer: { email: 'guest@example.com' }, attendances: [{ magic_token: 'event-token' }] }),
    });
  });
  await page.route('**/api/journey/**', async route => {
    journeyUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        customer: { id: 'customer-1', name: 'Guest' },
        sessions_attended: 1,
        total_teas: 2,
        tea_type_map: {},
        favorites: [], impressions: [], milestones: [], seals: [],
      }),
    });
  });

  await page.goto('/journey');
  await expect(page.getByLabel('Delivery method: Email')).toBeVisible();
  await page.getByLabel('Email address').fill('guest@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();

  expect(requestBody).toEqual({ contact: 'guest@example.com', method: 'email', purpose: 'event' });
  await expect(page.getByText('Code sent to guest@example.com.')).toBeVisible();
  for (let digit = 1; digit <= 6; digit += 1) {
    await page.getByLabel(`Code digit ${digit}`).fill(String(digit));
  }
  await expect.poll(() => confirmBody).toEqual({ contact: 'guest@example.com', code: '123456', purpose: 'event' });
  await expect(page.getByRole('heading', { name: '1 gathering' })).toBeVisible();
  expect(new URL(journeyUrl).searchParams.get('token')).toBe('event-token');
});
