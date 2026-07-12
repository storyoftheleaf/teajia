import { expect, test, type Page } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

type ImportItem = {
  id: string; batch_id: string; source_id: string; position: number; category: 'tea' | 'teaware';
  name: string | null; raw_text: string; parsed_data: Record<string, unknown>; confidence: number;
  uncertainty: Record<string, unknown>; review_state: 'pending' | 'accepted' | 'merged';
  compass_entry_id: string | null; reserved_compass_entry_id: string;
};

async function installImportApi(page: Page) {
  let attempts = 0;
  const items: ImportItem[] = [];
  await page.route('**/api/curate/imports**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'POST' && path === '/api/curate/imports') {
      attempts += 1;
      const body = request.postDataJSON() as { title: string; pasted_text?: string; source_kind: string; items?: ImportItem[] };
      if (body.pasted_text?.includes('RETRY') && attempts === 1) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Parser unavailable' }) });
      }
      const lines = body.items?.length
        ? body.items.map(item => item.raw_text)
        : (body.pasted_text || '').split('\n').filter(Boolean);
      items.splice(0, items.length, ...lines.map((line, position) => ({
        id: `item-${position}`, batch_id: 'batch-1', source_id: 'source-1', position,
        category: line.toLowerCase().includes('pot') ? 'teaware' : 'tea', name: line.replace(/^\?\s*/, '').split(/[-—]/)[0].trim(),
        raw_text: line, parsed_data: { name: line.replace(/^\?\s*/, '').split(/[-—]/)[0].trim() },
        confidence: line.startsWith('?') ? 0.42 : 0.94,
        uncertainty: line.startsWith('?') ? { name: 'Could be a transliteration' } : {},
        review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `compass-${position}`,
      })));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        batch: { id: 'batch-1', title: body.title, review_state: 'pending', journey_id: null, visit_id: null },
        sources: [{ id: 'source-1', batch_id: 'batch-1', kind: body.source_kind, pasted_text: body.pasted_text || null, r2_object_key: null, metadata: {} }], items,
      }) });
    }
    const itemMatch = path.match(/\/items\/(item-\d+)\/(accept|merge)$/);
    if (method === 'POST' && itemMatch) {
      const item = items.find(candidate => candidate.id === itemMatch[1])!;
      item.review_state = itemMatch[2] === 'accept' ? 'accepted' : 'merged';
      item.compass_entry_id = item.reserved_compass_entry_id;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
    }
    return route.fallback();
  });
}

test.describe('Curate Import panel', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await installImportApi(page);
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens as a temporary modal, traps focus, and restores the unchanged tea draft', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true });
    await name.fill('Field tea');
    const trigger = page.getByRole('button', { name: 'Import' }).first();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('button').filter({ hasText: 'Add files or invoices' })).toBeFocused();
    await page.getByRole('button', { name: 'Close Import' }).click();
    await expect(trigger).toBeFocused();
    await expect(name).toHaveValue('Field tea');
  });

  test('accepts pasted fragments with parsing, textual uncertainty, merge, one/all review, and deferred batch chip', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill('Ali Shan — 600 TWD\n? Red Jade\nClay pot — 2 units');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Parsing your evidence…')).toBeVisible();
    await expect(page.getByText('Could be a transliteration')).toBeVisible();
    await page.getByRole('button', { name: /^Ali Shan/ }).click();
    await page.getByRole('button', { name: 'Merge Ali Shan' }).click();
    await page.getByRole('button', { name: 'Accept Red Jade' }).click();
    await expect(page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true })).toHaveValue('Red Jade');
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByRole('button', { name: 'Accept all remaining' }).click();
    await page.getByRole('button', { name: 'Review later' }).click();
    await expect(page.getByRole('button', { name: /Imported list: 3 items, 3 reviewed, 0 remaining/ })).toBeVisible();
  });

  test('supports photo, document, and invoice evidence plus retry after parsing failure', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await expect(page.getByLabel('Add photos')).toHaveAttribute('accept', /image/);
    await expect(page.getByLabel('Add files or invoices')).toHaveAttribute('accept', /pdf/);
    await page.getByLabel('Add photos').setInputFiles({ name: 'vendor-board.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await expect(page.getByText('vendor-board.jpg')).toBeVisible();
    await expect(page.getByText('invoice.pdf')).toBeVisible();
    await page.getByLabel('Paste a list or invoice text').fill('RETRY tea');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Parser unavailable')).toBeVisible();
    await page.getByRole('button', { name: 'Retry import' }).click();
    await expect(page.getByText('RETRY tea', { exact: false })).toBeVisible();
  });

  test('keeps a 30-item batch grouped instead of flooding the capture session', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill(Array.from({ length: 30 }, (_, index) => `Tea ${index + 1}`).join('\n'));
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('30 items to review')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(10);
    await page.getByRole('button', { name: 'Show 10 more' }).click();
    await expect(page.getByTestId('import-item-row')).toHaveCount(20);
  });
});
