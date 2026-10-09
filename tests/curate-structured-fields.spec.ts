import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const [tree, path] of [['Curate', '/admin/compass'], ['CurateV2', '/admin/compass/v2']] as const) {
  test(`${tree} stores sourcing facts in fields and keeps incomplete route prices local`, async ({ page }, testInfo) => {
    await installCompassHarness(page, { compassEntries: [{ id: 'structured-tea', account_id: 'acct-bali', name: 'LKY sample', type: 'Shou', category: 'tea', status: 'noted', notes: '', photos: '[]', audio_clips: '[]', created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }] });
    for (const [endpoint, body] of [['suggestions', { suggestions: [] }], ['todos', { todos: [] }], ['receipt-proposals', { proposals: [] }], ['drive', { files: [], folders: [] }]] as const) {
      await page.route(`**/api/curate/${endpoint}*`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
    }
    const privateReads: string[] = [];
    await page.route('**/api/curate/attachments?*', route => {
      const target = new URL(route.request().url()).searchParams;
      privateReads.push(target.get('entity_id') || '');
      const files = target.get('entity_type') === 'tea' && target.get('entity_id') === 'structured-tea'
        ? [{ id: 'agent-photo', filename: 'agent-leaf.png', role: 'leaf', mime_type: 'image/png' }] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files) });
    });
    await page.route('**/api/curate/attachments/agent-photo/content', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }));
    await page.goto(`${path}?entry=structured-tea`);
    if (tree === 'CurateV2') await page.getByRole('button', { name: 'Edit all fields', exact: true }).click();
    const tools = page.getByRole('region', { name: 'Files and change history' }).filter({ visible: true }).first();
    await expect(tools.getByRole('button', { name: /agent-leaf.png/ })).toBeVisible();
    await tools.getByRole('button', { name: 'View photo', exact: true }).click();
    await expect(tools.getByRole('img', { name: 'agent-leaf.png' })).toBeVisible();
    await tools.getByRole('button', { name: 'Hide photo', exact: true }).click();
    const section = page.getByTestId('structured-tea-fields').filter({ visible: true }).first();
    await section.getByText('Tea details & sourcing', { exact: true }).click();
    await section.getByLabel('Quoted age', { exact: true }).fill('About 20 years old');
    await section.getByLabel('Grade', { exact: true }).fill('Special');
    await section.getByLabel('Pack weight (g)', { exact: true }).fill('357');
    await section.getByLabel('Pack description', { exact: true }).fill('Cake');
    await section.getByLabel('Vendor item number', { exact: true }).fill('PE1');
    await section.getByLabel('Discount (%)', { exact: true }).fill('25');
    await section.getByLabel('Shop name', { exact: true }).fill('Lam Kie Yuen');
    await section.getByLabel('Shipping method', { exact: true }).fill('air');
    await section.getByRole('combobox', { name: 'Pu-erh processing', exact: true }).selectOption('Sheng');
    await section.getByRole('button', { name: 'Add route quote', exact: true }).click();
    const editor = section.getByRole('group', { name: 'Route quote editor' });
    await editor.getByRole('button', { name: 'Save route quote', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('enter the amount, currency and quantity');
    await expect(editor.getByLabel('Quoted amount', { exact: true })).toHaveValue('');
    await expect(editor.getByLabel('Quote currency', { exact: true })).toHaveValue('');
    await editor.getByRole('combobox', { name: 'Route', exact: true }).selectOption('air');
    await editor.getByLabel('Quote label', { exact: true }).fill('Hong Kong air');
    await editor.getByLabel('Quoted amount', { exact: true }).fill('0');
    await editor.getByLabel('Quote currency', { exact: true }).fill('HKD');
    await editor.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('kg');
    await editor.getByLabel('Basis quantity', { exact: true }).fill('1');
    await editor.getByRole('combobox', { name: 'Price includes', exact: true }).selectOption('landed');
    await editor.getByLabel('Destination', { exact: true }).fill('Bali');
    await editor.getByRole('button', { name: 'Save route quote', exact: true }).click();
    await expect(editor).toBeHidden();
    const saved = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are exposed by the local dev server.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().getEntry('structured-tea');
    });
    expect(saved).toMatchObject({ ageQuoted: 'About 20 years old', grade: 'Special', packSizeGrams: 357, packSizeLabel: 'Cake', vendorItemNumber: 'PE1', discountPercent: 25, shopName: 'Lam Kie Yuen', transportMode: 'air', type: 'Sheng', notes: '' });
    await expect(tools.getByRole('button', { name: /agent-leaf.png/ })).toBeVisible();
    expect(saved.routeQuotes).toEqual([expect.objectContaining({ label: 'Hong Kong air', amount: 0, currency: 'HKD', basis: 'kg', basis_quantity: 1, price_kind: 'landed', destination: 'Bali' })]);
    await section.getByLabel('Discount (%)', { exact: true }).fill('105');
    await section.getByLabel('Grade', { exact: true }).focus();
    await expect(section.getByRole('alert')).toContainText('from 0 to 100');
    await section.getByLabel('Discount (%)', { exact: true }).fill('0');
    await section.getByLabel('Quoted age', { exact: true }).fill('');
    await section.getByLabel('Grade', { exact: true }).focus();
    await section.getByRole('button', { name: 'Remove Hong Kong air quote' }).click();
    const cleared = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are exposed by the local dev server.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().getEntry('structured-tea');
    });
    expect(cleared).toMatchObject({ ageQuoted: null, discountPercent: 0, routeQuotes: [], notes: '' });
    await section.locator('summary').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/teajia-structured-${tree}-${testInfo.project.name.replace(/ /g, '-')}.png`, fullPage: true });
    const localId = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are exposed by the local dev server.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().startNewCapture('tea');
    });
    await expect(page.getByRole('region', { name: 'Files and change history' }).filter({ visible: true })).toHaveCount(0);
    expect(privateReads).not.toContain(localId);
    await expectNoUnhandledCompassApi(page);
  });
}
