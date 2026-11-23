import { expect, stubBrowserServices, test } from './fixtures';

interface Seller {
  name: string;
  profile: string;
  slug: string;
  accountId: string;
  holdingId: string;
  token: string;
  destination: string;
}

const usingLocalWorker = process.env.TEAJIA_PERSONAL_PILOT_BROWSER === '1';
test.skip(!usingLocalWorker, 'Requires the loopback personal seller Worker fixtures');
test.use({ serviceWorkers: 'block' });

test('publishes from Stock, buys from the profile, pays the seller, and preserves the private holding', async ({ page, context, browser, request, baseURL }, testInfo) => {
  test.setTimeout(60_000);
  if (!baseURL || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(baseURL)) {
    throw new Error('Use an isolated loopback Vite site for the personal seller pilot.');
  }
  const external = (url: URL) => /^https?:$/.test(url.protocol) && url.origin !== baseURL;
  await context.route(external, route => route.abort());
  const fixturesResponse = await request.get('/api/pilot-test-fixtures');
  expect(fixturesResponse.ok()).toBe(true);
  const { seller, other, offer, privateLabel } = await fixturesResponse.json() as {
    seller: Seller; other: Seller; offer: { name: string; grams: number; price_amount: number; price_currency: string }; privateLabel: string;
  };
  const ownerHeaders = { Authorization: `Bearer ${seller.token}`, 'X-Teajia-Account': seller.accountId };
  const stockPath = `/admin/stock?panel=${encodeURIComponent(seller.holdingId)}`;
  const sourcePath = `/api/products/${encodeURIComponent(seller.holdingId)}`;
  const sellerProductPath = `/api/s/${seller.slug}/products`;
  const profilePath = `/people/${seller.profile}`;
  const owner = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined, serviceWorkers: 'block' });
  try {
    await stubBrowserServices(owner);
    await owner.route(external, route => route.abort());
    await owner.addInitScript(token => localStorage.setItem('teajia_token', token), seller.token);
    const stock = await owner.newPage();
    await stock.emulateMedia({ reducedMotion: 'reduce' });
    await stock.goto(stockPath);
    const editor = stock.getByRole('region', { name: 'Seller offer' });
    await expect(editor.getByText('Private stock')).toBeVisible({ timeout: 15_000 });
    await editor.getByRole('button', { name: 'Offer for sale' }).click();
    const offerForm = stock.getByRole('dialog', { name: 'Offer for sale' });
    await offerForm.getByLabel('Public tea name').fill(offer.name);
    await offerForm.getByRole('spinbutton', { name: /Pack weight/ }).fill(String(offer.grams));
    await offerForm.getByRole('spinbutton', { name: 'Pack price' }).fill(String(offer.price_amount));
    await offerForm.getByRole('combobox', { name: 'Currency' }).selectOption(offer.price_currency);
    await offerForm.getByRole('button', { name: 'Preview offer' }).click();
    const review = stock.getByRole('dialog', { name: 'Review your offer' });
    await expect(review.getByRole('heading', { name: offer.name })).toBeVisible();
    await expect(review.getByText(/USD\s25\.00/)).toBeVisible();
    await stock.screenshot({ path: testInfo.outputPath('01-stock-offer-review.png') });
    const published = stock.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `${sourcePath}/personal-offer`);
    await review.getByRole('button', { name: 'Publish offer' }).click();
    const publishedResponse = await published;
    expect(publishedResponse.ok()).toBe(true);
    const { product_id: productId } = await publishedResponse.json() as { product_id: string };
    const exactPath = `/shop/product/${productId}?store=${seller.slug}`;
    await expect(editor.getByRole('link', { name: 'View offer' })).toHaveAttribute('href', exactPath);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(profilePath);
    const links = page.getByRole('region', { name: 'Teas for sale' });
    const listing = links.getByRole('link', { name: new RegExp(offer.name) });
    await expect(listing).toHaveAttribute('href', exactPath);
    await expect(listing).toContainText(/50 g · USD\s25\.00/);
    await expect(page.getByText(privateLabel)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('02-public-profile-offer.png'), fullPage: true });
    await listing.click();
    await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === exactPath);
    await page.locator('button.alcove-order-btn:visible, button.alcove-dock-add:visible').first().click();
    await page.getByRole('button', { name: /Added .*50 g\. Open order/ }).click();
    const cart = page;
    await expect(cart.getByRole('heading', { name: 'Your order' })).toBeVisible();
    await expect(cart.getByText(`Order from ${seller.name}’s Tea Chest`)).toBeVisible();
    await expect(cart.getByText('50 g pack')).toBeVisible();
    await expect(cart.getByRole('article', { name: offer.name }).getByText(/USD\s25\.00/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('03-seller-checkout.png') });
    await cart.getByLabel('Town or city').fill('Tokyo');
    await cart.getByLabel('Country', { exact: true }).fill('Japan');
    await cart.getByLabel('Your name').fill('Example Buyer');
    const emailChoice = cart.getByRole('radio', { name: /Website|Email/ });
    if (await emailChoice.count()) await emailChoice.check();
    await cart.getByLabel('Your email address').fill('buyer@example.test');
    const checkout = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inquiries');
    await cart.getByRole('button', { name: 'Place order request' }).click();
    const submitted = await checkout;
    const payload = submitted.request().postDataJSON();
    expect(payload).toMatchObject({ store_slug: seller.slug, total_estimate_usd: 25, currency: 'USD' });
    expect(JSON.parse(payload.items_json)).toEqual([expect.objectContaining({ id: productId, storeSlug: seller.slug, packGrams: 50, packs: 1 })]);
    expect(submitted.status()).toBe(201);
    const { invoice_id: invoiceId } = await submitted.json() as { invoice_id: string };
    const invoicePath = `/api/invoices/${invoiceId}`;
    const otherHeaders = { Authorization: `Bearer ${other.token}`, 'X-Teajia-Account': other.accountId };
    expect((await request.get(`/api/s/${other.slug}/products/${productId}`)).status()).toBe(404);
    expect((await request.get(`${sellerProductPath}/${seller.holdingId}`)).status()).toBe(404);
    expect(await (await request.get(`/api/public/people/${seller.profile}/payment-methods`)).json()).toMatchObject({ code: 'pay_private' });
    expect((await request.put(invoicePath, { headers: otherHeaders, data: { status: 'Pending' } })).status()).toBe(404);
    expect((await request.put(invoicePath, { headers: ownerHeaders, data: { status: 'Pending' } })).ok()).toBe(true);
    await cart.getByRole('link', { name: /View order status/ }).click();
    const pay = page.getByRole('link', { name: `Pay ${seller.name}` });
    await expect(pay).toHaveAttribute('href', new RegExp(`^${profilePath}/pay\\?`));
    await pay.click();
    const destination = page.getByText(seller.destination, { exact: true });
    await expect(destination).toBeVisible();
    await destination.scrollIntoViewIfNeeded();
    await expect(page.getByText(other.destination, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('04-seller-payment-destination.png') });

    const data = { amount_usd: 25, method_label: 'Bank transfer', request_id: 'browser-pilot-synthetic-payment' };
    const paymentsPath = `${invoicePath}/payments`;
    const paid = await request.post(paymentsPath, { headers: ownerHeaders, data });
    expect(paid.status()).toBe(201);
    const result = await paid.json();
    expect(result).toMatchObject({ payment_status: 'paid', stock: { state: 'deducted' } });
    expect(await (await request.post(paymentsPath, { headers: ownerHeaders, data })).json()).toMatchObject({
      payment_id: result.payment_id, idempotent: true, stock: { state: 'already_deducted' },
    });
    expect(await (await request.post('/api/inquiries', { data: payload })).json()).toMatchObject({ invoice_id: invoiceId, idempotent: true });

    await stock.goto(stockPath);
    await expect(editor.getByText('Sold out')).toBeVisible();
    const withdrawal = stock.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname === `${sourcePath}/personal-offer`);
    await editor.getByRole('button', { name: 'Withdraw offer' }).click();
    expect(await (await withdrawal).json()).toMatchObject({ restored_grams: 0 });
    await expect(editor.getByText('Private stock')).toBeVisible();
    const privateStock = await (await request.get(sourcePath, { headers: ownerHeaders })).json();
    expect(privateStock).toMatchObject({ id: seller.holdingId, product_name: privateLabel, stock_grams: 100, is_public: 0 });
    await page.goto(exactPath);
    await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
    await page.goto(profilePath);
    await expect(links).toHaveCount(0);
  } finally {
    await owner.close();
  }
});
