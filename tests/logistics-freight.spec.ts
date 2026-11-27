import { expect, test } from './fixtures';
import { installCompassHarness } from './helpers/compassHarness';

// Every freight rate is typed in Logistics on the Purchases page and nowhere
// else (Adrian, 2026-11-27): the shop default sits with the services, and My
// suitcase is one tap that makes an ordinary free-by-the-kilo service.

test('Logistics holds the shop default and adds My suitcase as an ordinary service', async ({ page }, info) => {
  const today = new Date().toISOString();
  await installCompassHarness(page, { rates: [{ currency: 'USD', rate_to_usd: 1, last_updated: today }, { currency: 'Yuan', rate_to_usd: 7, last_updated: today }] });
  const account = { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', default_shipping_rate_per_kg: 85 as number | null, default_shipping_rate_currency: 'Yuan' };
  const services: Array<Record<string, unknown>> = [
    { id: 'air', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', name: 'Airmail', mode: 'air', basis: 'kg', rate: 85, currency: 'Yuan', active: true },
  ];
  const writes: Array<{ url: string; body: Record<string, unknown> }> = [];
  await page.route('**/api/purchase-orders/tracking', route => route.fulfill({ json: { rows: [] } }));
  await page.route('**/api/logistics', route => route.fulfill({ json: { orders: [], shipments: [], addresses: [], services } }));
  await page.route('**/api/logistics/services', async route => {
    const body = route.request().postDataJSON();
    writes.push({ url: '/api/logistics/services', body });
    const service = { id: `svc-${services.length + 1}`, ...body, active: true };
    services.push(service);
    await route.fulfill({ json: { service } });
  });
  await page.route('**/api/accounts/acct-bali', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      writes.push({ url: '/api/accounts/acct-bali', body });
      Object.assign(account, body);
    }
    await route.fulfill({ json: account });
  });

  await page.goto('/admin/purchase-orders');
  await page.getByRole('button', { name: 'Logistics services' }).click();
  const shopDefault = page.getByTestId('shop-freight-default');
  await expect(shopDefault).toContainText('Shop default');
  await expect(shopDefault).toContainText('85 Yuan/kg');

  // The shop default is edited here, and only its two freight columns are sent.
  await shopDefault.getByRole('button', { name: 'Edit shop default' }).click();
  await shopDefault.getByRole('textbox', { name: 'Shop default rate' }).fill('70');
  await expect(shopDefault).toContainText('$10.00 USD/kg today');
  await shopDefault.getByRole('button', { name: 'Save shop default' }).click();
  await expect(shopDefault).toContainText('70 Yuan/kg');
  expect(writes.find(w => w.url === '/api/accounts/acct-bali')?.body).toEqual({ default_shipping_rate_per_kg: 70, default_shipping_rate_currency: 'Yuan' });

  // My suitcase: a luggage contact, then a free service by the kilo, by air, in the shop's currency.
  await page.getByRole('button', { name: '+ My suitcase' }).click();
  await expect(page.locator('.logistics-service-row').filter({ hasText: 'My suitcase' })).toContainText('0 Yuan/kg');
  expect(writes.find(w => w.url === '/api/logistics/services')?.body).toMatchObject({ logistics_company_name: 'My luggage', name: 'My suitcase', mode: 'air', basis: 'kg', rate: 0, currency: 'Yuan' });
  await expect(page.getByRole('button', { name: '+ My suitcase' })).toHaveCount(0);

  // A new company takes two fields: its name and its rate. The rest defaults, behind More details.
  await page.getByRole('button', { name: '+ Logistics company' }).click();
  const add = page.getByRole('form', { name: 'Add a logistics company' });
  await expect(add.getByRole('combobox', { name: 'Service transport' })).toHaveCount(0);
  await expect(add).toContainText('By air, per kg, in Yuan.');
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath('add-logistics-company.png') });
  await add.getByRole('button', { name: 'Save' }).click();
  await expect(add.getByRole('alert')).toHaveText('Name the logistics company.');
  await add.getByRole('combobox', { name: 'Logistics company' }).fill('Keelung Sea Freight');
  await add.getByRole('textbox', { name: 'Service rate' }).fill('12');
  await add.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.logistics-service-row').filter({ hasText: 'Keelung Sea Freight' })).toContainText('12 Yuan/kg');
  expect(writes.filter(w => w.url === '/api/logistics/services').at(-1)?.body).toMatchObject({ logistics_company_name: 'Keelung Sea Freight', name: 'Air', mode: 'air', basis: 'kg', rate: 12, currency: 'Yuan' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('logistics-services.png') });
});

