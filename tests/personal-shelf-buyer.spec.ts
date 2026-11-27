import { expect, test, type Page } from './fixtures';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await context.route(url => /^https?:$/.test(url.protocol) && url.origin !== origin, route => route.abort());
});

const lin = 'lin-chen-fixture';
const shelf = 'lin-shelf-fixture';
const autumn = { id: 'autumn-lot', name: 'Autumn oolong', type: 'Oolong', origin: 'Taiwan', year: 2025, grams: 50, price_amount: 25, price_currency: 'USD', image_url: null };
const spring = { ...autumn, id: 'spring-lot', name: 'Spring oolong', year: 2026, grams: 25, price_amount: 15, image_url: '/favicon.svg' };
const whatsapp = '12025550123';

// orderable_shelf_slug is emitted only by the Offers eligibility reader at
// integration. These browser responses are synthetic, including all names.
async function fixtures(page: Page, shelfContributor = () => lin) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/people') {
      await route.fulfill({ json: { contributors: [
        { id: lin, display_name: 'Lin Chen', role: 'Tea Master', page_tier: 'master' },
      ] } });
    } else if (path.startsWith('/api/people/')) {
      const id = path.split('/').at(-1);
      await route.fulfill({ json: {
        id, display_name: id === lin ? 'Lin Chen' : 'Other Person', role: 'Tea Master',
        beginnings: 'I buy oolong to share at my table. I have kept a tea journal for many years.',
        collection: { slug: 'lin-collection', title: 'Four teas I return to', item_count: 4 },
        hosting: { slug: 'spring-sit', title: 'Spring tea sit', event_date: '2027-03-20T10:00:00Z' },
        shelf_slug: shelf,
        ...(id === lin && { orderable_shelf_slug: shelf }),
      } });
    } else if (path.startsWith('/api/shelf/')) {
      const slug = path.split('/').at(-1);
      const standalone = slug !== shelf;
      await route.fulfill({ json: {
        slug, title: standalone ? 'Hill Tea Shelf' : 'Lin’s teas',
        seller_name: standalone ? 'Hannah Hill' : 'Lin Chen',
        whatsapp: slug === 'missing-contact' ? 'not-a-number' : whatsapp,
        items: slug === 'empty-shelf' ? [] : slug === 'unpriced-shelf'
          ? [{ ...autumn, price_amount: null, price_currency: null }]
          : [spring, autumn],
        ...(standalone ? {} : { contributor_slug: shelfContributor() }),
      } });
    } else if (path.endsWith('/impressions')) {
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ json: {} });
    }
  });
}

