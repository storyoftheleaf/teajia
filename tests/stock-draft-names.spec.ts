import { test, expect } from './fixtures';
import { installAdmin } from '../scripts/manage-archive/mock';

test('Stock drafts keep the supplier title and save a separate chosen name', async ({ page }) => {
  test.setTimeout(65_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const supplierName = 'Spring Qingxin from the Upper Mountain Garden';
  const chosenName = 'Mist over the Old Tea Gardens';
  const fields = {
    type: 'Oolong', form: 'Loose Leaf', year: 2025, stock_grams: 100,
    cost_amount: 20, cost_currency: 'USD', quantity_purchased: 100,
    retail_price_per_gram_usd: 0.4, status: 'Draft', is_public: 0,
    shown_in_shop: 0, inventory_purpose: 'working', vendor: 'Cloud Mountain',
  };
  const first = { ...fields, id: 'draft-1', product_name: supplierName, given_name: '' };
  const second = {
    ...fields, id: 'draft-2', product_name: 'Winter Qingxin from Three Valleys',
    given_name: 'Spring Mist over the High Mountain Tea Garden',
  };
  const writes: unknown[] = [];
  await installAdmin(page, [(url, method, body) => {
    if (url.pathname === '/api/products' && method === 'GET') return [first, second];
    if (url.pathname === '/api/products/draft-1' && method === 'GET') return first;
    if (url.pathname === '/api/products/draft-1/catalog' && method === 'PUT') {
      writes.push(body);
      Object.assign(first, body);
      return { success: true };
    }
    return undefined;
  }]);

  await page.goto('/admin/stock');
  await page.getByRole('combobox', { name: 'Show teas' }).selectOption({ label: 'Drafts' });
  await expect(page).toHaveURL(/view=drafts/);
  const row = (id: string) => page.locator(`tr[data-product-id="${id}"]`);
  const card = row(first.id).locator('.stock-record');
  const secondCard = row(second.id).locator('.stock-record');
  const title = card.locator('.stock-title');
  const subtitle = card.locator('.stock-subtitle');
  await expect(title).toHaveText(supplierName);
  await expect(secondCard.locator('.stock-title')).toHaveText(second.product_name);
  await expect(secondCard.locator('.stock-subtitle').getByRole('button', { name: /^Edit chosen name/ })).toHaveText(second.given_name);
  await page.evaluate(() => document.fonts.ready.then(() => {}));
  const alignment = await page.locator('.stock-record:visible').evaluateAll(cards => cards.map(node => {
    const left = (selector: string) => node.querySelector(selector)!.getBoundingClientRect().left;
    return {
      outer: [node.getBoundingClientRect().left, node.getBoundingClientRect().right],
      title: left('.stock-title button'),
      menu: left('.stock-more-action'),
      figures: [...node.querySelectorAll('.stock-figure')].map(el => el.getBoundingClientRect().left),
    };
  }));
  expect(alignment).toHaveLength(2);
  expect(alignment[0]).toEqual(alignment[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await subtitle.getByRole('button', { name: /^Name this tea/ }).click();
  const editor = page.getByRole('dialog', { name: 'Given name', exact: true });
  const input = editor.getByRole('textbox', { name: 'Given name' });
  await expect(input).toHaveValue('');
  await input.pressSequentially(chosenName);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(writes).toEqual([{ given_name: chosenName }]);
  await page.reload();
  await expect(title).toHaveText(supplierName);
  await expect(subtitle.getByRole('button', { name: /^Edit chosen name/ })).toHaveText(chosenName);
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(row(first.id).getByRole('button', { name: `Open ${supplierName} editor` })).toHaveText(supplierName);
  await expect(row(first.id).getByRole('button', { name: /^Edit chosen name/ })).toHaveText(chosenName);
});
