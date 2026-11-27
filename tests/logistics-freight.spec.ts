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
  await page.getByRole('button', { name: 'Shipping rates' }).click();
  await expect(page).toHaveURL(/rates=open/);
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
  await expect(page.locator('.journey-card').filter({ hasText: 'My suitcase' })).toContainText('0 Yuan/kg');
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
  await expect(page.locator('.journey-card').filter({ hasText: 'Keelung Sea Freight' })).toContainText('12 Yuan/kg');
  expect(writes.filter(w => w.url === '/api/logistics/services').at(-1)?.body).toMatchObject({ logistics_company_name: 'Keelung Sea Freight', name: 'Air', mode: 'air', basis: 'kg', rate: 12, currency: 'Yuan' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('logistics-services.png') });
});

test('"shop default" on a tea opens Shipping rates with the shop default form ready (Adrian, 2026-11-27)', async ({ page }, info) => {
  const today = new Date().toISOString();
  await installCompassHarness(page, {
    rates: [{ currency: 'USD', rate_to_usd: 1, last_updated: today }, { currency: 'Yuan', rate_to_usd: 7, last_updated: today }],
    products: [{ id: 'aged', product_name: 'Aged Shui Xian', type: 'Oolong', stock_grams: 100, shipping_rate_per_kg: 12 }],
  });
  const services = [{ id: 'air', logistics_company_id: 'gz', logistics_company_name: 'Guangzhou Forwarder', name: 'Airmail', mode: 'air', basis: 'kg', rate: 60, currency: 'Yuan', active: true }];
  const proposal = (id: string, vendor: string, name: string, quantity: number, state: string) => ({ id: `proposal:${id}`, purchase: null, receipt: null, invoice_draft: null, history: [], source_document: null,
    attention: [{ code: 'legacy_arrival', message: 'On the way.' }],
    arrival_proposal: { id, vendor_name: vendor, tea_name: name, quantity, unit: 'g', acquisition_state: state, compass_entry_id: `entry-${id}`, status: 'pending' } });
  await page.route('**/api/purchase-orders/tracking', route => route.fulfill({ json: { rows: [
    proposal('a', 'Jingpintang', '30-Year Aged Fenghuang Shui Xian', 1400, 'in_transit'),
    proposal('b', 'Jingpintang', '12-Year Aged Baxian Young Twig', 500, 'in_transit'),
    proposal('c', 'Lao Tongzhi Puer', 'Wuliang Mountain Ripe', 1071, 'ordered'),
  ] } }));
  await page.route('**/api/logistics', route => route.fulfill({ json: { orders: [], shipments: [], addresses: [], services } }));
  await page.route('**/api/accounts/acct-bali', route => route.fulfill({ json: { id: 'acct-bali', default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' } }));

  await page.goto('/admin/purchase-orders');
  const arrivals = page.getByTestId('arrivals-on-the-way');
  await expect(arrivals).toContainText('On the way, not yet in stock', { timeout: 20_000 });
  await expect(arrivals.getByRole('link', { name: '30-Year Aged Fenghuang Shui Xian' })).toHaveAttribute('href', '/admin/compass?entry=entry-a');
  await expect(page.getByText('agent review')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shipping rates' })).toContainText('85 Yuan/kg');
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('purchases-on-the-way.png') });

  await page.goto('/admin/purchase-orders?serviceId=shop');
  const shopDefault = page.getByTestId('shop-freight-default');
  await expect(shopDefault.getByRole('textbox', { name: 'Shop default rate' })).toHaveValue('85', { timeout: 20_000 });
  await expect(page.getByTestId('shipping-rates-rule')).toContainText('Every tea pays the shop default');
  await expect(page.getByTestId('teas-with-own-rate')).toContainText('Aged Shui Xian');
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('shipping-rates-shop-default.png') });
  // Back closes it: the panel is a step in the address.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).not.toHaveURL(/serviceId/);
});

test('a service links to its orders, shipments and teas, and a link opens it again', async ({ page }, info) => {
  await installCompassHarness(page, { products: [{ id: 'velvet', product_name: 'Velvet Earth', type: 'Dark', stock_grams: 100, freight_service_id: 'air' }, { id: 'forest', product_name: 'Forest Gate', type: 'Sheng', year: 2006, stock_grams: 357 }] });
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
  const card = page.getByTestId('service-journey-air');
  await expect(card).toBeVisible({ timeout: 20_000 });
  // The journey track: ordered, at the forwarder, on the way, arrived; it opens on what is on the way.
  const stages = card.getByRole('group', { name: 'Airmail journey' }).getByRole('button');
  await expect(stages).toHaveText([/Ordered0/, /At Guangzhou Forwarder1Chen Family/, /On the way1Due 4 Dec/, /Arrived0/]);
  await expect(stages.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByTestId('journey-items-on_the_way').getByRole('link', { name: /Due 4 Dec/ })).toHaveAttribute('href', '/admin/purchase-orders?shipmentId=ship-1');
  await expect(card.getByRole('link', { name: 'Velvet Earth' })).toHaveAttribute('href', '/admin/stock?panel=velvet');
  // A tea is added to a service by hand, by name, right on its card.
  const saved = page.waitForRequest(r => r.url().includes('/api/products/forest/commercial') && r.method() === 'PUT');
  await page.route('**/api/products/forest/commercial', r => r.fulfill({ json: { success: true } }));
  await card.getByRole('button', { name: '+ Add tea' }).click();
  const add = card.getByRole('form', { name: 'Add a tea to Airmail' });
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(add.getByRole('alert')).toHaveText('Type a tea name.');
  await add.getByRole('combobox', { name: 'Tea to add' }).fill('Forest Gate 2006');
  await page.waitForTimeout(400);
  await page.screenshot({ path: info.outputPath('add-tea.png') });
  await add.getByRole('button', { name: 'Add' }).click();
  expect((await saved).postDataJSON()).toEqual({ freight_service_id: 'air' });
  await stages.nth(1).click();
  await expect(card.getByTestId('journey-items-at_forwarder').getByRole('link', { name: 'Chen Family' })).toHaveAttribute('href', '/admin/purchase-orders?purchaseId=po-chen');
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath('service-connections.png') });
  await stages.nth(2).click();
  const links = card.getByTestId('journey-items-on_the_way');

  // Following the shipment link closes the panel and lands on the shipment, which links back.
  await links.getByRole('link', { name: /Due 4 Dec/ }).click();
  await expect(page).toHaveURL(/shipmentId=ship-1/);
  const shipmentCard = page.locator('#shipment-card-ship-1');
  await expect(shipmentCard.getByTestId('shipment-service-link')).toHaveAttribute('href', '/admin/purchase-orders?serviceId=air');
  await expect(shipmentCard.getByRole('link', { name: 'Velvet Earth' })).toHaveAttribute('href', '/admin/stock?panel=velvet');
});
