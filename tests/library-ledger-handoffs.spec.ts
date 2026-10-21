import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi, compassCreatedProducts } from './helpers/compassHarness';

const entryId = 'ledger-source-tea';
const productId = 'linked-inventory-tea';
const entry = { id: entryId, name: 'Ledger Mountain Tea', category: 'tea', type: 'Sheng', form: 'Loose', year: 2024, vendor_name: 'Chen Family', vendor_id: 'vendor-chen', status: 'noted', draft_product_id: productId, price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100, notes: 'One source identity.', photos: '[]', audio_clips: '[]', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const product = { id: productId, account_id: 'acct-bali', source_compass_entry_id: entryId, product_name: entry.name, given_name: entry.name, type: 'Sheng', form: 'Loose', year: 2024, origin_country: 'China', stock_grams: 0, stock_known_at: '2026-10-01T00:00:00Z', cost_amount: 70, cost_currency: 'Yuan', cost_per_gram_usd: 0.1, retail_price_per_gram_usd: 0.3, status: 'Draft', inventory_purpose: 'working', vendor: 'Chen Family', is_public: 0, shown_in_shop: 0, can_reorder: 1, shipping_rate_per_kg: null };
const visible = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
async function ledgerState(page: Page) {
  return page.evaluate(async () => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
    return { account: useLedgerStore.getState().accountScopeId, transactions: useLedgerStore.getState().transactions };
  });
}
async function installPurchaseHarness(page: Page) {
  const holding = { ...product };
  await installCompassHarness(page, { compassEntries: [entry], products: [holding], rates: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7 }] });
  const proposals: Array<Record<string, any>> = [];
  const orders: Array<Record<string, any>> = [];
  let accepted = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/purchase-orders') orders.push(request.postDataJSON());
  });
  // These overrides fill existing harness gaps: real receipt creation resolves
  // the linked product, history includes accepted rows, and acceptance reuses it.
  await page.route(`**/api/compass/entries/${entryId}/receipt-proposals`, async route => {
    const input = route.request().postDataJSON();
    const found = proposals.find(proposal => proposal.idempotency_key === input.idempotency_key);
    const proposal = found ?? { ...input, id: `receipt-${proposals.length + 1}`, compass_entry_id: entryId, product_id: productId, status: 'pending', ledger_id: null, created_at: '2026-10-01T00:00:00Z' };
    if (!found) proposals.push(proposal);
    await route.fulfill({ status: found ? 200 : 201, json: proposal });
  });
  await page.route('**/api/curate/receipt-proposals*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/curate/receipt-proposals') return route.fallback();
    await route.fulfill({ json: { pending: proposals.filter(proposal => url.searchParams.get('include_closed') === '1' || proposal.status === 'pending') } });
  });
  await page.route('**/api/curate/receipt-proposals/*/accept', async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    const proposal = proposals.find(candidate => candidate.id === id)!;
    const alreadyAccepted = proposal.status === 'accepted';
    if (!alreadyAccepted) {
      holding.stock_grams += proposal.quantity;
      proposal.status = 'accepted'; proposal.ledger_id = `stock-${id}`;
      accepted += 1;
    }
    await route.fulfill({ json: { proposal, product_id: productId, ledger_id: proposal.ledger_id, alreadyAccepted } });
  });
  return { holding, proposals, orders, accepted: () => accepted };
}

test('phone Source draft, confirmation and explicit receipt preserve one tea identity', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const shop = await installPurchaseHarness(page);
  await openCompass(page);
  await expect.poll(() => page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return !!useTeaCompassStore.getState().getEntry(id);
  }, entryId)).toBe(true);
  await page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.getState().setActiveEntry(id);
  }, entryId);
  await expect(page.getByRole('textbox', { name: 'Tea name', exact: true })).toHaveValue(entry.name);
  await page.getByTestId('capture-action-footer').filter({ visible: true }).getByRole('button', { name: 'Buy', exact: true }).click();
  const quantity = page.getByRole('spinbutton', { name: 'Purchase quantity', exact: true }).filter({ visible: true });
  await expect(quantity).toBeVisible();
  await quantity.fill('250');
  await page.getByRole('button', { name: 'Add to Ledger', exact: true }).filter({ visible: true }).click();
  await expect.poll(async () => (await ledgerState(page)).transactions.length).toBe(1);
  const draft = (await ledgerState(page)).transactions[0];
  expect(draft.items).toHaveLength(1);
  expect(draft.items[0]).toMatchObject({ compassEntryId: entryId, productId, quantityGrams: 250 });
  expect((await ledgerState(page)).account).toBe('acct-bali');
  expect(shop.holding.stock_grams).toBe(0);
  expect(shop.proposals).toHaveLength(0);
  await page.getByRole('tab', { name: 'Ledger', exact: true }).click();
  await page.getByRole('button', { name: 'Purchase', exact: true }).filter({ visible: true }).click();
  await expect.poll(() => shop.orders.length).toBe(1);
  expect(JSON.parse(shop.orders[0].items_json)[0]).toMatchObject({ compass_entry_id: entryId, product_id: productId, quantity_grams: 250 });
  await expect.poll(() => shop.proposals.length).toBe(1);
  expect(shop.holding.stock_grams).toBe(0);
  expect(shop.accepted()).toBe(0);
  const receive = page.getByRole('button', { name: 'Receive 250g', exact: true });
  await expect(receive).toBeVisible();
  await page.screenshot({ path: '/private/tmp/library-ledger-phone-before-receive.png', fullPage: true, animations: 'disabled' });
  await receive.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => shop.accepted()).toBe(1);
  expect(shop.holding.stock_grams).toBe(250);
  await expect(receive).toHaveCount(0);
  await expect(page.getByText('250g received · 0g due', { exact: true }).filter({ visible: true })).toBeVisible();
  expect((await ledgerState(page)).transactions[0].items[0]).toMatchObject({ compassEntryId: entryId, productId, quantityGrams: 250 });
  expect(compassCreatedProducts(page)).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '/private/tmp/library-ledger-phone-received.png', fullPage: true, animations: 'disabled' });
  await expectNoUnhandledCompassApi(page);
});

test('phone Inventory reorder opens a draft linked to the existing product and source', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const shop = await installPurchaseHarness(page);
  shop.holding.stock_grams = 100;
  await page.goto(`/admin/stock?panel=${productId}`, { waitUntil: 'domcontentloaded' });
  const reorder = visible(page, 'inventory-reorder-ledger');
  await expect(reorder).toBeVisible({ timeout: 15_000 });
  await reorder.click();
  await expect(page).toHaveURL(/\/admin\/compass\?tab=ledger/);
  await expect(page.getByRole('tab', { name: 'Ledger', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await ledgerState(page)).transactions.length).toBe(1);
  const draft = (await ledgerState(page)).transactions[0];
  expect(draft.status).toBe('draft');
  expect(draft.items).toHaveLength(1);
  expect(draft.items[0]).toMatchObject({ compassEntryId: entryId, productId });
  expect(shop.holding.stock_grams).toBe(100);
  expect(shop.orders).toHaveLength(0);
  expect(shop.proposals).toHaveLength(0);
  expect(compassCreatedProducts(page)).toHaveLength(0);
  await page.screenshot({ path: '/private/tmp/library-inventory-reorder-phone.png', fullPage: true, animations: 'disabled' });
  await expectNoUnhandledCompassApi(page);
});
