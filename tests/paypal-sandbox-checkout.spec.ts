import { test, expect, type Page } from './fixtures';

const trackingToken = 'private-paypal-sandbox-test';
const basePath = `/order/${trackingToken}?invoice=test-invoice`;

type FixtureOptions = { enabled?: boolean; outcome?: 'completed' | 'pending' | 'mismatch' | 'declined'; alreadyPaid?: boolean };
async function prepare(page: Page, { enabled = true, outcome = 'completed', alreadyPaid = false }: FixtureOptions = {}) {
  const calls: Array<{ path: string; body: unknown }> = [];
  let paid = alreadyPaid;
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname === `/api/inquiries/${trackingToken}`) return route.fulfill({ json: {
      ref_number: 'TEST-PAYPAL-001', invoice_id: 'test-invoice', invoice_number: 'TEST-001',
      order: { invoice_id: 'test-invoice', invoice_number: 'TEST-001', status: 'Pending', shipping_cost_usd: 4, shipping_destination: 'Gojek delivery · TEST ADDRESS, Ubud, Bali' },
      created_at: '2026-11-19T00:00:00Z', currency: 'USD', items_json: '[]', total_estimate_usd: 14,
      invoice_items: [{ id: 'line', name: 'Synthetic test tea', quantity: 50, quantity_unit: 'g', unit_price_usd: .28, line_total_usd: 14 }],
      payment: { total_usd: 18, paid_usd: paid ? 18 : 0, outstanding_usd: paid ? 0 : 18, has_methods: false, pay_url: null, claims_pending: 0 },
      journey: { stage: paid ? 'paid' : 'awaiting_payment', label: paid ? 'Paid in full' : 'Awaiting payment', detail: null, at: null },
    } });
    if (pathname === `/api/orders/${trackingToken}/paypal-sandbox`) {
      if (method === 'GET') return route.fulfill({ json: { enabled, outstanding_usd: paid ? 0 : 18 } });
      calls.push({ path: pathname, body: route.request().postDataJSON() });
      return route.fulfill({ json: { order_id: 'TEST-PAYPAL-ORDER', approval_url: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-PAYPAL-ORDER' } });
    }
    if (pathname === `/api/orders/${trackingToken}/paypal-sandbox/capture`) {
      calls.push({ path: pathname, body: route.request().postDataJSON() });
      if (outcome === 'declined') return route.fulfill({ status: 409, json: { error: 'PayPal declined or ended this test payment. Start a new test checkout.', code: 'sandbox_payment_failed' } });
      if (outcome === 'mismatch') return route.fulfill({ status: 409, json: { error: 'The test payment amount does not match this order.' } });
      if (outcome === 'completed') paid = true;
      return route.fulfill({ json: { state: outcome, payment_status: paid ? 'paid' : 'unpaid' } });
    }
    if (pathname.includes('/auth/')) return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return route.fulfill({ json: [] });
  });
  await page.route('https://www.sandbox.paypal.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>PayPal sandbox redirect captured by test</h1>' }));
  return calls;
}

test('offers a clearly labelled test checkout and sends the selected invoice to PayPal sandbox', async ({ page }, testInfo) => {
  const calls = await prepare(page);
  await page.goto(basePath);
  const button = page.getByRole('button', { name: 'Pay with PayPal · test', exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByText('Sandbox only. No real money is taken.', { exact: true })).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('paypal-sandbox-checkout.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await button.click();
  await expect(page).toHaveURL('https://www.sandbox.paypal.com/checkoutnow?token=TEST-PAYPAL-ORDER');
  expect(calls).toEqual([{ path: `/api/orders/${trackingToken}/paypal-sandbox`, body: { invoice_id: 'test-invoice' } }]);
});

test('automatically confirms only a server-verified completed sandbox payment and refreshes the invoice', async ({ page }, testInfo) => {
  const calls = await prepare(page);
  await page.goto(`${basePath}&paypal_sandbox_return=1&token=TEST-PAYPAL-ORDER`);
  await expect(page.getByTestId('order-journey-label').filter({ hasText: /^Paid in full$/ })).toBeVisible();
  await expect(page).toHaveURL(basePath);
  const order = page.getByRole('heading', { name: 'Order TEST-PAYPAL-001', exact: true }).locator('..').locator('..');
  await expect(order.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Paid$/ }) }).locator('dd')).toHaveText('$18');
  await expect(order.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Balance$/ }) }).locator('dd')).toHaveText('$0');
  await page.getByTestId('order-journey-label').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('paypal-sandbox-confirmed.png') });
  expect(calls).toEqual([{ path: `/api/orders/${trackingToken}/paypal-sandbox/capture`, body: { invoice_id: 'test-invoice', order_id: 'TEST-PAYPAL-ORDER' } }]);
});

