import { test, expect } from './fixtures';
import { installCompassHarness, COMPASS_TOKEN, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const selected of [false, true]) {
test(`private vendor files preview, authenticate download, and ${selected ? 'undo a selected change' : 'undo the last change'}`,  async ({ page }) => {
  await installCompassHarness(page);
  await page.route('**/api/customers/vendor-1', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'vendor-1', name: 'Private Vendor', tags: ['vendor'], contacts: [] }) }));
  for (const path of ['customers/vendor-1/products', 'customers/vendor-1/supplied-products', 'purchase-orders', 'inventory/receipts*']) await page.route(`**/api/${path}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/curate/quotes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  let files: any[] = [];
  let history: any[] = [];
  const uploadCalls: any[] = [];
  const correctionCalls: any[] = [];
  const undoCalls: any[] = [];
  const file = { id: 'attachment-1', filename: 'private-pricelist.pdf', role: 'pricelist', mime_type: 'application/pdf', size_bytes: 30 };
  const change = { entity_type: 'attachment', entity_id: file.id, before: { ...file }, after: null };
  await page.route('**/api/curate/attachments?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files) }));
  await page.route('**/api/curate/history?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history }) }));
  await page.route('**/api/curate/attachments', async route => {
    const input = route.request().postDataJSON(); uploadCalls.push(input);
    if (!input.confirm) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmation_token: 'upload-token', preview: { filename: file.filename, role: file.role, size_bytes: file.size_bytes } }) });
    expect(input.confirm).toBe('upload-token'); files = [file];
    history = [{ id: 'event-upload', agent_name: 'Test Admin', confirmed_at: '2026-10-08T00:00:00Z', records: [{ entity_type: 'attachment', entity_id: file.id, before_json: 'null', after_json: JSON.stringify(file) }] }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
  });
  await page.route('**/api/curate/attachments/attachment-1/content', async route => {
    const headers = route.request().headers();
    expect(headers.authorization).toBe(`Bearer ${COMPASS_TOKEN}`);
    expect(headers['x-teajia-account']).toBe('acct-bali');
    await route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="private-pricelist.pdf"' }, body: Buffer.from('%PDF-1.4\nprivate source') });
  });
  await page.route('**/api/curate/correct', async route => {
    const input = route.request().postDataJSON(); correctionCalls.push(input);
    if (!input.confirm) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmation_token: 'remove-token', preview: { changes: [change] } }) });
    expect(input.confirm).toBe('remove-token'); files = [];
    history.push({ id: 'event-remove', agent_name: 'Test Admin', confirmed_at: '2026-10-08T01:00:00Z', records: [{ entity_type: 'attachment', entity_id: file.id, before_json: JSON.stringify(file), after_json: 'null' }] });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
  });
  await page.route('**/api/curate/undo', async route => {
    const input = route.request().postDataJSON(); undoCalls.push(input);
    if (!input.confirm) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmation_token: 'undo-token', preview: { changes: [{ ...change, before: null, after: file }] } }) });
    expect(input.confirm).toBe('undo-token'); files = [file];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
  });
  await page.goto('/admin/vendors/vendor-1');
  const tools = page.getByRole('region', { name: 'Files and change history' });
  await expect(tools).toBeVisible();
  await tools.getByLabel('Choose file').setInputFiles({ name: file.filename, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nprivate source') });
  await tools.getByLabel('Attachment role').selectOption('pricelist');
  await tools.getByRole('button', { name: 'Preview attachment', exact: true }).click();
  const preview = tools.getByRole('region', { name: 'Confirm change' });
  await expect(preview).toContainText(file.filename);
  expect(files).toHaveLength(0);
  expect(uploadCalls[0]).toMatchObject({ entity_type: 'vendor', entity_id: 'vendor-1', filename: file.filename, role: 'pricelist' });
  expect(uploadCalls[0]).not.toHaveProperty('confirm');
  await preview.getByRole('button', { name: 'Confirm change', exact: true }).click();
  const link = tools.getByRole('button', { name: /private-pricelist.pdf/ });
  await expect(link).toBeVisible();
  const download = page.waitForEvent('download');
  await link.click();
  expect((await download).suggestedFilename()).toBe(file.filename);
  await tools.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(preview).toContainText('Remove this attachment?');
  expect(files).toHaveLength(1);
  await preview.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(link).toBeHidden();
  await tools.getByText('Change history (2)', { exact: true }).click();
  await expect(tools).toContainText('Test Admin');
  if (selected) await tools.locator('article').nth(1).getByRole('button', { name: 'Preview undo', exact: true }).click();
  else await tools.getByRole('button', { name: 'Preview undo of last shop change', exact: true }).click();
  await expect(preview).toContainText(selected ? 'Undo this change?' : 'Undo the last shop change?');
  expect(undoCalls[0].mutation_id).toBe(selected ? 'event-remove' : undefined);
  if (selected) {
    await expect(preview).toBeInViewport();
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate(el => el.clientWidth));
    await page.screenshot({ path: `/tmp/teajia-selected-undo-${test.info().project.name.replace(/ /g, '-')}.png`, fullPage: true });
  }
  expect(files).toHaveLength(0);
  await preview.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(link).toBeVisible();
  expect(correctionCalls).toHaveLength(2);
  expect(undoCalls).toHaveLength(2);
  await expectNoUnhandledCompassApi(page);
});

}
