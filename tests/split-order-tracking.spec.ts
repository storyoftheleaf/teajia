import { test, expect } from './fixtures';

const trackingToken = 'private-split-tracking';
const invoices = [
  { invoice_id: 'original', invoice_number: 'TJ-001', status: 'Confirmed' },
  { invoice_id: 'split/child', invoice_number: 'TJ-002', status: 'Confirmed' },
];

test('one private order link selects split invoice items, balance and payment report', async ({ page }) => {
  const selections: Array<string | null> = [];
  await page.route(`**/api/inquiries/${trackingToken}*`, route => {
    const selected = new URL(route.request().url()).searchParams.get('invoice');
    selections.push(selected);
    const child = selected === 'split/child';
    const invoice = invoices[child ? 1 : 0];
    return route.fulfill({ json: {
      ref_number: 'ORDER-001', invoice_id: invoice.invoice_id, invoice_number: invoice.invoice_number,
      invoices, order: invoice, created_at: '2026-11-19T00:00:00Z', currency: 'USD',
      items_json: '[]', total_estimate_usd: 30,
      invoice_items: [{ id: child ? 'child-line' : 'original-line', name: child ? 'Moved oolong' : 'Original green tea', quantity: 50, quantity_unit: 'g', unit_price_usd: 0.2, line_total_usd: child ? 10 : 20 }],
      payment: { total_usd: child ? 10 : 20, paid_usd: 0, outstanding_usd: child ? 10 : 20, has_methods: true, pay_url: `/pay/tea?amount=${child ? 10 : 20}&ref=${invoice.invoice_number}`, claims_pending: 0 },
      journey: { stage: 'awaiting_payment', label: 'Awaiting payment', detail: null, at: null },
    } });
  });
  await page.route(`**/api/orders/${trackingToken}/payment-claim`, route => route.fulfill({ json: { claim_id: 'claim-child', claims_pending: 1 } }));
  await page.goto(`/order/${trackingToken}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Original green tea', { exact: true })).toBeVisible();
  const invoiceLinks = page.getByRole('region', { name: 'Invoices for this order' });
  await expect(invoiceLinks.getByRole('link', { name: 'TJ-001 Confirmed' })).toHaveAttribute('aria-current', 'page');
  await invoiceLinks.getByRole('link', { name: 'TJ-002 Confirmed' }).click();
  await expect(page).toHaveURL(/invoice=split%2Fchild$/);
  await expect(page.getByText('Moved oolong', { exact: true })).toBeVisible();
  await expect(page.getByText('Original green tea', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('order-pay-link')).toHaveAttribute('href', '/pay/tea?amount=10&ref=TJ-002');
  await page.getByTestId('order-payment-claim-open').click();
  await expect(page.getByTestId('order-payment-claim-amount')).toHaveValue('10.00');
  const claimRequest = page.waitForRequest(request => request.url().endsWith(`/api/orders/${trackingToken}/payment-claim`));
  await page.getByTestId('order-payment-claim-send').click();
  expect((await claimRequest).postDataJSON()).toMatchObject({ invoice_id: 'split/child', amount: 10, currency: 'USD' });
  expect(selections).toContain(null);
  expect(selections).toContain('split/child');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