test('a service links to its orders, shipments and teas, and a link opens it again', async ({ page }, info) => {
  await installCompassHarness(page, { products: [{ id: 'velvet', product_name: 'Velvet Earth', type: 'Dark', stock_grams: 100, freight_service_id: 'air' }] });
  const line = { id: 'l1', product_id: 'velvet', product_name: 'Velvet Earth', unit: 'g', expected_quantity: 1000, received_quantity: 0, cancelled_quantity: 0, available_quantity: 400, original_cost_amount: null, original_cost_currency: null, image_url: null, source_url: null };
  const logistics = {
    orders: [{ purchase_id: 'po-chen', managed: true, receipt_id: 'r1', vendor_name: 'Chen Family', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', inbound_courier: null, inbound_tracking_number: null, logistics_arrived_at: '2026-11-20', lines: [line] }],
    shipments: [{ id: 'ship-1', service_id: 'air', service_quote: { id: 'air', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', name: 'Airmail', mode: 'air', basis: 'kg', rate: 85, currency: 'Yuan', active: true }, logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', mode: 'air', state: 'in_transit', outbound_courier: null, tracking_number: 'AIR-1', eta: '2026-12-04', created_at: '2026-11-25', dispatched_at: '2026-11-26', freight: null, freight_total: null, freight_estimated: true, freight_issue: null, lines: [{ id: 'sl1', shipment_id: 'ship-1', purchase_id: 'po-chen', receipt_line_id: 'l1', product_id: 'velvet', product_name: 'Velvet Earth', unit: 'g', quantity: 600, received_quantity: 0, weight_kg: 0.6, weight_estimated: true, volume_m3: null, volume_estimated: true }] }],
    addresses: [],
    services: [{ id: 'air', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', name: 'Airmail', mode: 'air', basis: 'kg', rate: 85, currency: 'Yuan', active: true }],
  };
  await page.route('**/api/purchase-orders/tracking', route => route.fulfill({ json: { rows: [] } }));
  await page.route('**/api/logistics', route => route.fulfill({ json: logistics }));
  await page.route('**/api/accounts/acct-bali', route => route.fulfill({ json: { id: 'acct-bali', default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' } }));

  // A link to a service opens the services with its connections showing.
  await page.goto('/admin/purchase-orders?serviceId=air');
  const links = page.getByTestId('service-connections-air');
  await expect(links).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.logistics-service-row').filter({ hasText: 'Airmail' })).toContainText('1 order, 1 shipment, 1 tea');
  await expect(links.getByRole('link', { name: 'Chen Family' })).toHaveAttribute('href', '/admin/purchase-orders?purchaseId=po-chen');
  await expect(links.getByRole('link', { name: 'On the way, due 2026-12-04' })).toHaveAttribute('href', '/admin/purchase-orders?shipmentId=ship-1');
  await expect(links.getByRole('link', { name: 'Velvet Earth' })).toHaveAttribute('href', '/admin/stock?panel=velvet');
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath('service-connections.png') });

  // Following the shipment link closes the panel and lands on the shipment, which links back.
  await links.getByRole('link', { name: 'On the way, due 2026-12-04' }).click();
  await expect(page).toHaveURL(/shipmentId=ship-1/);
  const card = page.locator('#shipment-card-ship-1');
  await expect(card.getByTestId('shipment-service-link')).toHaveAttribute('href', '/admin/purchase-orders?serviceId=air');
  await expect(card.getByRole('link', { name: 'Velvet Earth' })).toHaveAttribute('href', '/admin/stock?panel=velvet');
});
