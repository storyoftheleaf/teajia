import { test, expect, type Page } from './fixtures';

/*
 * The Supplier sheet, mounted on its own through tests/harness/supplier-sheet.html
 * because no screen opens it yet (the Stock rows will). Every API call is
 * answered here; nothing reaches the live shop.
 *
 * Adrian, 2026-10-11: "I see someone called Master Bo. If that's not his name,
 * there needs to be a button that I can click and change the name ... From this
 * place I can access a way to update everything including the methods that I
 * use when I ship from him."
 */

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'admin-1', email: 'admin@teajia.com', role: 'owner', active_account_id: 'acct-bali',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
})}.fake`;

const PREVIEW = {
  vendor_id: 'bo', old_name: 'Master Bo', new_name: 'Bo Lin', total: 22,
  counts: [
    { table: 'customers', label: 'the supplier card', by_id: 1, by_name: 0 },
    { table: 'tea_compass_entries', label: 'teas in Curate', by_id: 14, by_name: 1 },
    { table: 'products', label: 'teas on the shelf', by_id: 0, by_name: 0 },
    { table: 'purchase_orders', label: 'orders', by_id: 3, by_name: 0 },
    { table: 'inventory_receipts', label: 'arrivals', by_id: 0, by_name: 3 },
  ],
};

interface Seen { renames: Array<Record<string, unknown>>; puts: Array<Record<string, unknown>>; previewNames: string[]; renameStatus: number; renameError: string }

async function prepare(page: Page): Promise<Seen> {
  let cardName = 'Master Bo'; // the "database": a rename changes what the next read says
  const seen: Seen = { renames: [], puts: [], previewNames: [], renameStatus: 200, renameError: '' };
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/customers/bo' && method === 'GET') {
      return json({ id: 'bo', name: cardName, whatsapp: '+86 138 0000 1111', wechat: 'masterbo88', company: 'Bo Tea House', city: 'Menghai', country: 'China', email: null, phone: null, address: null });
    }
    if (url.pathname === '/api/customers/bo' && method === 'PUT') { seen.puts.push(route.request().postDataJSON()); return json({ success: true }); }
    if (url.pathname === '/api/suppliers/bo/rename-preview') {
      seen.previewNames.push(url.searchParams.get('name') ?? '');
      return json({ ...PREVIEW, new_name: url.searchParams.get('name') });
    }
    if (url.pathname === '/api/suppliers/bo/rename' && method === 'POST') {
      seen.renames.push(route.request().postDataJSON());
      if (seen.renameStatus !== 200) return json({ error: seen.renameError, code: 'name_taken' }, seen.renameStatus);
      cardName = route.request().postDataJSON().name;
      return json({ ...PREVIEW, new_name: cardName });
    }
    if (url.pathname === '/api/suppliers/bo/freight') {
      return json([
        { id: 'f1', leg: 'Guangzhou to Bali', mode: 'air', total_amount: 850, currency: 'Yuan', weight_kg: 10, per_kg: 85, per_kg_usd: 11.97, transit_days: 6, observed_on: '2026-10-01', current: true },
        { id: 'f0', leg: 'Guangzhou to Bali', mode: 'air', total_amount: 900, currency: 'Yuan', weight_kg: 10, per_kg: 90, per_kg_usd: 12.68, transit_days: null, observed_on: '2026-09-01', current: false },
      ]);
    }
    if (url.pathname === '/api/shipping-routes') {
      return json([{ id: 'r-air', mode: 'air', carrier: 'DHL', destination: 'Bali', rate_per_kg: 85, rate_currency: 'Yuan', packing_percent: null, billing_step_kg: null, minimum_kg: null }]);
    }
    return json([]);
  });
  return seen;
}

// Runs once per project (Desktop Chrome, Mobile Chrome); the project sets the viewport.
{
  test.describe('supplier sheet', () => {

    test('shows the name, contact details and how he ships, without overflow or errors', async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await prepare(page);
      await page.goto('/tests/harness/supplier-sheet.html?id=bo&name=Master%20Bo');

      const sheet = page.getByTestId('supplier-sheet');
      await expect(sheet.getByTestId('supplier-name')).toHaveText('Master Bo');
      await expect(sheet.getByRole('button', { name: 'WhatsApp' })).toHaveText('+86 138 0000 1111');
      await expect(sheet.getByRole('button', { name: 'WeChat' })).toHaveText('masterbo88');
      await expect(sheet.getByRole('button', { name: 'Phone' })).toHaveText('add a number');
      await expect(sheet.getByTestId('supplier-freight-bill')).toHaveCount(2);
      await expect(sheet.getByTestId('supplier-freight-bill').first()).toContainText('¥85');
      await expect(sheet.getByTestId('supplier-freight-bill').first()).toContainText('850');
      await expect(sheet.getByTestId('supplier-shop-route')).toContainText('DHL');
      await expect(sheet.getByRole('link', { name: 'Change routes in Store Settings' })).toBeVisible();

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
      await page.screenshot({ path: `test-results/supplier-sheet/${info.project.name.replace(' ', '-')}-open.png` });
      expect(errors.filter(e => !/Failed to load resource/.test(e))).toEqual([]);
    });

    test('renaming shows what it will change first, and only then applies it', async ({ page }, info) => {
      const seen = await prepare(page);
      await page.goto('/tests/harness/supplier-sheet.html?id=bo&name=Master%20Bo');
      const sheet = page.getByTestId('supplier-sheet');

      await sheet.getByRole('button', { name: 'Rename' }).click();
      await sheet.getByLabel('New name').fill('Bo Lin');
      await sheet.getByRole('button', { name: 'See what changes' }).click();

      const preview = sheet.getByTestId('supplier-rename-preview');
      await expect(preview).toContainText('This changes 15 teas in Curate, 3 orders and 3 arrivals, and the supplier card.');
      await expect(preview).toContainText('Master Bo to Bo Lin');
      expect(seen.previewNames).toEqual(['Bo Lin']);
      expect(seen.renames).toEqual([]); // nothing applied by looking
      await page.screenshot({ path: `test-results/supplier-sheet/${info.project.name.replace(' ', '-')}-preview.png` });

      await sheet.getByRole('button', { name: 'Rename everywhere' }).click();
      await expect(sheet.getByTestId('supplier-name')).toHaveText('Bo Lin');
      expect(seen.renames).toEqual([{ name: 'Bo Lin', expected_old_name: 'Master Bo' }]);
      // The list behind the sheet was told, so it shows the new name without a reload.
      await expect(page.getByTestId('list-name')).toHaveText('Bo Lin');
      expect(await page.evaluate(() => (window as any).__renamed)).toBe('Bo Lin');
    });

    test('cancel leaves everything as it was, and a refusal is shown in words', async ({ page }) => {
      const seen = await prepare(page);
      await page.goto('/tests/harness/supplier-sheet.html?id=bo&name=Master%20Bo');
      const sheet = page.getByTestId('supplier-sheet');

      await sheet.getByRole('button', { name: 'Rename' }).click();
      await sheet.getByLabel('New name').fill('Someone Else');
      await sheet.getByRole('button', { name: 'Cancel' }).click();
      await expect(sheet.getByTestId('supplier-name')).toHaveText('Master Bo');
      expect(seen.renames).toEqual([]);

      seen.renameStatus = 409;
      seen.renameError = 'Another supplier is already called "Bo Lin".';
      await sheet.getByRole('button', { name: 'Rename' }).click();
      await sheet.getByLabel('New name').fill('Bo Lin');
      await sheet.getByRole('button', { name: 'See what changes' }).click();
      await sheet.getByRole('button', { name: 'Rename everywhere' }).click();
      await expect(sheet.getByRole('alert')).toContainText('Another supplier is already called');
      await expect(page.getByTestId('list-name')).toHaveText('Master Bo');
    });

    test('a contact detail saves on its own, and an emptied one is cleared rather than saved blank', async ({ page }) => {
      const seen = await prepare(page);
      await page.goto('/tests/harness/supplier-sheet.html?id=bo&name=Master%20Bo');
      const sheet = page.getByTestId('supplier-sheet');

      await sheet.getByRole('button', { name: 'Phone' }).click();
      await sheet.getByLabel('Phone').fill('+86 555 0100');
      await sheet.getByLabel('Phone').press('Enter');
      await expect.poll(() => seen.puts).toEqual([{ phone: '+86 555 0100' }]);
      await expect(sheet.getByRole('button', { name: 'Phone' })).toHaveText('+86 555 0100');

      await sheet.getByRole('button', { name: 'WeChat' }).click();
      await sheet.getByLabel('WeChat').fill('');
      await sheet.getByLabel('WeChat').press('Enter');
      await expect.poll(() => seen.puts.length).toBe(2);
      expect(seen.puts[1]).toEqual({ wechat: null });
    });
  });
}
