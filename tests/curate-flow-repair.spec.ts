import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test.describe('Curate acquisition repair', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('saves a new quote before an explicit transfer receipt and resumes its failed review', async ({ page }, info) => {
    await installCompassHarness(page);
    const saved = new Set<string>();
    await page.route('**/api/compass/sync', async route => {
      for (const entry of route.request().postDataJSON().entries) saved.add(entry.id);
      await route.fallback();
    });
    let proposal: Record<string, unknown> | null = null;
    let attempts = 0;
    await page.route('**/api/curate/receipt-proposals?*', route => route.fulfill({ json: proposal ? [proposal] : [] }));
    await page.route('**/api/compass/entries/*/receipt-proposals', async route => {
      const entryId = new URL(route.request().url()).pathname.split('/')[4];
      expect(saved.has(entryId), 'receipt references an acknowledged encounter').toBe(true);
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 400, json: { error: 'Temporary receipt error. Retry your saved purchase.' } });
      proposal = { ...route.request().postDataJSON(), id: `proposal-${entryId}`, account_id: 'acct-bali', compass_entry_id: entryId, status: 'pending' };
      return route.fallback();
    });
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Receipt retry tea');
    await page.getByLabel('Currency', { exact: true }).filter({ visible: true }).selectOption('Yuan');
    await page.getByLabel('Price', { exact: true }).filter({ visible: true }).fill('100');
    await page.getByRole('spinbutton', { name: 'Grams', exact: true }).filter({ visible: true }).fill('100');
    await page.getByRole('button', { name: 'Buy', exact: true }).filter({ visible: true }).first().click();
    await page.getByLabel('Purchase quantity').filter({ visible: true }).fill('250');
    await page.getByLabel('Acquisition', { exact: true }).filter({ visible: true }).selectOption('transfer');
    await page.getByRole('button', { name: 'Add to Ledger', exact: true }).filter({ visible: true }).click();
    await expect(page.getByText('Temporary receipt error. Retry your saved purchase.').filter({ visible: true })).toBeVisible();
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toHaveValue('Receipt retry tea');
    await page.getByRole('button', { name: 'Retry receipt', exact: true }).filter({ visible: true }).click();
    await expect(page.getByText('Inventory changes only after you accept this receipt.').filter({ visible: true })).toBeVisible();
    expect(attempts).toBe(2);
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import used by the browser harness.
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      const tx = useLedgerStore.getState().transactions[0];
      return { account: useLedgerStore.getState().accountScopeId, lines: tx.items.length, pricePerGram: tx.items[0].pricePerUnit, grams: tx.items[0].quantityGrams, proposalId: tx.items[0].receiptProposal.id };
    })).toEqual({ account: 'acct-bali', lines: 1, pricePerGram: 1, grams: 250, proposalId: expect.stringMatching(/^proposal-/) });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Edit details for Receipt retry tea', exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: 'Want', exact: true })).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Tea details', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await expect(page.getByText('Inventory changes only after you accept this receipt.').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Accept into Inventory', exact: true }).filter({ visible: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('resumed-receipt.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Accept into Inventory', exact: true }).filter({ visible: true }).click();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import used by the browser harness.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source import used by the browser harness.
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      return { product: useTeaCompassStore.getState().entries.find((entry: { name: string }) => entry.name === 'Receipt retry tea').draftProductId,
        pending: useLedgerStore.getState().transactions.flatMap((tx: { items: unknown[] }) => tx.items).filter((item: { receiptProposal?: unknown }) => item.receiptProposal).length };
    })).toEqual({ product: expect.stringMatching(/^product-/), pending: 0 });
  });

  test('retains a failed purchase confirmation and retries the same dollar-denominated order', async ({ page }) => {
    await installCompassHarness(page);
    await page.route('**/api/rates', route => route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 5 }] }));
    const requests: Array<{ request_id?: string; idempotency_key?: string; total_usd: number }> = [];
    await page.route('**/api/purchase-orders', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) return route.fulfill({ status: 400, json: { error: 'Shop could not confirm. Draft kept.' } });
      return route.fulfill({ json: { id: 'confirmed-po' } });
    });
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite source import used by the browser harness.
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      const ledger = useLedgerStore.getState();
      const id = ledger.getOrCreatePurchaseTransaction('Repair vendor', 'Yuan');
      ledger.addLineItem(id, { name: 'Quoted tea', pricePerUnit: 1, priceIsPerGram: true, quantityGrams: 250, currency: 'Yuan' });
    });
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click();
    await page.getByRole('button', { name: 'Purchase', exact: true }).click();
    await expect(page.getByText('Shop could not confirm. Draft kept.', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry confirmation', exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retry confirmation', exact: true }).filter({ visible: true }).click();
    await expect(page.getByText('Confirmed', { exact: true }).filter({ visible: true })).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0].request_id || requests[0].idempotency_key).toBe(requests[1].request_id || requests[1].idempotency_key);
    expect(requests[0].request_id || requests[0].idempotency_key).toBeTruthy();
    expect(requests.map(request => request.total_usd)).toEqual([50, 50]);
  });

  test('changes the visible purchase draft with the active shop', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    const result = await page.evaluate(async () => {
      // @ts-expect-error Vite source import used by the browser harness.
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      const ledger = useLedgerStore.getState();
      ledger.switchAccount('acct-bali');
      const bali = ledger.getOrCreatePurchaseTransaction('Same vendor', 'Yuan', 'vendor-a');
      ledger.switchAccount('acct-empty');
      const empty = useLedgerStore.getState().transactions.length;
      const other = ledger.getOrCreatePurchaseTransaction('Same vendor', 'USD', 'vendor-b');
      ledger.switchAccount('acct-bali');
      return { empty, bali, other, visible: useLedgerStore.getState().transactions.map((tx: { id: string }) => tx.id) };
    });
    expect(result.empty).toBe(0);
    expect(result.bali).not.toBe(result.other);
    expect(result.visible).toEqual([result.bali]);
  });
});
