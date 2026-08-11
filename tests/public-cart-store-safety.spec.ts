import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const stores = [
  {
    id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', location_city: 'Bali',
    location_country: 'Indonesia', currency_default: 'IDR', whatsapp_number: '+628123456789',
    contact_email: 'bali@example.test', status: 'active', is_public: 1,
  },
  {
    id: 'acct-australia', name: 'Teajia Australia', slug: 'teajia-australia', location_city: 'Melbourne',
    location_country: 'Australia', currency_default: 'AUD', whatsapp_number: '+61412345678',
    contact_email: 'australia@example.test', status: 'active', is_public: 1,
  },
];

const baliProduct = {
  id: 'bali-tea', given_name: 'Bali Oolong', product_name: 'Bali Oolong', type: 'Oolong',
  status: 'Active', stock_grams: 500, retail_price_per_gram_usd: 0.2,
  tasting_notes: [], additional_images: [],
};

const australiaProduct = {
  id: 'australia-tea', given_name: 'Australia Oolong', product_name: 'Australia Oolong', type: 'Oolong',
  status: 'Active', stock_grams: 500, retail_price_per_gram_usd: 0.3,
  tasting_notes: [], additional_images: [],
};

async function seedStore(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('teajia-storage')) {
      localStorage.setItem('teajia-storage', JSON.stringify({
        state: { publicCart: [], currency: 'AUD', shopStoreSlug: null, ...seed },
        version: 3,
      }));
    }
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: () => {
        const popup = {
          opener: window,
          closed: false,
          close() { this.closed = true; (window as any).__deliveryClosed = true; },
          location: {} as { href?: string },
        };
        Object.defineProperty(popup.location, 'href', {
          set(value: string) { ((window as any).__deliveryHrefs ||= []).push(value); },
        });
        return popup;
      },
    });
  }, state);
}

async function mockCommerce(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: [] }));
  await page.route('**/api/network/stores', route => route.fulfill({ status: 200, json: stores }));
  await page.route('**/api/products/public**', route => route.fulfill({ status: 200, json: [baliProduct] }));
  await page.route('**/api/s/teajia-australia/products', route => route.fulfill({ status: 200, json: [australiaProduct] }));
  await page.route('**/api/s/teajia-bali/products', route => route.fulfill({ status: 200, json: [baliProduct] }));
  await page.route('**/api/s/teajia-australia', route => route.fulfill({ status: 200, json: stores[1] }));
  await page.route('**/api/s/teajia-bali', route => route.fulfill({ status: 200, json: stores[0] }));
  await page.route('**/api/rates', route => route.fulfill({
    status: 200,
    json: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'AUD', rate_to_usd: 1.52 }],
  }));
}

