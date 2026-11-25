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
