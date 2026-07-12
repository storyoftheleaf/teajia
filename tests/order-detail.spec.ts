import { test, expect, type Page } from '@playwright/test';

const token = [
  btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  btoa(JSON.stringify({ sub: 'user-a', email: 'member@example.com', name: 'Member', role: 'member', active_account_id: 'acct-a', memberships: [] })),
  'signature',
].join('.');

const history = {
  orders: [{
    id: 'inv-a', invoice_number: 'A-001', status: 'Filled', total_amount_usd: 16,
    currency: 'USD', created_at: '2026-07-01T00:00:00.000Z', line_items_count: 2,
  }],
};

const detail = {
  id: 'inv-a', invoice_number: 'A-001', status: 'Filled', created_at: '2026-07-01T00:00:00.000Z',
  payment_date: '2026-07-02T00:00:00.000Z', fulfilled_at: '2026-07-03T00:00:00.000Z', currency: 'USD',
  items: [
    { id: 'line-1', product_id: 'product-1', name: 'Oolong', quantity: 2, unit_price_usd: 4, line_total_usd: 8 },
    { id: 'line-2', product_id: null, name: 'Tea tin', quantity: 1, unit_price_usd: 5, line_total_usd: 5 },
  ],
  subtotal_amount_usd: 13, shipping_amount_usd: 3, total_amount_usd: 16,
  contact: { whatsapp: '+62 800', email: 'orders@store.test' },
};

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes('unauthenticated')) {
    await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  }
});

async function mockHistory(page: Page) {
  await page.route('**/api/me/orders', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(history),
  }));
}

test('history row opens its order detail', async ({ page }) => {
  await mockHistory(page);
  await page.goto('/account/orders');
  await page.getByRole('button', { name: /A-001/ }).click();
  await expect(page).toHaveURL('/account/orders/inv-a');
});

test('detail shows loading then the complete inquiry journey above mobile navigation', async ({ page }) => {
  await page.route('**/api/me/orders/inv-a', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail) });
  });

  await page.goto('/account/orders/inv-a');
  await expect(page.getByLabel('Loading order details')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order A-001' })).toBeVisible();
  await expect(page.getByText('Oolong', { exact: true })).toBeVisible();
  await expect(page.getByText('Tea tin', { exact: true })).toBeVisible();
  await expect(page.getByText('Jul 2, 2026')).toBeVisible();
  await expect(page.getByText('Jul 3, 2026')).toBeVisible();
  await expect(page.getByText('$16.00', { exact: true })).toBeVisible();
  const contact = page.getByRole('link', { name: 'Ask about this order on WhatsApp' });
  await expect(contact).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await contact.scrollIntoViewIfNeeded();
  const clearance = await page.evaluate(() => {
    const action = document.querySelector('[data-testid="order-contact-action"]')?.getBoundingClientRect();
    const nav = document.querySelector('[data-testid="bottom-tab-bar"]')?.getBoundingClientRect();
    return action && nav ? action.bottom <= nav.top : false;
  });
  expect(clearance).toBe(true);
});

test('unauthenticated detail redirects with an encoded return path', async ({ page }) => {
  await page.goto('/account/orders/inv-a');
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Faccount%2Forders%2Finv-a$/);
});

test('retryable detail error can recover', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/me/orders/inv-a', route => {
    attempts += 1;
    return route.fulfill({
      status: attempts === 1 ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(attempts === 1 ? { error: 'Order service unavailable' } : detail),
    });
  });
  await page.goto('/account/orders/inv-a');
  await expect(page.getByRole('alert')).toContainText('Order service unavailable');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Order A-001' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('missing order shows a Back action', async ({ page }) => {
  await page.route('**/api/me/orders/missing', route => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Order not found' }),
  }));
  await page.goto('/account/orders/missing');
  await expect(page.getByText('Order not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
});

test('zero shipping is displayed explicitly and email is the inquiry fallback', async ({ page }) => {
  await page.route('**/api/me/orders/inv-a', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...detail, shipping_amount_usd: 0, total_amount_usd: 13, contact: { whatsapp: null, email: 'orders@store.test' } }),
  }));
  await page.goto('/account/orders/inv-a');
  await expect(page.getByTestId('shipping-total')).toContainText('$0.00');
  await expect(page.getByRole('link', { name: 'Ask about this order by email' })).toHaveAttribute('href', /mailto:orders@store\.test/);
});