async function addVisibleTea(page: Page, name: string, id: string, storeSlug: string, expectedCartId = id) {
  await page.goto(`/shop/product/${id}?store=${storeSlug}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: /Add to order/ }).click();
  await expect.poll(() => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('teajia-storage') || '{}');
    return stored.state?.publicCart?.[0]?.id;
  })).toBe(expectedCartId);
}

async function reachReview(page: Page) {
  const cartButton = page.getByRole('button', { name: 'Open shopping cart' });
  await expect(cartButton).toBeVisible();
  await cartButton.click();
  await page.getByRole('button', { name: 'Request order' }).click();
  await page.getByLabel('Name *').fill('Ari Tea');
  await page.getByLabel('Contact *').fill('ari@example.test');
  await page.getByLabel('Shipping Location *').fill('Melbourne, Australia');
  await page.getByRole('button', { name: 'Review Order' }).last().click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
}

test('Australia shop selection keeps the inquiry store, currency, and product lines together', async ({ page }) => {
  await seedStore(page);
  await mockCommerce(page);
  let requestBody: any;
  await page.route('**/api/inquiries', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { id: 'inq-aus', ref_number: requestBody.ref_number, tracking_token: requestBody.tracking_token, source: 'email', success: true },
    });
  });

  await page.goto('/shop');
  await page.getByRole('button', { name: /Choose store/ }).click();
  await page.getByRole('option', { name: /Melbourne/ }).click();
  await expect(page.getByRole('button', { name: 'Choose store, currently Melbourne' })).toBeVisible();
  await addVisibleTea(page, 'Australia Oolong', 'australia-tea', 'teajia-australia');
  await page.getByRole('link', { name: /Back to Shop/i }).first().click();
  await reachReview(page);
  await page.getByRole('button', { name: 'Email' }).click();

  await expect.poll(() => requestBody?.store_slug).toBe('teajia-australia');
  expect(requestBody.currency).toBe('AUD');
  expect(JSON.parse(requestBody.items_json)).toEqual([
    expect.objectContaining({ id: 'australia-tea', storeSlug: 'teajia-australia' }),
  ]);
  expect(await page.evaluate(() => (window as any).__deliveryHrefs)).toEqual([
    expect.stringContaining('mailto:australia@example.test'),
  ]);
});

test('an Australia add attempt cannot change a Bali cart', async ({ page }) => {
  await seedStore(page);
  await mockCommerce(page);
  await page.goto('/shop');
  await addVisibleTea(page, 'Bali Oolong', 'bali-tea', 'teajia-bali');
  await page.getByRole('link', { name: /Back to Shop/i }).first().click();
  await expect(page.getByRole('button', { name: 'Choose store, currently Bali' })).toBeVisible();
  await page.getByRole('button', { name: /Choose store/ }).click();
  await page.getByRole('option', { name: /Melbourne/ }).click();
  await expect(page.getByRole('button', { name: 'Choose store, currently Melbourne' })).toBeVisible();
  await addVisibleTea(page, 'Australia Oolong', 'australia-tea', 'teajia-australia', 'bali-tea');

  await expect(page.getByText(/one store only/i)).toBeVisible();
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-storage') || '{}').state.publicCart);
  expect(cart).toHaveLength(1);
  expect(cart[0]).toMatchObject({ id: 'bali-tea', storeSlug: 'teajia-bali' });
});

test('failed delivery stays in Teajia and retry reuses one private inquiry identity', async ({ page }) => {
  await seedStore(page, {
    publicCart: [{
      id: 'australia-tea', name: 'Australia Oolong', variant: '', category: 'tea',
      storeSlug: 'teajia-australia', storeName: 'Teajia Australia', quantityGrams: 50,
      pricePerGram: 0.3, totalPrice: 15,
    }],
    shopStoreSlug: 'teajia-australia',
  });
  await mockCommerce(page);
  const requests: any[] = [];
  await page.route('**/api/inquiries', async route => {
    requests.push(route.request().postDataJSON());
    const body = requests.at(-1);
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { error: 'offline' } }
      : { status: 200, json: { id: 'inq-aus', ref_number: body.ref_number, tracking_token: body.tracking_token, source: 'email', success: true, idempotent: true } });
  });

  await page.goto('/shop');
  await reachReview(page);
  await page.getByRole('button', { name: 'Email' }).click();
  await expect(page.getByRole('alert')).toContainText("couldn't save your order request");
  expect(await page.evaluate(() => (window as any).__deliveryHrefs || [])).toEqual([]);

  await page.getByRole('button', { name: 'Email' }).click();
  await expect(page.getByText('Email client opened. Review and send to place your order.')).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].tracking_token).toBe(requests[0].tracking_token);
  expect(requests[1].ref_number).toBe(requests[0].ref_number);
  await page.getByRole('button', { name: 'Email' }).click();
  expect(requests).toHaveLength(2);
  await expect(page.locator(`a[href="/order/${requests[0].tracking_token}"]`)).toBeVisible();
});

test('private tracking never renders contact or location fields', async ({ page }) => {
  await seedStore(page);
  await mockCommerce(page);
  await page.route('**/api/inquiries/private-token', route => route.fulfill({
    status: 200,
    json: {
      ref_number: 'TJ-PRIVATE', status: 'pending', created_at: '2026-08-10T00:00:00.000Z',
      items_json: JSON.stringify([{ id: 'australia-tea', name: 'Australia Oolong', category: 'tea', quantityGrams: 50, totalPrice: 15 }]),
      total_estimate_usd: 15, currency: 'AUD',
      customer_email: 'private@example.test', customer_phone: '+61400000000', customer_location: 'Private Street, Melbourne',
    },
  }));

  await page.goto('/order/private-token');
  await expect(page.getByRole('heading', { name: 'Order TJ-PRIVATE' })).toBeVisible();
  await expect(page.getByText('private@example.test')).toHaveCount(0);
  await expect(page.getByText('+61400000000')).toHaveCount(0);
  await expect(page.getByText('Private Street, Melbourne')).toHaveCount(0);
});