test('opens the exact reviewed profile offer and keeps collection, hosting and Back', async ({ page }, testInfo) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/people');
  await page.getByRole('link', { name: /Lin Chen/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/people/${lin}$`));
  const sale = page.getByRole('region', { name: 'Teas for sale' });
  await expect(sale.getByText(/50 g available · USD\s25\.00/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the collection Four teas I return to' })).toHaveAttribute('href', '/c/lin-collection');
  await expect(page.getByRole('link', { name: /Hosting Spring tea sit/ })).toHaveAttribute('href', '/event/spring-sit');
  await page.screenshot({ path: testInfo.outputPath('profile.png'), fullPage: true });
  const listing = sale.getByRole('link', { name: /Autumn oolong/ });
  await expect(listing).toHaveAttribute('href', `/u/${shelf}#offer-autumn-lot`);
  await listing.click();
  await expect(page).toHaveURL(new RegExp(`/u/${shelf}#offer-autumn-lot$`));
  const tea = page.getByRole('heading', { name: 'Autumn oolong' });
  await expect(tea).toBeFocused();
  const order = page.getByRole('article').filter({ has: tea }).getByRole('link', { name: 'Order from Lin Chen' });
  const orderURL = new URL((await order.getAttribute('href'))!);
  expect(orderURL.origin + orderURL.pathname).toBe(`https://wa.me/${whatsapp}`);
  expect(orderURL.searchParams.get('text')).toContain('Autumn oolong (2025)');
  expect(orderURL.searchParams.get('text')).toMatch(/50 g for USD\s25\.00/);
  await expect(order).toHaveText(/USD\s25\.00/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('shelf.png'), fullPage: true });
  await page.goBack();
  await expect(sale).toBeVisible();
  await sale.getByRole('link', { name: 'View all teas for sale' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${shelf}$`));
  await expect(page.getByRole('heading', { name: 'Lin’s teas' })).toBeVisible();
});

test('keeps an unreviewed mapping off the profile and handles stale links and missing contacts', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => localStorage.setItem('teajia_theme', 'light'));
  await page.goto('/people/unreviewed');
  await expect(page.getByRole('heading', { name: 'Other Person' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Teas for sale' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the collection Four teas I return to' })).toBeVisible();

  await page.goto(`/u/${shelf}#offer-withdrawn`);
  await expect(page.getByRole('status').filter({ hasText: 'This offer is no longer available' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spring oolong' })).toBeVisible();

  await page.goto('/u/missing-contact#offer-autumn-lot');
  await expect(page.getByRole('heading', { name: 'Autumn oolong' })).toBeFocused();
  await expect(page.getByText('WhatsApp orders are currently unavailable.')).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);

  await page.goto('/u/independent-seller');
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.getByRole('heading', { name: 'Hill Tea Shelf' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Order from Hannah Hill' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /host profile/i })).toHaveCount(0);

  await page.goto('/u/empty-shelf');
  await expect(page.getByText('No teas are currently for sale.')).toBeVisible();
  await page.goto('/u/unpriced-shelf#offer-autumn-lot');
  await expect(page.getByText('No teas are currently for sale.')).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
});

test('withholds the handoff if a linked shelf resolves to another seller', async ({ page }) => {
  let contributor = lin;
  await fixtures(page, () => contributor);
  await page.goto(`/people/${lin}`);
  const offer = page.getByRole('link', { name: /Autumn oolong/ });
  await expect(offer).toBeVisible();
  contributor = 'wrong-seller';
  await offer.click();
  await expect(page.getByRole('heading', { name: 'Shelf not found' })).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to profile' })).toHaveAttribute('href', `/people/${lin}`);
});

test('Tea Chest preview uses the same Shop row as the published offer', async ({ page }, testInfo) => {
  await fixtures(page);
  const tokenPart = Buffer.from(JSON.stringify({ sub: 'seller', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), `header.${tokenPart}.signature`);
  const offer = { ...autumn, origin: 'Nantou' };
  await page.route('**/api/me/cellar', route => route.fulfill({ json: { items: [{
    id: offer.id, name: 'Private batch name', grams: 150, label: 'Autumn tastings',
    placementStatus: 'private', shelfPublished: true, shelfOffer: offer, costAmount: 11, costCurrency: 'AUD',
  }] } }));
  await page.route('**/api/me/shelf', route => route.fulfill({ json: { enabled: true, slug: shelf, whatsapp } }));
  await page.route(`**/api/shelf/${shelf}`, route => route.fulfill({ json: {
    slug: shelf, seller_name: 'Lin Chen', whatsapp, items: [offer],
  } }));

  await page.goto('/account/cellar');
  await expect(page.getByRole('heading', { name: 'Tea Chest' })).toBeVisible();
  await page.getByRole('button', { name: 'Add tea you own' }).click();
  await page.getByPlaceholder('Tea name').fill('New holding');
  const addTea = page.getByRole('button', { name: 'Add to Tea Chest' });
  await expect(addTea).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Purchase cost' }).fill('0');
  await expect(addTea).toBeDisabled();
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('USD');
  await expect(addTea).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Edit offer' }).click();
  const salePrice = page.getByRole('spinbutton', { name: 'Price for 50 g' });
  const previewOffer = page.getByRole('button', { name: 'Preview offer' });
  await salePrice.clear();
  await expect(previewOffer).toBeDisabled();
  await salePrice.fill('25');
  await previewOffer.click();
  await expect(page.getByRole('heading', { name: 'Buyer preview' })).toBeVisible();
  await expect(page.getByText('Private batch name')).toHaveCount(0);
  await expect(page.getByText(/AUD\s11\.00/)).toHaveCount(0);
  await expect(page.getByText(/USD\s25\.00/)).toBeVisible();
  const describeRow = async () => {
    const row = page.locator('[data-tea-ledger-row]');
    await expect(row.getByRole('heading', { name: offer.name })).toBeVisible();
    return row.evaluate(el => {
      const title = el.querySelector('h3')!;
      const style = getComputedStyle(title);
      return { text: el.textContent, font: style.font, color: style.color, wash: getComputedStyle(el).backgroundImage };
    });
  };
  const previewRow = await describeRow();
  await page.screenshot({ path: testInfo.outputPath('tea-chest-preview.png'), animations: 'disabled', scale: 'css' });

  await page.goto(`/u/${shelf}`);
  expect(await describeRow()).toEqual(previewRow);
  await expect(page.getByRole('link', { name: 'Order from Lin Chen' })).toHaveAttribute('href', /^https:\/\/wa\.me\/12025550123\?/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('personal-tea-shop.png'), animations: 'disabled', scale: 'css' });
});

test('an existing personal shelf address opens the standard account storefront and cart', async ({ page }) => {
  await fixtures(page);
  const store = 'lin-tea-chest';
  await page.route(`**/api/shelf/${shelf}`, route => route.fulfill({ json: {
    slug: shelf, store_slug: store, seller_name: 'Lin Chen', whatsapp: null, items: [],
  } }));
  await page.route(`**/api/s/${store}`, route => route.fulfill({ json: {
    id: 'lin-account', slug: store, name: 'Lin Chen’s Tea Chest', public_enabled: 1, currency_default: 'USD',
  } }));
  await page.route(`**/api/s/${store}/events`, route => route.fulfill({ json: [] }));
  await page.route(`**/api/s/${store}/products`, route => route.fulfill({ json: [{
    id: autumn.id, slug: autumn.id, product_name: autumn.name, type: autumn.type, stock_grams: 150,
    retail_price_per_gram_usd: 0.5, given_name: autumn.name, form: 'Loose', year: autumn.year,
  }] }));
  await page.goto(`/u/${shelf}`);
  await expect(page).toHaveURL(new RegExp(`/store/${store}$`));
  await expect(page.getByRole('heading', { name: 'Lin Chen’s Tea Chest' })).toBeVisible();
  const standardRow = page.locator('[data-tea-ledger-row]');
  await expect(standardRow.getByRole('heading', { name: autumn.name })).toBeVisible();
  await expect(standardRow.getByRole('button', { name: /add.*autumn oolong to cart/i })).toBeVisible();
});

test('an anonymous buyer orders the exact seller pack through the standard cart', async ({ page }, testInfo) => {
  const store = 'lin-tea-chest';
  const otherStore = 'another-tea-chest';
  const offerId = 'lin-pack-001';
  const fixedPrice = 25.37;
  const product = {
    id: offerId, slug: 'autumn-pack', product_name: autumn.name, type: autumn.type, stock_grams: 50,
    fixed_retail_price_usd: fixedPrice / 50, exact_pack_price_usd: fixedPrice, given_name: autumn.name,
    form: 'Bag', piece_weight_g: 50, sold_in_whole_units: 1, year: autumn.year,
  };
  let withdrawn = false;
  const storeProduct = (seller: string) => `/api/s/${seller}/products/${offerId}`;
  await fixtures(page);
  await page.route(`**/api/people/${lin}`, route => route.fulfill({ json: {
    id: lin, display_name: 'Lin Chen', role: 'Tea Master', page_tier: 'master', personal_store_slug: store,
  } }));
  await page.route(`**/api/s/${store}/products`, route => route.fulfill({ json: withdrawn ? [] : [product] }));
  await page.route('**/api/s/*/products/*', route => new URL(route.request().url()).pathname === storeProduct(store) && !withdrawn
    ? route.fulfill({ json: product }) : route.fulfill({ status: 404, json: { error: 'Product not found' } }));
  await page.route(`**/api/s/${store}`, route => route.fulfill({ json: {
    id: store, slug: store, name: 'Lin Chen’s Tea Chest', public_enabled: true, can_be_paid: true, currency_default: 'USD',
  } }));
  await page.route('**/api/inquiries', route => {
    const payload = route.request().postDataJSON();
    expect(payload).toMatchObject({ store_slug: store, currency: 'USD', total_estimate_usd: fixedPrice, source: 'website' });
    expect(JSON.parse(payload.items_json)).toEqual([expect.objectContaining({
      id: offerId, storeSlug: store, quantityGrams: 50, packGrams: 50, packs: 1, totalPrice: fixedPrice,
    })]);
    return route.fulfill({ status: 201, json: {
      success: true, id: 'inquiry-synthetic', ref_number: payload.ref_number, tracking_token: payload.tracking_token,
    } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/people/${lin}`);
  const listing = page.getByRole('region', { name: 'Teas for sale' }).getByRole('link', { name: /Autumn oolong/ });
  const exactPath = `/shop/product/${offerId}?store=${store}`;
  await expect(listing).toHaveAttribute('href', exactPath);
  await expect(listing).toContainText(/50 g · USD\s25\.37/);
  await page.screenshot({ path: testInfo.outputPath('seller-profile.png'), fullPage: true });
  await listing.click();
  await expect(page).toHaveURL(new RegExp(`\\?store=${store}$`));
  await page.locator('button.alcove-order-btn:visible, button.alcove-dock-add:visible').first().click();
  await page.getByRole('button', { name: /Added Autumn oolong, 50 g\. Open order/ }).click();
  const cart = page;
  await expect(cart.getByRole('heading', { name: 'Your order' })).toBeVisible();
  await expect(cart.getByText('Order from Lin Chen’s Tea Chest')).toBeVisible();
  await expect(cart.getByText('50 g pack')).toBeVisible();
  await expect(cart.getByRole('link', { name: autumn.name })).toHaveAttribute('href', exactPath);
  await expect(cart.getByRole('button', { name: 'A different weight' })).toHaveCount(0);
  await expect(cart.getByRole('button', { name: /One more pack/ })).toHaveCount(0);
  await expect(cart.getByRole('article', { name: autumn.name }).getByText(/USD\s25\.37/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('seller-cart.png') });
  await cart.getByLabel('Town or city').fill('Edinburgh');
  await cart.getByLabel('Country', { exact: true }).fill('United Kingdom');
  await cart.getByLabel('Your name').fill('Guest Buyer');
  await cart.getByLabel('Your email address').fill('testbuyer@example.test');
  await cart.getByRole('button', { name: 'Place order request' }).click();
  await expect(cart.getByText('Your request is saved with Lin Chen’s Tea Chest.')).toBeVisible();
  await expect(cart.getByRole('link', { name: /View order status/ })).toHaveAttribute('href', /^\/order\/[\w-]{43}$/);

  await page.goto(`/shop/product/${offerId}?store=${otherStore}`);
  await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
  withdrawn = true;
  await page.goto(exactPath);
  await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
  await page.goto(`/people/${lin}`);
  await expect(page.getByRole('region', { name: 'Teas for sale' })).toHaveCount(0);
});