test('keeps a pending sandbox capture unpaid and offers a verification retry', async ({ page }) => {
  const calls = await prepare(page, { outcome: 'pending' });
  await page.goto(`${basePath}&paypal_sandbox_order=TEST-PAYPAL-ORDER`);
  await expect(page.getByText('PayPal is still processing this test payment. Your order is not marked paid yet.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('order-journey-label').filter({ hasText: /^Paid in full$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check test payment', exact: true })).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('shows a verification mismatch without marking the order paid', async ({ page }) => {
  const calls = await prepare(page, { outcome: 'mismatch' });
  await page.goto(`${basePath}&paypal_sandbox_order=TEST-PAYPAL-ORDER`);
  await expect(page.getByRole('alert')).toHaveText('The test payment amount does not match this order.');
  await expect(page.getByTestId('order-journey-label').filter({ hasText: /^Paid in full$/ })).toHaveCount(0);
  expect(calls).toHaveLength(1);
});

test('does not offer or capture PayPal when the sandbox configuration is disabled', async ({ page }) => {
  const calls = await prepare(page, { enabled: false });
  await page.goto(`${basePath}&paypal_sandbox_order=TEST-PAYPAL-ORDER`);
  await expect(page.getByRole('heading', { name: 'Order TEST-PAYPAL-001', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay with PayPal/ })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('does not capture a cancelled PayPal sandbox approval', async ({ page }) => {
  const calls = await prepare(page);
  await page.goto(`${basePath}&paypal_sandbox_cancel=1&token=TEST-PAYPAL-ORDER`);
  await expect(page.getByText('Test checkout cancelled. No payment was confirmed.', { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});

test('refuses a live PayPal approval link from the test endpoint', async ({ page }) => {
  await prepare(page);
  await page.route(`**/api/orders/${trackingToken}/paypal-sandbox`, async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ json: { order_id: 'UNEXPECTED-LIVE', approval_url: 'https://www.paypal.com/checkoutnow?token=UNEXPECTED-LIVE' } });
  });
  await page.goto(basePath);
  await page.getByRole('button', { name: 'Pay with PayPal · test', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The test checkout did not return a PayPal sandbox link.');
  await expect(page).toHaveURL(basePath);
});


test('reconciles an interrupted sandbox return even when the invoice already has a zero balance', async ({ page }) => {
  const calls = await prepare(page, { alreadyPaid: true });
  const configRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === `/api/orders/${trackingToken}/paypal-sandbox` && request.method() === 'GET'
      && url.searchParams.get('order_id') === 'TEST-PAYPAL-ORDER';
  });
  await page.goto(`${basePath}&paypal_sandbox_return=1&token=TEST-PAYPAL-ORDER`);
  await configRequest;
  await expect(page).toHaveURL(basePath);
  await expect(page.getByTestId('order-journey-label')).toHaveText('Paid in full');
  expect(calls).toEqual([{ path: `/api/orders/${trackingToken}/paypal-sandbox/capture`, body: { invoice_id: 'test-invoice', order_id: 'TEST-PAYPAL-ORDER' } }]);
});

test('offers a new checkout after a terminal decline, without marking the order paid', async ({ page }) => {
  const calls = await prepare(page, { outcome: 'declined' });
  await page.goto(`${basePath}&paypal_sandbox_return=1&token=TEST-PAYPAL-ORDER`);
  await expect(page.getByRole('alert')).toContainText('Start a new test checkout.');
  await expect(page.getByRole('button', { name: 'Pay with PayPal · test', exact: true })).toBeVisible();
  await expect(page).toHaveURL(basePath);
  await expect(page.getByTestId('order-journey-label')).toHaveText('Awaiting payment');
  expect(calls).toHaveLength(1);
});
