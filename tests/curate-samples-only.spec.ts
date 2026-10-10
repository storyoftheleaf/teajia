/**
 * Curate samples inside Stock: the guarantees that outlived the Samples-only
 * screen.
 *
 * This file used to drive a separate screen at /admin/inventory?stock_view=samples
 * with "Samples only", "Taste sample", "Record grams", "Order tea" and "Edit tea"
 * buttons. On 2026-10-09 that screen was retired on purpose (261d1ebf, da14a7c5,
 * 9d296b44, e61b063b): samples are now rows in the one Stock list, opened from
 * the Samples view, with a sheet on the phone and "Open in Curate" on the laptop.
 * tests/samples-phone.spec.ts covers the new list, tasting, notes and weighing.
 *
 * What is kept here is what that file does not cover and the product still does,
 * on the phone, where the sheet carries these actions:
 *   - ordering a sample's tea goes through a read-back and a confirm, and sends
 *     the vendor, the tea and the quantity;
 *   - a typed 0 is an answer: a tasting of 0 g sends 0 and a weighing of 0 g
 *     records 0, never a blank (CLAUDE.md, "Nothing entered is NULL");
 *   - "Full page" opens a legacy Loose Leaf tea in the Curate form, and Back
 *     returns to the samples.
 */
import { test, expect, type Page } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const TEA = {
  id: 'sample-tea', account_id: 'acct', user_id: 'owner', name: 'Mountain Oolong', vendor_id: 'vendor', vendor_name: 'Lin',
  type: 'Oolong', sample_state: 'received', price_amount: 100, price_currency: 'Yuan', price_per_unit_grams: 500,
  status: 'noted', category: 'tea', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

type Sent = { kind: 'correct' | 'order'; body: any };

async function seed(page: Page, opts: { grams?: number | null; form?: string } = {}) {
  const grams = opts.grams === undefined ? 25 : opts.grams;
  const tea = { ...TEA, ...(opts.form ? { form: opts.form } : {}) };
  const sent: Sent[] = [];
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/curate/holdings**', route => route.fulfill({ json: [{
    entry: tea, stock_grams: 0, sample_grams: grams,
    samples: [{ id: 'portion', name: 'Received portion', grams, status: 'received', set_id: 'set', compass_entry_id: tea.id }],
  }] }));
  await page.route('**/api/compass/entries**', route => route.fulfill({ json: { entries: [tea] } }));
  await page.route('**/api/curate/correct', async route => {
    const body = route.request().postDataJSON();
    sent.push({ kind: 'correct', body });
    await route.fulfill({ json: body.confirm ? { confirmed: true } : { confirmation_token: 'correct-token', preview: {} } });
  });
  await page.route('**/api/curate/order', async route => {
    const body = route.request().postDataJSON();
    sent.push({ kind: 'order', body });
    await route.fulfill({ json: body.confirm
      ? { committed: true, purchase_order_id: 'order' }
      : { preview: { read_back: 'Order from Lin: 500 g of Mountain Oolong at 100 Yuan.', after_confirm: 'The order waits on Purchase Orders; approve the arrival into stock.' }, confirmation_token: 'order-token' } });
  });
  return sent;
}

/** Samples is a view of the one Stock list, picked from the same menu as Working or Personal. */
async function openSheet(page: Page) {
  await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Choose which teas to show/ }).click();
  await page.getByRole('menuitem', { name: 'Samples', exact: true }).click();
  await page.getByTestId('samples-phone').getByRole('button', { name: /^Mountain Oolong/ }).click();
  return page.getByRole('region', { name: /Mountain Oolong, at a glance/ });
}

test.describe('Curate samples in Stock (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'the sample sheet is the phone layout; the laptop opens samples in Curate');

  test('ordering a sample\'s tea reads the order back and waits for a confirm', async ({ page }) => {
    const sent = await seed(page);
    const sheet = await openSheet(page);
    await sheet.getByRole('button', { name: 'Order this tea' }).click();
    const view = page.getByRole('region', { name: 'Samples-only inventory' });
    await view.getByLabel('Quantity requested').fill('500');
    await view.getByRole('button', { name: 'Review order' }).click();
    await expect(view.getByText('Order from Lin: 500 g of Mountain Oolong at 100 Yuan.')).toBeVisible();
    const orders = () => sent.filter(s => s.kind === 'order');
    expect(orders()).toHaveLength(1);
    expect(orders()[0].body).toMatchObject({ vendor_id: 'vendor', lines: [{ tea_id: 'sample-tea', quantity: { amount: 500, unit: 'g' } }] });
    expect(orders()[0].body.confirm).toBeUndefined();
    await view.getByRole('button', { name: 'Confirm order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Order created' })).toBeVisible();
    expect(orders()[1].body.confirm).toBe('order-token');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  });

  test('a tasting of 0 g sends 0, not a blank', async ({ page }) => {
    const sent = await seed(page);
    const sheet = await openSheet(page);
    await sheet.getByRole('button', { name: /Log a tasting/ }).click();
    await sheet.getByRole('textbox', { name: 'Grams tasted' }).fill('0');
    await expect(sheet).toContainText('leaves 25');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].body.command).toMatchObject({ action: 'taste_sample', id: 'portion', consumed_grams: 0 });
    expect(sent[1].body.confirm).toBe('correct-token');
  });

  test('weighing an unweighed portion at 0 g records 0, not a blank', async ({ page }) => {
    const sent = await seed(page, { grams: null });
    const sheet = await openSheet(page);
    await expect(sheet.getByRole('button', { name: /Log a tasting/ })).toBeDisabled();
    await sheet.getByRole('button', { name: /Weigh/ }).click();
    await sheet.getByRole('textbox', { name: 'Grams left in the sample' }).fill('0');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].body.command).toEqual({ action: 'edit', entity: 'sample', id: 'portion', fields: { grams: 0 } });
    expect(sent[1].body.confirm).toBe('correct-token');
  });

  test('Full page opens a legacy Loose Leaf tea in the Curate form, and Back returns to the samples', async ({ page }) => {
    await seed(page, { form: 'Loose Leaf' });
    const sheet = await openSheet(page);
    await sheet.getByRole('button', { name: /Full page/ }).click();
    await expect(page.getByRole('button', { name: 'Back to samples' })).toBeVisible();
    await expect(page.locator('input[value="Mountain Oolong"]')).toBeVisible();
    await page.getByRole('button', { name: 'Back to samples' }).click();
    await expect(page.getByTestId('samples-phone').getByRole('button', { name: /^Mountain Oolong/ })).toBeVisible();
  });
});
