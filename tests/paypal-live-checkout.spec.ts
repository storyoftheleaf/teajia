import { test, expect, type Page } from './fixtures';

const trackingToken = 'private-paypal-live-preview';
const basePath = `/order/${trackingToken}?invoice=test-invoice`;

type FixtureOptions = { enabled?: boolean; outcome?: 'completed' | 'pending' | 'mismatch' | 'declined'; alreadyPaid?: boolean };
async function prepare(page: Page, { enabled = true, outcome = 'completed', alreadyPaid = false }: FixtureOptions = {}) {
  const calls: Array<{ path: string; body: unknown }> = [];
  let paid = alreadyPaid;
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname === `/api/inquiries/${trackingToken}`) return route.fulfill({ json: {
      ref_number: 'TEST-PREVIEW-PAYPAL', invoice_id: 'test-invoice', invoice_number: 'TEST-001',
      order: { invoice_id: 'test-invoice', invoice_number: 'TEST-001', status: 'Pending', shipping_cost_usd: 0, shipping_quote_status:'requested', fulfillment_method:'us_shipping', shipping_destination:'United States · TEST ADDRESS, Austin, TX 78701', delivery_address:'123 Test St\nAustin, TX 78701\nUnited States' },
      created_at: '2026-11-19T00:00:00Z', currency: 'USD', items_json: '[]', total_estimate_usd: 14,
      invoice_items: [{ id: 'line', name: 'Synthetic test tea', quantity: 50, quantity_unit: 'g', unit_price_usd: .28, line_total_usd: 14 }],
      payment: { total_usd: 14, paid_usd: paid ? 14 : 0, outstanding_usd: paid ? 0 : 14, has_methods: false, pay_url: null, claims_pending: 0 },
      journey: { stage: paid ? 'paid' : 'awaiting_payment', label: paid ? 'Tea paid' : 'Awaiting payment', detail: 'Shipping is quoted and charged separately later.', at: null },
    } });
    if (pathname === `/api/orders/${trackingToken}/paypal`) {
      if (method === 'GET') return route.fulfill({ json: { enabled, shipping_later:true, outstanding_usd: paid ? 0 : 14 } });
      calls.push({ path: pathname, body: route.request().postDataJSON() });
      return route.fulfill({ json: { order_id: 'TEST-PAYPAL-ORDER', approval_url: 'https://www.paypal.com/checkoutnow?token=TEST-PAYPAL-ORDER' } });
    }
    if (pathname === `/api/orders/${trackingToken}/paypal/capture`) {
      calls.push({ path: pathname, body: route.request().postDataJSON() });
      if (outcome === 'declined') return route.fulfill({ status: 409, json: { error: 'PayPal declined or ended this test payment. Start a new test checkout.', code: 'paypal_payment_failed' } });
      if (outcome === 'mismatch') return route.fulfill({ status: 409, json: { error: 'The test payment amount does not match this order.' } });
      if (outcome === 'completed') paid = true;
      return route.fulfill({ json: { state: outcome, payment_status: paid ? 'paid' : 'unpaid' } });
    }
    if (pathname.includes('/auth/')) return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return route.fulfill({ json: [] });
  });
  await page.route('https://www.paypal.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>PayPal sandbox redirect captured by test</h1>' }));
  return calls;
}

test('offers tea-only US payment with a separate shipping quote and redirects to production PayPal', async ({ page }, testInfo) => {
  const calls = await prepare(page);
  await page.goto(basePath);
  const button = page.getByRole('button', { name: 'Pay with PayPal', exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByText('Pay securely with PayPal. Shipping is quoted and charged separately later.', { exact: true })).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
  await page.getByRole('heading',{name:'Order TEST-PREVIEW-PAYPAL',exact:true}).locator('..').locator('..').screenshot({ path: testInfo.outputPath('TEST-PREVIEW-paypal-checkout.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await button.click();
  await expect(page).toHaveURL('https://www.paypal.com/checkoutnow?token=TEST-PAYPAL-ORDER');
  expect(calls).toEqual([{ path: `/api/orders/${trackingToken}/paypal`, body: { invoice_id: 'test-invoice' } }]);
});

test('shows Tea paid only after verified payment and keeps US shipping separately chargeable', async ({ page }, testInfo) => {
  const calls = await prepare(page);
  await page.goto(`${basePath}&paypal_live_return=1&token=TEST-PAYPAL-ORDER`);
  await expect(page.getByTestId('order-journey-label').filter({ hasText: /^Tea paid$/ })).toBeVisible();
  await expect(page).toHaveURL(basePath);
  const order = page.getByRole('heading', { name: 'Order TEST-PREVIEW-PAYPAL', exact: true }).locator('..').locator('..');
  await expect(order.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Paid$/ }) }).locator('dd')).toHaveText('$14');
  await expect(order.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Balance$/ }) }).locator('dd')).toHaveText('$0');
  await page.getByTestId('order-journey-label').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
  await order.screenshot({ path: testInfo.outputPath('TEST-PREVIEW-paypal-confirmed.png') });
  expect(calls).toEqual([{ path: `/api/orders/${trackingToken}/paypal/capture`, body: { invoice_id: 'test-invoice', order_id: 'TEST-PAYPAL-ORDER' } }]);
});

test('keeps live checkout hidden when production payments are paused', async ({ page }) => {
  const calls = await prepare(page, { enabled: false });
  await page.goto(`${basePath}&paypal_live_order=TEST-PAYPAL-ORDER`);
  await expect(page.getByRole('heading', { name: 'Order TEST-PREVIEW-PAYPAL', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay with PayPal/ })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('refuses a sandbox approval URL from the live payment endpoint', async ({page})=>{
 await prepare(page);
 await page.route(`**/api/orders/${trackingToken}/paypal`,async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  return route.fulfill({json:{order_id:'WRONG-ENVIRONMENT',approval_url:'https://www.sandbox.paypal.com/checkoutnow?token=WRONG-ENVIRONMENT'}});
 });
 await page.goto(basePath);await page.getByRole('button',{name:'Pay with PayPal',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('The checkout did not return a PayPal link.');await expect(page).toHaveURL(basePath);
});
