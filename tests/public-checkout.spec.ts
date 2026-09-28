import { expect, test, type Page, type Route } from './fixtures';

const CART_ITEM = {
  id: 'checkout-tea', name: 'Moonlight White', variant: '', category: 'tea',
  storeSlug: 'teajia-bali', storeName: 'Teajia Bali', quantityGrams: 50,
  packGrams: 25, packs: 2, lineKey: 'checkout-tea:25', pricePerGram: 0.15, totalPrice: 16,
};
const PRODUCT = {
  id: 'checkout-tea', type: 'White', product_name: 'Moonlight White', year: '2024',
  origin_country: 'China', origin_region: 'Fujian', retail_price_per_gram_usd: 0.15,
  stock_grams: 500, status: 'Active', description: 'Soft florals.',
};
type SubmittedRequest = {
  tracking_token: string; ref_number: string; source: string; customer_location: string;
  customer_contact: string; items_json: string;
  total_estimate_usd: number; currency: string;
};
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepare(page: Page, options: { canBePaid?: boolean; whatsapp?: boolean; failFirst?: boolean; allowPopup?: boolean; light?: boolean; emptyCart?: boolean; product?: Record<string, unknown> } = {}) {
  const requests: SubmittedRequest[] = [];
  await page.addInitScript(({ item, allowPopup, light, emptyCart }) => {
    // Seed once per test context; a reload must exercise the app's saved state.
    if (!localStorage.getItem('checkout-fixture-seeded')) {
      localStorage.setItem('teajia-storage', JSON.stringify({ version: 5, state: { publicCart: emptyCart ? [] : [item], currency: 'IDR', shopStoreSlug: 'teajia-bali' } }));
      localStorage.setItem('checkout-fixture-seeded', 'true');
    }
    if (light) localStorage.setItem('teajia_theme', 'light');
    (window as any).__checkoutPopupCalls = 0;
    const open = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => { (window as any).__checkoutPopupCalls++; return allowPopup ? open(...args) : null; };
  }, { item: CART_ITEM, allowPopup: !!options.allowPopup, light: !!options.light, emptyCart: !!options.emptyCart });
  // The popup is real, but its destination never reaches WhatsApp or sends a message.
  await page.context().route('https://wa.me/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp handoff captured by local test.</p>' }));
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/inquiries' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as SubmittedRequest;
      requests.push(body);
      if (options.failFirst && requests.length === 1) return json(route, { error: 'Could not save your request. Please retry.' }, 503);
      return json(route, { success: true, id: 'request-1', invoice_id: 'invoice-1', invoice_number: 'TJB-0001', tracking_token: body.tracking_token, ref_number: body.ref_number, source: body.source, email_sent: false });
    }
    if (pathname === '/api/s/teajia-bali') return json(route, {
      id: 'bali-account', slug: 'teajia-bali', name: 'Teajia Bali', public_enabled: true,
      can_be_paid: options.canBePaid ?? true, whatsapp_number: options.whatsapp === false ? '' : '6281234567890', contact_email: 'shop@example.com',
    });
    if (pathname === '/api/products/public' || pathname === '/api/s/teajia-bali/products') return json(route, [{ ...PRODUCT, ...options.product }]);
    if (pathname === '/api/rates') return json(route, [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'IDR', rate_to_usd: 16000 }]);
    if (pathname.includes('/api/auth/')) return json(route, { error: 'Unauthorized' }, 401);
    if (pathname === '/api/network/stores') return json(route, { stores: [] });
    return json(route, []);
  });
  return requests;
}

async function openCart(page: Page) {
  await page.locator('button[aria-label="Open shopping cart"]:visible, button[aria-label="Cart"]:visible, button[aria-label^="Cart,"]:visible').first().click();
  await expect(page.getByRole('button', { name: 'Close cart', exact: true })).toBeVisible();
}

async function beginOrder(page: Page, chooseEmail = true) {
  await page.goto('/shop', { waitUntil: 'domcontentloaded' });
  await openCart(page);
  if (chooseEmail) await page.getByRole('radio', { name: 'Email reply', exact: true }).check();
  await page.getByLabel('Your name', { exact: true }).fill('Guest Customer');
  await page.getByLabel('Your email address', { exact: true }).fill('guest@example.com');
}

