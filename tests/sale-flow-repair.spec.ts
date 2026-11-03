import { test, expect } from './fixtures';
import { assertNothingRunsOffScreen } from './helpers/screenEdge';

const tracking = 'flow-repair-private-order-01234567890123456789';
test('tracking shows the agreed sale, keeps the request, and explains a pending refund', async ({ page }, info) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === `/api/inquiries/${tracking}` ? {
      ref_number: 'FLOW-42', created_at: '2026-10-28T00:00:00Z', currency: 'USD', total_estimate_usd: 40,
      items_json: JSON.stringify([{ id: 'tea', name: 'Requested tea', category: 'tea', quantityGrams: 100, totalPrice: 40 }]),
      invoice_items: [{ id: 'line', product_id: 'tea', name: 'Agreed tea', quantity: 50, quantity_unit: 'g', unit_price_usd: .3, line_total_usd: 15 }],
      order: { status: 'Void', invoice_number: 'INV-FLOW', refund_required: true, refunded_usd: 5, refund_due_usd: 10 },
      contact: { email: 'shop@example.test' },
      payment: { total_usd: 15, paid_usd: 15, outstanding_usd: 0 },
      journey: { stage: 'cancelled', label: 'Cancelled' },
    } : path === '/api/rates' ? [{ currency: 'USD', rate_to_usd: 1 }]
      : path === '/api/s/teajia-bali' ? { id: 'shop', slug: 'teajia-bali', name: 'Teajia Bali', public_enabled: true }
      : path.includes('/auth/') ? { error: 'Unauthorized' } : [];
    return route.fulfill({ status: path.includes('/auth/') ? 401 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`/order/${tracking}`);
  await expect(page.getByText('Agreed tea', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('50g', { exact: true })).toBeVisible();
  await expect(page.getByText(/Cancelled · refund in progress/)).toBeVisible();
  await expect(page.getByText(/10.*remaining/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email about this order' })).toHaveAttribute('href', /^mailto:shop@example.test/);
  await expect(page.getByTestId('order-pay-action')).toHaveCount(0);
  await page.getByText('Original request', { exact: true }).click();
  await expect(page.getByText(/Requested tea · 100g/)).toBeVisible();
  await assertNothingRunsOffScreen(page, 'agreed sale and refund');
  await page.screenshot({ path: info.outputPath('agreed-sale-refund.png'), fullPage: true, animations: 'disabled' });
});
