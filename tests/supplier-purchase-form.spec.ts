import { expect, test } from './fixtures';
import { installCompassHarness } from './helpers/compassHarness';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

test('saves edited quantities separately for an existing Stock item and a new one', async ({ page }, info) => {
  await installCompassHarness(page, {
    products: [{ id: 'spring-oolong', product_name: 'Spring Oolong', type: 'Oolong', stock_grams: 0, status: 'Draft' }],
  });
  await page.route('**/api/purchase-orders/tracking', route => route.fulfill({ json: { rows: [] } }));
  await page.route('**/api/logistics', route => route.fulfill({ json: { orders: [], shipments: [], services: [], addresses: [] } }));

  await page.goto('/admin/purchase-orders');
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  const form = page.getByRole('form', { name: 'Place a supplier order' });
  await form.getByLabel('Supplier', { exact: true }).selectOption('vendor-chen');
  const save = form.getByRole('button', { name: 'Save purchase draft' });

  await form.getByLabel('Stock item for line 1').selectOption({ label: 'Spring Oolong' });
  const grams = form.getByRole('spinbutton', { name: 'Ordered quantity for line 1' });
  await expect(grams).toHaveAttribute('placeholder', 'Enter');
  await grams.click();
  await expect(grams).toBeFocused();
  await grams.pressSequentially('12.5');
  await expect(grams).toHaveValue('12.5');

  await form.getByRole('button', { name: 'Add line item' }).click();
  const newStock = form.getByLabel('Stock item for line 2');
  await newStock.selectOption({ label: 'New item for Stock' });
  await expect(newStock).toHaveAccessibleDescription(/creates a private item in Stock.*after you confirm receipt/);
  const itemName = form.getByLabel('New Stock item name for line 2');
  await itemName.fill('Silver Needle');
  const newQuantity = form.getByRole('spinbutton', { name: 'Ordered quantity for line 2' });
  await newQuantity.fill('250');

  await grams.fill('750');
  await expect(newQuantity).toHaveValue('250');
  await expect(save).toBeInViewport();
  await grams.blur();
  await expect(form.getByRole('heading', { name: 'Spring Oolong', exact: true })).toBeInViewport();
  await expect(itemName).toBeInViewport();
  await page.locator('[data-supplier-order-sheet]').evaluate(el => el.querySelector('.overflow-y-auto')?.scrollTo({ top: 0 }));
  await page.screenshot({ path: info.outputPath('supplier-order-390.png'), animations: 'disabled' });

  await form.getByLabel('Unit for line 2').selectOption({ label: 'pcs' });
  await itemName.fill('Clay Tea Cup');
  await newQuantity.fill('2.5');
  await expect(form.getByText('Enter a whole number of pieces.')).toBeVisible();
  await expect(save).toBeDisabled();
  await newQuantity.fill('4');
  await expect(grams).toHaveValue('750');
  await grams.fill('750.5');
  await expect(newQuantity).toHaveValue('4');
  await expect(save).toBeEnabled();

  const posted = page.waitForRequest(request =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/purchase-orders');
  await save.click();
  const input = (await posted).postDataJSON();
  expect(input).toMatchObject({ vendor_name: 'Chen Family', status: 'pending' });
  expect(JSON.parse(input.items_json)).toEqual([
    { product_id: 'spring-oolong', product_name: 'Spring Oolong', quantity: 750.5, unit: 'g' },
    { product_name: 'Clay Tea Cup', quantity: 4, unit: 'unit' },
  ]);
  await expect(form).toBeHidden();
});
