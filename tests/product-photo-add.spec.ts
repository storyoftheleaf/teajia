import { expect, test, type Page } from './fixtures';

const products = [
  { id: 'bare-tea', type: 'Green', images: [] },
  { id: 'bare-pot', type: 'Teaware', images: [] },
  { id: 'single-photo-tea', type: 'Green', images: ['/leaf.jpg'] },
  { id: 'single-photo-pot', type: 'Teaware', images: ['/pot.jpg'] },
  { id: 'photographed-tea', type: 'Green', images: ['/leaf.jpg', '/cake.jpg', '/leaves.jpg'] },
  { id: 'pot', type: 'Teaware', images: ['/pot.jpg', '/base.jpg', '/side.jpg'] },
].map(({ id, type, images }) => ({
  id, type, slug: id, product_name: id, status: 'Active', stock_grams: 100, quantity_units: 1,
  image_url: images[0], additional_images: images.slice(1), tasting_notes: [],
}));

async function mockCatalog(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const match = products.find(product => path.endsWith('/products/' + product.id));
    const json = path.endsWith('/products/public') || path.endsWith('/products') ? products : match ?? [];
    return route.fulfill({ json });
  });
}

for (const width of [320, 390, 1280]) {
  test(`photo placement and sign-up return at ${width}px`, async ({ page }) => {
    await mockCatalog(page);
    await page.setViewportSize({ width, height: 850 });
    for (const product of products) {
      const href = `/shop/product/${product.slug}?store=the-test-shop#gallery`;
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      const add = page.getByRole('button', { name: /^Add your (own picture|photo)$/ });
      await expect(add).toHaveCount(1);
      await expect(add).toBeVisible();
      if (product.image_url) {
        await expect(add).toHaveAccessibleName('Add your photo');
        const placement = await add.evaluate(button => ({
          gallery: Boolean(button.closest('.alcove-gallery')),
          last: button.parentElement?.lastElementChild === button,
          besidePhoto: Array.from(button.parentElement?.querySelectorAll('img') ?? []).some(img => {
            const photo = img.getBoundingClientRect();
            const add = button.getBoundingClientRect();
            return photo.width > 0 && photo.right < add.left && photo.top < add.bottom && add.top < photo.bottom;
          }),
          width: button.clientWidth,
          height: button.clientHeight,
        }));
        expect(placement.gallery && placement.last && placement.besidePhoto).toBe(true);
        expect(placement.width).toBe(placement.height);
        expect(placement.width).toBeGreaterThanOrEqual(44);
      } else {
        await expect(page.locator('.alcove-gallery')).toHaveCount(0);
        await expect(add).toHaveText('+ Add your own picture');
        // With no photos at all, the add button stands where the photos would be,
        // above the facts box (Adrian, 2026-11-24).
        const inPhotoPlace = await add.evaluate(button => {
          const facts = document.querySelector('[data-testid="tea-facts"]');
          return Boolean(button.closest('.tea-product-photo-empty'))
            && (!facts || Boolean(button.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING));
        });
        expect(inPhotoPlace).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      }
      await add.click();
      await expect(page).toHaveURL(url => url.pathname === '/signup' && url.searchParams.get('returnTo') === href);
    }
  });
}

test('members can start a private photo upload from tea and teaware listings', async ({ page }) => {
  const claims = { sub: 'member-1', email: 'reader@example.test', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.sig`;
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await mockCatalog(page);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...claims, id: claims.sub, name: 'Reader' } }));
  await page.route('**/api/family/photographs', route => route.fulfill({ status: 201, json: {} }));

  for (const product of products.filter(p => !p.id.startsWith('single-photo'))) {
    await page.goto(`/shop/product/${product.id}?store=the-test-shop`);
    await expect(page.getByRole('button', { name: 'Reader' })).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^Add your (own picture|photo)$/ }).click();
    const upload = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/family/photographs');
    const png = await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1]);
    await (await chooser).setFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    const request = await upload;
    expect(request.headers().authorization).toBe(`Bearer ${token}`);
    const form = await new Response(request.postDataBuffer(), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
    expect(form.get('product_id')).toBe(product.id);
    expect(Array.from(form.keys()).sort()).toEqual(['full', 'product_id', 'small']);
  }
});
