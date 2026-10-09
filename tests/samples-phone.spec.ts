/**
 * Samples on the phone look and work like Stock: grouped by supplier, one slim
 * row per tea, a sheet on tap. − logs a tasting (5 g already typed), tapping the
 * grams weighs the portion, and Save sends the change and confirms it.
 */

import { test, expect, type Page } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/samples-phone');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

async function openSamples(page: Page) {
  // Samples is a view of the one Stock list, picked from the same menu as Working or Personal.
  await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Choose which teas to show/ }).click();
  await page.getByRole('menuitem', { name: 'Samples', exact: true }).click();
}

const HOLDINGS = [
  {
    entry: { id: 'tea-a', name: '1958 Aged Raw', type: 'Sheng Puer', year: 1958, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: 900, price_currency: 'Yuan' },
    stock_grams: 0, sample_grams: 25,
    samples: [{ id: 'portion-a', name: '', grams: 25, status: 'received', compass_entry_id: 'tea-a' }],
  },
  {
    entry: { id: 'tea-b', name: 'Wild Moonlight', type: 'White', year: 2019, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: null, price_currency: null },
    stock_grams: 0, sample_grams: null,
    samples: [{ id: 'portion-b', name: '', grams: null, status: 'received', compass_entry_id: 'tea-b' }],
  },
];

test.describe('Samples on the phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockInventoryApi(page);
    await page.route('**/api/curate/holdings**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HOLDINGS) }));
  });

  test('looks like Stock: grouped by supplier, slim rows, sample grams in a column', async ({ page }) => {
    await openSamples(page);
    const list = page.getByTestId('samples-phone');
    await expect(list.getByRole('region', { name: 'Boyuan Tea Shop' })).toContainText('2 samples');
    await expect(list.getByRole('button', { name: /^1958 Aged Raw/ })).toContainText('25');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    await shot(page, 'list');
  });

  test('Samples is a view of the Stock list: no separate bar, same headings, Kind regroups', async ({ page }) => {
    await openSamples(page);
    await expect(page.getByRole('button', { name: 'Samples only' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: /Stock/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Showing Samples/ })).toContainText('2');
    await expect(page.getByRole('button', { name: 'Kind', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier', exact: true })).toBeVisible();
    const list = page.getByTestId('samples-phone');
    await expect(list.getByRole('region', { name: 'Boyuan Tea Shop' })).toBeVisible();
    await page.getByRole('button', { name: 'Kind', exact: true }).click();
    await expect(list.getByRole('region', { name: 'Sheng Puer' })).toBeVisible();
    await expect(list.getByRole('region', { name: 'White' })).toBeVisible();
    await page.getByRole('button', { name: 'Supplier', exact: true }).click();
    await shot(page, 'same-page');
  });

  test('minus logs a tasting with 5 g ready, and Save confirms it', async ({ page }) => {
    const calls: Array<{ command: Record<string, unknown>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, unknown>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok-1', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^1958 Aged Raw/ }).click();
    const sheet = page.getByRole('region', { name: /1958 Aged Raw, at a glance/ });
    await sheet.getByRole('button', { name: /Log a tasting/ }).click();
    const box = sheet.getByRole('textbox', { name: 'Grams tasted' });
    await expect(box).toHaveValue('5');
    await expect(sheet).toContainText('leaves 20');
    await shot(page, 'tasting');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].command).toMatchObject({ action: 'taste_sample', id: 'portion-a', consumed_grams: 5 });
    expect(calls[1]).toMatchObject({ confirm: 'tok-1' });
  });

  test('a tasting carries its notes and score, and the name renames the tea', async ({ page }) => {
    const calls: Array<{ command: Record<string, any>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, any>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^1958 Aged Raw/ }).click();
    const sheet = page.getByRole('region', { name: /1958 Aged Raw, at a glance/ });
    await sheet.getByRole('button', { name: /Log a tasting/ }).click();
    const picker = sheet.getByRole('combobox', { name: 'Add a tasting note' });
    const first = await picker.locator('option').nth(1).getAttribute('value');
    await picker.selectOption(first!);
    await sheet.getByRole('textbox', { name: 'Score out of 10' }).fill('8');
    await shot(page, 'notes');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    const sent = calls[0].command;
    expect(sent).toMatchObject({ action: 'taste_sample', consumed_grams: 5, score: 8 });
    expect(Object.values(sent.tasting as Record<string, string[]>).flat()).toContain(first);

    await sheet.getByRole('button', { name: /^Rename 1958 Aged Raw/ }).click();
    await sheet.getByRole('textbox', { name: /^Rename 1958 Aged Raw/ }).fill('1958 Aged Raw, Hong Kong stored');
    await sheet.getByRole('textbox', { name: /^Rename 1958 Aged Raw/ }).press('Enter');
    await expect.poll(() => calls.length).toBe(4);
    expect(calls[2].command).toMatchObject({ action: 'edit', entity: 'tea', id: 'tea-a', fields: { name: '1958 Aged Raw, Hong Kong stored' } });
    expect(calls[3]).toMatchObject({ confirm: 'tok' });
  });

  test('tapping the grams weighs a portion that was never weighed', async ({ page }) => {
    const calls: Array<{ command: Record<string, unknown>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, unknown>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok-2', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^Wild Moonlight/ }).click();
    const sheet = page.getByRole('region', { name: /Wild Moonlight, at a glance/ });
    await expect(sheet).toContainText('weigh it');
    await expect(sheet.getByRole('button', { name: /Log a tasting/ })).toBeDisabled();
    await sheet.getByRole('button', { name: /Weigh/ }).click();
    await sheet.getByRole('textbox', { name: 'Grams left in the sample' }).fill('30');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].command).toMatchObject({ action: 'edit', entity: 'sample', id: 'portion-b', fields: { grams: 30 } });
  });
});
