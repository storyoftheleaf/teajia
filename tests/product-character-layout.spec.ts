import { expect, test } from './fixtures';

test('the plaque keeps the type and character dots stay between neighbours on each line', async ({ page }) => {
  const notes = ['Dark floral', 'Smooth sweetness', 'Aged wood', 'Mineral', 'Clean finish'];
  const tea = {
    id: 'character-tea', slug: 'a-tea-name', product_name: 'A Tea Name', type: 'Dark Tea',
    status: 'Active', stock_grams: 100, retail_price_per_gram_usd: 1, tasting_source: 'owner', tasting: { flavor: notes },
  };
  const pot = { ...tea, id: 'character-pot', slug: 'a-teapot', product_name: 'A Teapot', type: 'Teaware', quantity_units: 1 };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith('/products/public')) json = [tea, pot];
    else if (path.endsWith('/a-tea-name')) json = tea;
    else if (path.endsWith('/a-teapot')) json = pot;
    else if (path.endsWith('/selected-by')) json = { selected_by: [] };
    return route.fulfill({ json });
  });
  await page.goto('/shop/product/a-tea-name');
  await expect(page.getByRole('heading', { name: 'A Tea Name' })).toBeVisible();
  await expect(page.getByTestId('tea-classification')).toHaveText('Dark');
  const line = page.getByRole('region', { name: 'Taste', exact: true }).locator('ul').first();
  await expect(line.locator('li')).toHaveCount(notes.length);
  await page.evaluate(() => document.fonts.ready);
  const checkDots = () => line.evaluate(list => {
    const items = [...list.children];
    return items.every((item, i) => {
      const current = item.getBoundingClientRect();
      const previous = items[i - 1]?.getBoundingClientRect();
      const dot = item.querySelector('[aria-hidden]')?.getBoundingClientRect();
      if (!previous || previous.top !== current.top) return !dot?.width;
      return !!dot?.width && dot.left >= previous.right - 1 && dot.right <= current.left + 1;
    });
  });
  for (const width of [1280, 390, 320, 520, 1040]) {
    await page.setViewportSize({ width, height: 850 });
    await expect.poll(checkDots).toBe(true);
    if (width === 320) {
      expect(await line.evaluate(list => new Set([...list.children].map(el => el.getBoundingClientRect().top)).size)).toBeGreaterThan(1);
    }
  }
  await line.evaluate(list => { list.style.fontFamily = 'monospace'; });
  await expect.poll(checkDots).toBe(true);
  await page.goto('/shop/product/a-teapot');
  await expect(page.getByTestId('tea-classification')).toHaveText('Teaware');
});
