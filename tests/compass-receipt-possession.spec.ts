import { test, expect } from '@playwright/test';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('free 10g sample defaults to reviewed sample receipt and only accept changes Inventory', async ({ page }) => {
  await installCompassHarness(page);
  let proposed: any;
  let accepted = false;
  await page.route('**/api/compass/entries/sample-entry/receipt-proposals', async route => {
    proposed = route.request().postDataJSON();
    await route.fulfill({ json: { id: 'proposal-1', account_id: 'acct-bali', compass_entry_id: 'sample-entry', status: 'pending', created_at: '', updated_at: '', proposed_by_user_id: 'test', ...proposed } });
  });
  await page.route('**/api/curate/receipt-proposals/proposal-1/accept', async route => {
    accepted = true;
    await route.fulfill({ json: { proposal: { id: 'proposal-1', status: 'accepted' }, product_id: 'product-1', ledger_id: 'ledger-1', alreadyAccepted: false } });
  });
  await openCompass(page);
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
    const entry = { ...createEmptyEntry('tea'), id: 'sample-entry', name: 'Free sample', sampleState: 'received', isSample: true, status: 'noted' };
    useTeaCompassStore.setState({ entries: [entry], pendingEntries: [], activeEntryId: 'sample-entry' });
  });
  await expect(page.getByRole('button', { name: /Buy/ }).last()).toBeVisible();
  await page.getByRole('button', { name: /Buy/ }).last().click();
  await expect(page.getByLabel('Inventory purpose')).toHaveValue('sample');
  await expect(page.getByLabel('Acquisition')).toHaveValue('free_sample');
  await page.getByRole('spinbutton').last().fill('10');
  await page.getByRole('button', { name: 'Add to Ledger' }).click();
  await expect(page.getByText('Inventory changes only after you accept this receipt.')).toBeVisible();
  expect(proposed).toMatchObject({ purpose: 'sample', acquisition_kind: 'free_sample', quantity: 10, unit: 'g' });
  expect(accepted).toBe(false);
  expect(await page.evaluate(async () => (await import('/src/lib/teaCompassStore.ts')).useTeaCompassStore.getState().entries[0].status)).toBe('noted');
  await page.getByRole('button', { name: 'Accept into Inventory' }).click();
  expect(accepted).toBe(true);
});

test('Library possession filters use linked Inventory purpose, never legacy status', async ({ page }) => {
  await installCompassHarness(page, { products: [
    { id: 'w', source_compass_entry_id: 'working', inventory_purpose: 'working' },
    { id: 's', source_compass_entry_id: 'sample', inventory_purpose: 'sample' },
    { id: 'p', source_compass_entry_id: 'personal', inventory_purpose: 'personal' },
  ] });
  await openCompass(page);
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
    useTeaCompassStore.setState({ entries: ['working', 'sample', 'personal', 'none'].map((id) => ({ ...createEmptyEntry('tea'), id, name: id, status: id === 'none' ? 'in_stock' : 'noted', synced: true })), pendingEntries: [] });
  });
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Filter/ }).click();
  await page.getByLabel('Possession').selectOption('none');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('span:visible').filter({ hasText: /^none$/ })).toBeVisible();
  await expect(page.getByText('working', { exact: true })).toHaveCount(0);
});

test('retrying a failed receipt proposal keeps exactly one local purchase line', async ({ page }) => {
  await installCompassHarness(page);
  let attempts = 0;
  await page.route('**/api/compass/entries/retry-entry/receipt-proposals', async route => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Temporary failure' } });
    return route.fulfill({ json: { id: 'proposal-retry', account_id: 'acct-bali', compass_entry_id: 'retry-entry', status: 'pending', created_at: '', updated_at: '', proposed_by_user_id: 'test', ...route.request().postDataJSON() } });
  });
  await openCompass(page);
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
    const entry = { ...createEmptyEntry('tea'), id: 'retry-entry', name: 'Retry tea', status: 'noted' };
    useTeaCompassStore.setState({ entries: [entry], pendingEntries: [], activeEntryId: entry.id });
  });
  await page.getByRole('button', { name: /Buy/ }).last().click();
  await page.getByRole('button', { name: 'Add to Ledger' }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary failure');
  await page.getByRole('button', { name: 'Retry receipt' }).click();
  await expect(page.getByText('Inventory changes only after you accept this receipt.')).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.evaluate(async () => {
    const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
    return useLedgerStore.getState().transactions.flatMap((transaction) => transaction.items)
      .filter((item) => item.compassEntryId === 'retry-entry').length;
  })).toBe(1);
});

test('unbagging clears both sample representations', async ({ page }) => {
  await installCompassHarness(page, { sampleCart: [{ id: 'bagged-entry', name: 'Bagged tea', compassEntryId: 'bagged-entry' }] });
  await openCompass(page);
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
    const entry = { ...createEmptyEntry('tea'), id: 'bagged-entry', name: 'Bagged tea', isSample: true, sampleState: 'requested', status: 'noted' };
    useTeaCompassStore.setState({ entries: [entry], pendingEntries: [], activeEntryId: entry.id });
  });
  await page.getByRole('button', { name: 'Bagged' }).filter({ visible: true }).first().click();
  expect(await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { entryIsSample } = await import('/src/components/TeaCompass/types.ts');
    const entry = useTeaCompassStore.getState().getEntry('bagged-entry')!;
    return { isSample: entry.isSample, sampleState: entry.sampleState, entryIsSample: entryIsSample(entry) };
  })).toEqual({ isSample: false, sampleState: null, entryIsSample: false });
});