async function savedCart(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('teajia-storage')!).state.publicCart);
}

test.describe('guest public checkout', () => {
  test('chooses a catalogue amount before adding and submits the same pack and price', async ({ page }, testInfo) => {
    const requests = await prepare(page, { emptyCart: true });
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    const add = page.getByRole('button', { name: 'Choose amount for Moonlight White', exact: true });
    await expect(add).toBeVisible();
    expect(await savedCart(page)).toEqual([]);
    await add.click();
    const chooser = page.getByRole('dialog', { name: 'Moonlight White', exact: true });
    await expect(chooser).toBeVisible();
    expect(await savedCart(page)).toEqual([]);
    await expect(chooser.getByRole('button', { pressed: true })).toHaveCount(0);
    await expect(chooser).toContainText('Quantity provides a lower price.');
    await expect(chooser.getByTestId('amount-total-100')).toHaveText('272k');
    expect(await chooser.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('catalogue-quantity-picker.png'), animations: 'disabled' });
    await chooser.getByRole('button', { name: /^100g/ }).click();
    await expect(chooser).toHaveCount(0);
    await expect(page).toHaveURL(/\/shop$/);
    await expect.poll(() => savedCart(page)).toHaveLength(1);
    const [item] = await savedCart(page);
    expect(item).toMatchObject({ id: PRODUCT.id, packGrams: 100, packs: 1, quantityGrams: 100 });
    expect(item.totalPrice).toBe(17);
    await openCart(page);
    await expect(page.locator('.cart-toast')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('IDR');
    await expect(page.locator('#checkout-form')).toContainText('IDR 272k');
    await expect(page.getByRole('button', { name: 'Close cart', exact: true })).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.getByRole('button', { name: 'Close cart', exact: true }).evaluate(element => {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      return opacity;
    })).toBeGreaterThan(0.99);
    await page.screenshot({ path: testInfo.outputPath('catalogue-checkout-top-viewport.png'), animations: 'disabled' });
    await page.getByRole('radio', { name: 'Email reply', exact: true }).check();
    await page.getByLabel('Your name', { exact: true }).fill('Catalogue Customer');
    await page.getByLabel('Your email address', { exact: true }).fill('guest@example.com');
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByLabel('Your email address', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('catalogue-email-form-viewport.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].source).toBe('website');
    expect(requests[0].currency).toBe('IDR');
    expect(requests[0].total_estimate_usd).toBe(item.totalPrice);
    expect(JSON.parse(requests[0].items_json)[0]).toMatchObject({ id: item.id, packGrams: item.packGrams, packs: 1, totalPrice: item.totalPrice });
    await expect.poll(() => savedCart(page)).toEqual([]);
  });

  test('orders in Bali on the website without opening WhatsApp or an email app', async ({ page }, testInfo) => {
    const requests = await prepare(page);
    await beginOrder(page);
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.screenshot({ path: testInfo.outputPath('checkout-form.png'), fullPage: true });
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    await expect(page.getByText('Your request is saved with Teajia Bali.', { exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('checkout-receipt.png'), fullPage: true });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ source: 'website', customer_location: 'Ubud, Bali, Indonesia', customer_contact: 'guest@example.com' });
    expect(JSON.parse(requests[0].items_json)[0]).toMatchObject({ packGrams: 25, packs: 2 });
    expect(await page.evaluate(() => (window as any).__checkoutPopupCalls)).toBe(0);
    await expect(page.getByRole('link', { name: /View order status/ })).toHaveAttribute('href', `/order/${requests[0].tracking_token}`);
    await expect(page.getByText('Keep your private order-status link.', { exact: false })).toBeVisible();
    await expect(page.getByText('Invoice TJB-0001')).toBeVisible();
    await expect.poll(() => savedCart(page)).toEqual([]);
  });

  test('accepts a pickup request without making the customer invent a shipping location', async ({ page }, testInfo) => {
    const requests = await prepare(page, { whatsapp: false, light: true });
    await beginOrder(page, false);
    await expect(page.getByRole('radio', { name: 'Email reply', exact: true })).toBeChecked();
    await page.getByLabel('Delivery', { exact: true }).selectOption('bali-pickup');
    await expect(page.getByLabel('Your area in Bali', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'WhatsApp', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('checkout-light-form.png'), fullPage: true });
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests[0].customer_location).toBe('Pickup requested in Bali, Indonesia');
  });

  test('catalogue and product page share the same quantity prices, and dismissal adds nothing', async ({ page }) => {
    await prepare(page, { emptyCart: true });
    await page.goto('/shop');
    const opener = page.getByRole('button', { name: 'Choose amount for Moonlight White', exact: true });
    await opener.click();
    const chooser = page.getByRole('dialog', { name: 'Moonlight White', exact: true });
    const prices = await chooser.locator('[data-testid^="amount-total-"]').evaluateAll(nodes => nodes.map(node => [node.getAttribute('data-testid'), node.textContent]));
    await page.keyboard.press('Escape');
    await expect(chooser).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await savedCart(page)).toEqual([]);
    await page.getByRole('button', { name: 'View Moonlight White', exact: true }).click();
    await expect(page).toHaveURL(/\/shop\/product\//);
    await page.locator('.alcove-dock-strip button[aria-expanded]').click();
    const productList = page.getByRole('group', { name: 'Amount', exact: true });
    await expect(productList).toBeVisible();
    expect(await productList.locator('[data-testid^="amount-total-"]').evaluateAll(nodes => nodes.map(node => [node.getAttribute('data-testid'), node.textContent]))).toEqual(prices);
  });

  test('custom quantity is added only after confirmation', async ({ page }) => {
    await prepare(page, { emptyCart: true });
    await page.goto('/shop');
    await page.getByRole('button', { name: 'Choose amount for Moonlight White', exact: true }).click();
    await page.getByRole('button', { name: 'Custom amount, including sample sizes', exact: true }).click();
    const custom = page.getByRole('dialog', { name: 'Custom amount', exact: true });
    await custom.getByRole('spinbutton', { name: 'Amount in grams' }).fill('75');
    expect(await savedCart(page)).toEqual([]);
    await custom.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Moonlight White', exact: true })).toBeVisible();
    expect(await savedCart(page)).toEqual([]);
    await page.getByRole('button', { name: 'Custom amount, including sample sizes', exact: true }).click();
    await custom.getByRole('spinbutton', { name: 'Amount in grams' }).fill('999');
    await expect(custom.getByRole('button', { name: 'Add to cart', exact: true })).toBeDisabled();
    await custom.getByRole('spinbutton', { name: 'Amount in grams' }).fill('75');
    await custom.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await savedCart(page)).toMatchObject([{ packGrams: 75, packs: 1, quantityGrams: 75, totalPrice: 14 }]);
  });

  test('sealed tea offers whole units and normalizes a custom quantity before adding', async ({ page }) => {
    await prepare(page, { emptyCart: true, product: { sold_in_whole_units: 1, piece_weight_g: 100, form: 'Box', stock_grams: 350 } });
    await page.goto('/shop');
    await page.getByRole('button', { name: 'Choose amount for Moonlight White', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'Moonlight White', exact: true });
    await expect(chooser.getByTestId('amount-total-25')).toHaveCount(0);
    await expect(chooser.getByRole('button', { name: /Two boxes/ })).toBeVisible();
    await expect(chooser.getByRole('button', { name: /Four boxes/ })).toHaveCount(0);
    await chooser.getByRole('button', { name: 'A larger number of units' }).click();
    const custom = page.getByRole('dialog', { name: 'Custom amount', exact: true });
    await custom.getByRole('spinbutton', { name: 'Amount in grams' }).fill('130');
    expect(await savedCart(page)).toEqual([]);
    await custom.getByRole('button', { name: 'Add to cart', exact: true }).click();
    expect(await savedCart(page)).toMatchObject([{ packGrams: 200, packs: 1, quantityGrams: 200, totalPrice: 30 }]);
  });

  test('saves a request with a phone contact entirely on the website', async ({ page }) => {
    const requests = await prepare(page);
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await openCart(page);
    await expect(page.getByRole('radio', { name: 'WhatsApp', exact: true })).toBeChecked();
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByLabel('Your name', { exact: true }).fill('Guest Customer');
    await page.getByLabel('Your WhatsApp number', { exact: true }).fill('+6281234567890');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    expect(requests).toHaveLength(1);
    expect(requests[0].source).toBe('website');
    expect(requests[0].customer_contact).toBe('+6281234567890');
    await expect(page.getByText('Your request is saved with Teajia Bali.', { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('Your order request and draft invoice are saved.', { exact: false })).toBeVisible();
    await expect.poll(() => savedCart(page)).toEqual([]);
    expect(await page.evaluate(() => (window as any).__checkoutPopupCalls)).toBe(0);
  });

  test('a blocked popup does not block an order with a phone contact', async ({ page }) => {
    const requests = await prepare(page);
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await openCart(page);
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByLabel('Your name', { exact: true }).fill('Guest Customer');
    await page.getByLabel('Your WhatsApp number', { exact: true }).fill('+6281234567890');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].source).toBe('website');
    expect(await page.evaluate(() => (window as any).__checkoutPopupCalls)).toBe(0);
  });

  test('requires a country internationally and keeps the postcode optional', async ({ page }) => {
    const requests = await prepare(page);
    await beginOrder(page);
    await page.getByLabel('Delivery', { exact: true }).selectOption('international');
    await page.getByLabel('Town or city', { exact: true }).fill('Melbourne');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByText('Enter the destination country.', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(0);
    await page.getByLabel('Country', { exact: true }).fill('Australia');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests[0].customer_location).toBe('Melbourne, Australia');
  });

  test('quotes another Indonesian city without asking for a country', async ({ page }) => {
    const requests = await prepare(page);
    await beginOrder(page);
    await page.getByLabel('Delivery', { exact: true }).selectOption('indonesia');
    await page.getByLabel('City and province', { exact: true }).fill('Jakarta, DKI Jakarta');
    await page.getByLabel('Postcode (optional)', { exact: true }).fill('12345');
    await expect(page.getByLabel('Country', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests[0].customer_location).toBe('Jakarta, DKI Jakarta 12345, Indonesia');
  });

  test('keeps the basket after a failed save and reuses its private token after reload', async ({ page }) => {
    const requests = await prepare(page, { failFirst: true });
    await beginOrder(page);
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not save your request');
    expect(await savedCart(page)).toHaveLength(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCart(page);
    await page.getByRole('radio', { name: 'Email reply', exact: true }).check();
    await expect(page.getByLabel('Your email address', { exact: true })).toHaveValue('guest@example.com');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1].tracking_token).toBe(requests[0].tracking_token);
    expect(requests[1].ref_number).toBe(requests[0].ref_number);
    await expect.poll(() => savedCart(page)).toEqual([]);
  });

  test('retains the receipt link after closing, reopening, and reloading an empty cart', async ({ page }) => {
    const requests = await prepare(page);
    await beginOrder(page);
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue browsing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close cart' })).toHaveCount(0);
    await openCart(page);
    const recent = page.getByRole('region', { name: 'Recent requests' });
    await expect(recent.getByRole('link', { name: requests[0].ref_number })).toHaveAttribute('href', `/order/${requests[0].tracking_token}`);
    await expect(page.getByText('Your basket is empty.', { exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCart(page);
    await expect(recent.getByRole('link', { name: requests[0].ref_number })).toHaveAttribute('href', `/order/${requests[0].tracking_token}`);
    expect(await savedCart(page)).toEqual([]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia_recent_order_requests_v1')!));
    expect(Object.keys(stored[0]).sort()).toEqual(['createdAt', 'reference', 'storeSlug', 'trackingToken']);
    expect(requests).toHaveLength(1);
  });

  test('allows an order request before payment setup', async ({ page }) => {
    const requests = await prepare(page, { canBePaid: false });
    await beginOrder(page);
    await page.getByLabel('Your area in Bali', { exact: true }).fill('Ubud');
    await page.getByRole('button', { name: 'Place order request', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Order request confirmation' })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(await savedCart(page)).toHaveLength(0);
  });
});
