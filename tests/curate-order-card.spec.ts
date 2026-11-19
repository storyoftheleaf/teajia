import { test, expect } from './fixtures';
import { installCompassHarness } from './helpers/compassHarness';

const supplier = { id: 'vendor-demo', name: 'Cloud Mountain Tea', tags: ['vendor'] };
const recordedAt = '2026-11-12T00:00:00Z';
const teas = [
  { id: 'demo-spring-oolong', name: 'Spring Oolong', type: 'Oolong', year: 2025, price: 240, grams: 750 },
  { id: 'demo-silver-needle', name: 'Silver Needle', type: 'White', year: 2024, price: 90, grams: 250 },
] as const;

const entries = teas.map(tea => ({
  id: tea.id, name: tea.name, category: 'tea', type: tea.type, form: 'Loose', year: tea.year,
  vendor_name: supplier.name, vendor_id: supplier.id, status: 'noted', draft_product_id: `stock-${tea.id}`,
  price_amount: tea.price, price_currency: 'Yuan', price_per_unit_grams: tea.grams,
  notes: '', photos: '[]', audio_clips: '[]', created_at: recordedAt, updated_at: recordedAt,
}));
const lines = teas.map(tea => ({
  id: `receipt-${tea.id}`, product_id: `stock-${tea.id}`, product_name: tea.name,
  expected_quantity: tea.grams, received_quantity: 0, cancelled_quantity: 0, unit: 'g', state: 'open',
}));
const items = teas.map(tea => ({
  id: tea.id, addedAt: recordedAt, name: tea.name, type: tea.type, form: 'Loose', year: tea.year,
  quantityGrams: tea.grams, pricePerUnit: tea.price / tea.grams, priceIsPerGram: true, currency: 'Yuan',
  productId: `stock-${tea.id}`, compassEntryId: tea.id, purchaseReceiptLineId: `receipt-${tea.id}`,
}));
const out = process.env.ORDER_REVIEW_OUTPUT;

for (const size of [{ width: 390, height: 844 }, { width: 1360, height: 900 }]) {
  test(`Library and Curate order reuse the same bands at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installCompassHarness(page, {
      compassEntries: entries,
      customers: [supplier],
      inventoryReceipts: [{ id: 'receipt-demo', state: 'open', lines }],
      purchaseOrders: [{ id: 'po-demo', vendor_name: supplier.name, vendor_id: supplier.id, display_currency: 'Yuan', items_json: JSON.stringify(items), status: 'confirmed' }],
      rates: [{ currency: 'Yuan', rate_to_usd: 7.1 }, { currency: 'USD', rate_to_usd: 1 }],
    });
    await page.route('**/api/logistics', route => route.fulfill({ json: {
      orders: [], services: [], addresses: [],
      shipments: [{
        id: 'shipment-demo', state: 'in_transit', dispatched_at: '2026-11-13 09:30:00', eta: '2026-11-19',
        lines: [{ id: 'shipment-line-demo', purchase_id: 'po-demo', receipt_line_id: lines[0].id, quantity: 750, received_quantity: 0 }],
      }],
    } }));
    await page.goto('/admin/compass?tab=library', { waitUntil: 'domcontentloaded' });
    const reference = page.getByTestId(`library-entry-${teas[0].id}`).filter({ visible: true }).first();
    await expect(reference).toBeVisible({ timeout: 30_000 });
    const bands = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('.library-card-title-row,.library-card-subrow,.library-workbar')].map(row => ({ height: row.offsetHeight, background: getComputedStyle(row).backgroundImage }));
    const referenceBands = await reference.evaluate(bands);
    await page.evaluate(() => document.fonts.ready);
    if (out) await page.screenshot({ path: `${out}/library-actual-${size.width}.png`, scale: 'css', animations: 'disabled' });
    await page.evaluate(async ({ items, supplier, recordedAt }) => {
      // @ts-expect-error Vite fixture import.
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      useLedgerStore.setState({ transactions: [{ id: 'order-demo', direction: 'purchase', counterpartyName: supplier.name,
        purchaseOrderId: 'po-demo', purchaseOrderReceiptId: 'receipt-demo', currency: 'Yuan', status: 'confirmed',
        items, photos: [], createdAt: recordedAt, updatedAt: recordedAt }] });
    }, { items, supplier, recordedAt });
    await page.getByRole('tab', { name: 'Orders', exact: true }).filter({ visible: true }).first().click();
    const order = page.getByTestId(`curate-order-line-${teas[0].id}`).filter({ visible: true });
    await expect(order.getByRole('link', { name: 'Open studio receipt', exact: true })).toHaveAttribute(
      'href', '/admin/purchase-orders?shipmentId=shipment-demo&receiptLineId=shipment-line-demo',
      { timeout: 20_000 },
    );
    const orderBands = await order.evaluate(bands);
    expect(orderBands).toEqual(referenceBands);
    await expect(order.getByRole('button', { name: 'Open Spring Oolong in Library' })).toBeVisible();
    await expect(order.getByRole('link', { name: 'Open Spring Oolong in Stock' })).toHaveAttribute('href', /panel=stock-demo-spring-oolong/);
    await expect(order.getByText('Shipped Nov 13 · Est. Nov 19 (~6 days)')).toBeVisible();
    const otherTea = page.getByTestId(`curate-order-line-${teas[1].id}`).filter({ visible: true });
    await expect(otherTea.getByRole('button', { name: 'Receive 250g' })).toBeVisible();
    await expect(otherTea.getByText('Awaiting arrival')).toBeVisible();
    await expect(otherTea.getByText(/Shipped|Est\./)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Record as sent' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    if (out) await page.screenshot({ path: `${out}/curate-order-${size.width}.png`, scale: 'css', animations: 'disabled' });
    await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'More order actions' }).click();
    const menu = page.getByRole('dialog', { name: 'Order actions' });
    for (const name of ['Add photo', 'Print tea tags', 'Share as PDF', 'Remove local order']) {
      await expect(menu.getByRole('button', { name })).toBeVisible();
    }
    if (out) await page.screenshot({ path: `${out}/curate-order-more-${size.width}.png`, scale: 'css', animations: 'disabled' });
    await menu.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(menu).toBeHidden();
  });
}
