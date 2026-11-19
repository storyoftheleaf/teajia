import { test, expect } from './fixtures';

for (const paid of [false, true]) {
  test(`delivery order ${paid ? 'confirms tea payment' : 'offers tea payment'} while shipping remains separately chargeable`, async ({ page }, testInfo) => {
    await page.route('**/api/inquiries/shipping-later-test', route => route.fulfill({ json: {
      ref_number: 'TEST-SHIPPING-LATER', invoice_id: 'test-invoice', invoice_number: 'TEST-001',
      created_at: '2026-11-19T00:00:00Z', currency: 'USD', items_json: '[]', total_estimate_usd: 14,
      order: { invoice_id: 'test-invoice', invoice_number: 'TEST-001', status: 'Pending', shipping_quote_status: 'requested', shipping_cost_usd: 0, shipping_destination: 'US shipping · TEST ADDRESS' },
      invoice_items: [{ id: 'line', name: 'Test tea', quantity: 50, quantity_unit: 'g', unit_price_usd: .28, line_total_usd: 14 }],
      payment: { total_usd: 14, paid_usd: paid ? 14 : 0, outstanding_usd: paid ? 0 : 14, has_methods: false, pay_url: null },
      journey: { stage: paid ? 'paid' : 'awaiting_payment', label: paid ? 'Tea paid' : 'Awaiting payment', detail: 'Shipping is quoted and charged separately later.', at: null },
    } }));
    await page.route('**/api/orders/shipping-later-test/paypal-sandbox*', route => route.fulfill({ json: { enabled: true, outstanding_usd: paid ? 0 : 14 } }));
    await page.goto('/order/shipping-later-test', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Shipping is quoted and charged separately later.', { exact: true }).first()).toBeVisible();
    const block = page.getByRole('heading', { name: 'Order TEST-SHIPPING-LATER', exact: true }).locator('..').locator('..');
    await expect(block.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Delivery$/ }) })).toHaveCount(0);
    await expect(block.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Invoice total$/ }) }).locator('dd')).toHaveText('$14');
    await expect(page.getByTestId('order-journey-label')).toHaveText(paid ? 'Tea paid' : 'Awaiting payment');
    await expect(page.getByText('Paid in full', { exact: true })).toHaveCount(0);
    if (!paid) await expect(page.getByRole('button', { name: 'Pay with PayPal · test', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await block.screenshot({ path: testInfo.outputPath(`shipping-later-${paid ? 'tea-paid' : 'before-payment'}.png`) });
  });
}
