import { expect, test } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'admin', email: 'operator@test', role: 'owner', active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }], exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`;

test('Stock reference cards resize and persist naming and photos, and continue an existing tasting', async ({ page }) => {
  test.setTimeout(120_000);
  const product = {
    id: 'tea-reference', product_name: 'Cloud Oolong', given_name: 'Cloud Oolong', type: 'Shou', form: 'Loose Leaf',
    origin_country: 'Taiwan', origin_region: 'Alishan', year: 2004, stock_grams: 100,
    is_sample: 1, low_stock_threshold: 200, cost_amount: 20, cost_currency: 'USD', quantity_purchased: 100,
    retail_price_per_gram_usd: .4, cost_per_gram_usd: .1, shipping_rate_per_kg: null,
    description: 'Floral tea', tasting_notes: [], image_url: '', additional_images: '[]', status: 'Active',
    is_public: 0, shown_in_shop: 0, can_reorder: 0, inventory_purpose: 'working', vendor: 'Cloud Mountain',
  };
  let failName = true;
  let failPricing = true;
  const writes: Record<string, unknown>[] = [];
  const uploads: string[] = [];
  await page.addInitScript(jwt => {
    for (const key of ['stock-preview-auth', 'stock-preview-columns-v1', 'stock-preview-source-group-v3']) sessionStorage.setItem(key, '1');
    localStorage.setItem('teajia_token', jwt);
    if (!sessionStorage.getItem('stock-reference-seeded')) {
      localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
        activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test shop', role: 'owner' }],
        inventoryColumns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'pricePerGramUSD', 'vendor', 'form'], inventoryGroupBy: 'vendor',
        tastingJournal: [{ id: 'journal-reference', accountId: 'acct', productId: 'tea-reference', productName: 'Cloud Oolong', productType: 'Oolong', createdAt: '2026-10-20T00:00:00.000Z', synced: true,
          note: { tasting: { notes: [{ id: 'note-reference', text: 'Orchid and warm stone', createdAt: '2026-10-20T00:00:00.000Z' }] }, updatedAt: '2026-10-20T00:00:00.000Z' },
          tastings: [{ id: 'tasting-reference', createdAt: '2026-10-20T00:00:00.000Z', tasting: {} }],
        }],
      } }));
      sessionStorage.setItem('stock-reference-seeded', '1');
    }
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { id: 'admin', email: 'operator@test', role: 'owner' } });
    if (path === '/api/auth/refresh') return route.fulfill({ json: { token } });
    if (path === '/api/products') return route.fulfill({ json: [product] });
    if (path === '/api/products/tea-reference' && request.method() === 'GET') return route.fulfill({ json: product });
    if (['/api/products/tea-reference/catalog', '/api/products/tea-reference/commercial'].includes(path) && request.method() === 'PUT') {
      const body = request.postDataJSON();
      writes.push(body);
      if ('given_name' in body && failName) { failName = false; return route.fulfill({ status: 500, json: { error: 'Name could not be saved' } }); }
      if ('quantity_purchased' in body && failPricing) { failPricing = false; return route.fulfill({ status: 500, json: { error: 'Pricing could not be saved' } }); }
      Object.assign(product, body);
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/upload-image') {
      uploads.push(request.postDataBuffer()?.toString() || '');
      return route.fulfill({ json: { url: 'https://media.teajia.com/stock-reference.jpg' } });
    }
    if (path === '/api/accounts/acct') return route.fulfill({ json: { id: 'acct', name: 'Test shop', default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' } });
    if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7 }] });
    if (path === '/api/compass/entries') return route.fulfill({ json: { entries: [] } });
    if (path === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    return route.fulfill({ json: [] });
  });

  await page.setViewportSize({ width: 767, height: 900 });
  await page.goto('/admin/stock');
  const row = page.locator('tr[data-product-id="tea-reference"]');
  await expect(row.locator('.stock-record')).toBeVisible({ timeout: 15_000 });
  await expect(row.locator('.stock-record')).toHaveAttribute('data-card-polish', '4');
  await expect(row.locator('.stock-workbar')).toHaveCSS('padding-bottom', '2px');
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(row.locator('.stock-record')).toHaveCount(0);
  await expect(page.getByTestId('inventory-column-row')).toBeVisible();
  await expect(row.locator('[data-stock-column=productName] [data-stock-inline-year]')).toHaveCount(0);
  await expect(row.locator('[data-stock-column=year]')).toContainText('2004');
  await expect(row.locator('[data-stock-column=stockGrams]')).toHaveCSS('text-align', 'right');
  await expect(row.getByRole('button', { name: 'House name for Cloud Oolong', exact: true })).toHaveText('Unnamed');
  const yearWidth = (await row.locator('[data-stock-column=year]').boundingBox())!.width;
  const stockWidth = (await row.locator('[data-stock-column=stockGrams]').boundingBox())!.width;
  expect((await row.locator('[data-stock-column=originRegion]').boundingBox())!.width).toBeGreaterThan(Math.max(yearWidth, stockWidth) * 2);
  await expect(page.getByTestId('inventory-column-row').locator('th')).toHaveText(['Product', 'Type', 'Year', 'Origin', 'Stock', 'Ship $/kg', 'Retail', 'Source', 'Leaf']);
  expect((await page.getByTestId('inventory-column-row').locator('th').last().boundingBox())!.x + (await page.getByTestId('inventory-column-row').locator('th').last().boundingBox())!.width).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row.locator('.stock-record')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(row.locator('.stock-quantity-edit .stock-number')).toHaveText('100');
  await expect(row.locator('.stock-figures')).not.toContainText('per');
  await row.locator('.stock-quantity-edit').click();
  await expect(page.getByRole('dialog', { name: 'Change stock: Cloud Oolong', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close stock movement', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('stock-phone.png') });

  const viewBar = page.getByTestId('inventory-purpose-row');
  await expect(viewBar.getByRole('combobox')).toHaveCount(4);
  await expect(viewBar).not.toContainText('Flagged');
  await viewBar.getByLabel('Show teas', { exact: true }).selectOption({ label: 'Shop stock' });
  await expect(viewBar.getByLabel('Show teas', { exact: true })).toHaveValue('default-forsale');
  await viewBar.getByLabel('Show teas', { exact: true }).selectOption({ label: 'All' });
  await page.getByRole('button', { name: 'View options', exact: true }).click();
  const viewSheet = page.getByRole('dialog', { name: 'View options', exact: true });
  await viewSheet.getByLabel('Group by', { exact: true }).selectOption('type');
  await viewSheet.getByLabel('Order by', { exact: true }).selectOption('year');
  await viewSheet.getByRole('button', { name: 'Descending', exact: false }).click();
  await expect(viewSheet.getByRole('button', { name: 'Descending', exact: false })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: test.info().outputPath('stock-view-options.png'), animations: 'disabled' });
  await viewSheet.getByRole('button', { name: 'Cost', exact: true }).click();
  await viewSheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(row.locator('.stock-figures')).toContainText('Cost / g');
  await expect(row.getByRole('button', { name: 'Source for Cloud Oolong: Cloud Mountain', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('stock-type-source.png') });
  await page.getByRole('button', { name: 'View options', exact: true }).click();
  await viewSheet.getByLabel('Group by', { exact: true }).selectOption('vendor');
  await viewSheet.getByRole('button', { name: 'Retail', exact: true }).click();
  await viewSheet.getByRole('button', { name: 'Close', exact: true }).click();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await viewBar.boundingBox())!.height).toBe(48);
    await expect(page.locator('[data-vaul-drawer][data-state="closed"]')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`stock-controls-${width}.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await row.getByRole('button', { name: 'More details for Cloud Oolong', exact: true }).click();
  await page.getByRole('button', { name: 'Delete tea', exact: true }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete this tea?', exact: true });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByRole('button', { name: 'Delete permanently', exact: true })).toBeDisabled();
  await deleteDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(deleteDialog).toHaveCount(0);
  const nameButton = row.getByRole('button', { name: 'Edit name for Cloud Oolong', exact: true });
  const nameBounds = (await nameButton.boundingBox())!;
  await nameButton.click({ position: { x: nameBounds.width - 4, y: 3 } });
  const nameSheet = page.getByRole('dialog', { name: 'Tea name', exact: true });
  await expect(nameSheet.getByRole('textbox', { name: 'Tea name', exact: true })).toHaveValue('Cloud Oolong');
  await nameSheet.getByRole('button', { name: 'Close', exact: true }).click();
  await row.getByRole('button', { name: 'Edit type for Cloud Oolong', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Form & pricing', exact: true }).getByRole('button', { name: 'Teaware', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Form & pricing', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  const form = row.getByRole('button', { name: 'Edit form and pricing for Cloud Oolong', exact: true });
  await expect(form).toHaveText('Loose leaf');
  await expect(row.getByText('Low stock', { exact: true })).toHaveCount(0);
  await expect(row.locator('select')).toHaveCount(0);
  await form.click();
  const formSheet = page.getByRole('dialog', { name: 'Form & pricing', exact: true });
  await formSheet.getByLabel('One piece / pack weighs · g', { exact: true }).click();
  await expect(formSheet).toBeVisible();
  await page.locator('[data-vaul-overlay]').click({ position: { x: 8, y: 8 } });
  await expect(formSheet).toHaveCount(0);
  await form.click();
  await expect(formSheet.locator('details')).toHaveCount(0);
  await expect(formSheet.getByRole('button', { name: 'Shou Puer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await formSheet.getByRole('button', { name: 'Shou Puer', exact: true }).click();
  await formSheet.getByRole('button', { name: 'Save form & pricing', exact: true }).click();
  await expect(formSheet).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Edit type for Cloud Oolong', exact: true })).toHaveText('Shou Puer');
  failPricing = true;
  await form.click();
  await formSheet.getByRole('button', { name: 'Red', exact: true }).click();
  await formSheet.getByRole('button', { name: 'Cake', exact: true }).click();
  await formSheet.getByLabel('One piece / pack weighs · g', { exact: true }).fill('357');
  await formSheet.getByLabel('Purchase cost · USD', { exact: true }).fill('5');
  await formSheet.getByLabel('Grams this cost bought', { exact: true }).fill('50');
  await expect(formSheet.getByText('On hand: 100 g.', { exact: true })).toBeVisible();
  await expect(formSheet.locator('dl')).toContainText('$0.34');
  await expect(formSheet.locator('dl')).toContainText('$120.11');
  await expect(formSheet.locator('dl')).toContainText('$62.05');
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 });
    const inputBounds = await formSheet.evaluate(root => ['Purchase cost · USD', 'Grams this cost bought'].map(label => {
      const input = root.querySelector(`input[aria-label="${label}"]`)!;
      const rect = input.getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    }));
    expect(inputBounds[0].y).toBe(inputBounds[1].y);
    expect(inputBounds[0].height).toBe(inputBounds[1].height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: test.info().outputPath(`stock-form-polish-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('stock-form-pricing.png') });
  await formSheet.getByRole('button', { name: 'Save form & pricing', exact: true }).click();
  await expect(formSheet.getByRole('alert')).toContainText('Pricing could not be saved');
  await expect(formSheet.getByLabel('Grams this cost bought', { exact: true })).toHaveValue('50');
  await formSheet.getByRole('button', { name: 'Save form & pricing', exact: true }).click();
  await expect(formSheet).toHaveCount(0);
  await expect(form).toHaveText('Cake · 357 g');
  expect(writes).toContainEqual({ type: 'Red', form: 'Cake', piece_weight_g: 357 });
  expect(writes).toContainEqual({ cost_amount: 5, quantity_purchased: 50 });
  expect(writes.some(write => 'stock_grams' in write || 'quantity_units' in write)).toBe(false);
  await page.reload();
  await expect(form).toHaveText('Cake · 357 g');
  await form.click();
  await expect(formSheet.getByLabel('Grams this cost bought', { exact: true })).toHaveValue('50');
  await expect(formSheet.getByText('On hand: 100 g.', { exact: true })).toBeVisible();
  await formSheet.getByRole('button', { name: 'Close', exact: true }).click();

  await row.getByRole('button', { name: 'Edit given name for Cloud Oolong', exact: true }).click();
  const nameDialog = page.getByRole('dialog', { name: 'Given name', exact: true });
  const input = nameDialog.getByRole('textbox', { name: 'Given name', exact: true });
  await expect(input).toHaveValue('');
  await input.pressSequentially('Moon over Alishan');
  await expect(input).toHaveValue('Moon over Alishan');
  await nameDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameDialog.getByRole('alert')).toContainText('Name could not be saved');
  await expect(input).toHaveValue('Moon over Alishan');
  await nameDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameDialog).toHaveCount(0);
  await expect(row.locator('.stock-given-name')).toHaveText('Moon over Alishan');
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 });
    await row.locator('.stock-given-name').hover();
    expect((await row.locator('.stock-record').boundingBox())!.height).toBeLessThan(145);
    const nameBounds = await row.locator('.stock-given-name').boundingBox();
    const formBounds = await row.locator('.stock-form-edit').boundingBox();
    expect(nameBounds!.x + nameBounds!.width).toBeLessThanOrEqual(formBounds!.x);
    await page.screenshot({ path: test.info().outputPath(`stock-slim-references-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(row.locator('.stock-given-name')).toHaveText('Moon over Alishan');
  expect(writes.filter(write => write.given_name === 'Moon over Alishan')).toHaveLength(2);

  await row.locator('.stock-camera-action').click();
  const photos = page.getByRole('dialog', { name: 'Photos', exact: true });
  await expect(photos.getByLabel('Take product photo')).toHaveAttribute('capture', 'environment');
  await expect(photos.getByLabel('Choose product photo')).not.toHaveAttribute('capture');
  const picker = page.waitForEvent('filechooser');
  await photos.getByRole('button', { name: 'Photo library', exact: true }).click();
  await (await picker).setFiles({ name: 'tea.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
  await expect(photos).toHaveCount(0);
  expect(uploads).toHaveLength(1);
  expect(writes.at(-1)).toEqual({ image_url: 'https://media.teajia.com/stock-reference.jpg' });
  await page.reload();
  await row.locator('.stock-camera-action').click();
  await expect(photos.getByRole('img', { name: 'Main photo', exact: true })).toBeVisible();
  await photos.getByRole('button', { name: 'Close', exact: true }).click();

  await row.getByRole('button', { name: 'Edit tasting for Cloud Oolong', exact: true }).click();
  await expect(page.getByText('Adding to your note for this tea.', { exact: true })).toBeVisible();
  await page.getByText(/^Earlier notes/).click();
  await expect(page.getByText('Orchid and warm stone', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('stock-existing-tasting.png') });
});
