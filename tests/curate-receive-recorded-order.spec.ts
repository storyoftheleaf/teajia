import { test, expect } from './fixtures';
import { installCompassHarness } from './helpers/compassHarness';

test('legacy Buying shows a partial receipt when the saved line id has no product id', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const recordedAt = '2026-11-12T00:00:00Z';
  const item = { id: 'silver-needle', addedAt: recordedAt, name: 'Silver Needle', type: 'White', form: 'Loose', year: 2024,
    quantityGrams: 250, pricePerUnit: 0.36, priceIsPerGram: true, currency: 'Yuan', compassEntryId: 'silver-needle', purchaseReceiptLineId: 'receipt-silver-needle' };
  await installCompassHarness(page, {
    compassEntries: [{ id: 'silver-needle', name: 'Silver Needle', category: 'tea', type: 'White', form: 'Loose', year: 2024,
      vendor_name: 'Cloud Mountain Tea', vendor_id: 'vendor-demo', status: 'noted', price_amount: 90, price_currency: 'Yuan', price_per_unit_grams: 250,
      notes: '', photos: '[]', audio_clips: '[]', created_at: recordedAt, updated_at: recordedAt }],
    customers: [{ id: 'vendor-demo', name: 'Cloud Mountain Tea', tags: ['vendor'] }],
    inventoryReceipts: [{ id: 'receipt-demo', state: 'partially_received', lines: [{ id: 'receipt-silver-needle', product_id: 'stock-silver-needle', product_name: 'Silver Needle', expected_quantity: 250, received_quantity: 100, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }],
    purchaseOrders: [{ id: 'po-demo', receipt_id: 'receipt-demo', vendor_name: 'Cloud Mountain Tea', vendor_id: 'vendor-demo', display_currency: 'Yuan', items_json: JSON.stringify([item]), status: 'confirmed' }],
    rates: [{ currency: 'Yuan', rate_to_usd: 7.1 }],
  });
  await page.goto('/admin/compass?tab=buying', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ item, recordedAt }) => {
    // @ts-expect-error Vite fixture import.
    const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
    useLedgerStore.setState({ transactions: [{ id: 'order-demo', direction: 'purchase', counterpartyName: 'Cloud Mountain Tea', purchaseOrderId: 'po-demo', purchaseOrderReceiptId: 'receipt-demo', currency: 'Yuan', status: 'confirmed', items: [item], photos: [], createdAt: recordedAt, updatedAt: recordedAt }] });
  }, { item, recordedAt });
  const card = page.getByTestId('curate-order-line-silver-needle').filter({ visible: true });
  await expect(card.getByText('Part received', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Receive 150g' })).toBeVisible();
  await page.screenshot({ path: 'test-results/fix3-legacy.png', scale: 'css', animations: 'disabled' });
});

const workerPurchaseRow = (receiptLineId: string) => ({
  id: 'po-v2', account_id: 'shop-owner', po_number: 'PO-V2', vendor_name: 'V2 Tea Works', vendor_id: 'vendor-v2', vendor_contact: null,
  items_json: JSON.stringify([{ client_line_id: 'local-v2', product_name: 'V2 Silver Needle', product_id: 'stock-v2', quantity: 100, unit: 'g', receipt_line_id: receiptLineId }]),
  total_usd: 14, display_currency: 'Yuan', status: 'ordered', message_text: null, notes: null, receipt_id: 'receipt-v2', create_request_key: 'ledger:fixture-v2',
  ship_mode: null, tracking_number: null, created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z',
});

async function installV2RecordedOrder(page: Parameters<typeof installCompassHarness>[0], receiptLineId: string) {
  const row = workerPurchaseRow(receiptLineId);
  expect(row.receipt_id).toBe('receipt-v2');
  expect(JSON.parse(row.items_json)[0].receipt_line_id).toBe(receiptLineId);
  await installCompassHarness(page, {
    compassEntries: [], customers: [{ id: 'vendor-v2', name: 'V2 Tea Works', tags: ['vendor'] }], purchaseOrders: [],
    inventoryReceipts: [{ id: 'receipt-v2', state: 'partially_received', source_kind: 'purchase_order', lines: [{ id: 'line-v2', product_id: 'stock-v2', product_name: 'V2 Silver Needle', expected_quantity: 100, received_quantity: 40, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }],
    rates: [{ currency: 'Yuan', rate_to_usd: 7.1 }],
  });
  await page.route('**/api/purchase-orders', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) });
  });
}

test('V2 Buying shows the known authoritative receipt line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installV2RecordedOrder(page, 'line-v2');
  await page.goto('/admin/compass/v2?tab=buying', { waitUntil: 'domcontentloaded' });
  const order = page.getByTestId('curate-shop-order').filter({ visible: true });
  await expect(order).toContainText('V2 Silver Needle: 40 g received · 60 g due');
  await page.screenshot({ path: 'test-results/fix3-v2-known.png', scale: 'css', animations: 'disabled' });
});

test('V2 Buying refuses product fallback after an explicit receipt-line mismatch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installV2RecordedOrder(page, 'wrong-line-v2');
  await page.goto('/admin/compass/v2?tab=buying', { waitUntil: 'domcontentloaded' });
  const order = page.getByTestId('curate-shop-order').filter({ visible: true });
  await expect(order).toContainText('V2 Silver Needle: Receipt unavailable');
  await expect(order).not.toContainText('40 g received');
  await expect(order.getByRole('button', { name: /Receive/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/fix3-v2-mismatch.png', scale: 'css', animations: 'disabled' });
});
