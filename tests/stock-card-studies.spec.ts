import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

test('five finishes preserve Stock structure, tighten reference spacing and fit narrow phones', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/products', route => route.fulfill({ json: [
    ...MOCK_PRODUCTS.slice(0, 6),
    { ...MOCK_PRODUCTS[1], id: 'dark-finish-reference', type: 'Dark', product_name: 'Aged Liu Bao', given_name: '' },
  ] }));
  let original = '';
  for (const variant of [1,2,3,4,5]) {
    await page.setViewportSize({ width:390, height:844 });
    await page.goto(`/admin/stock?cardStudy=${variant}`);
    const card=page.locator('.stock-record').first();
    await expect(card).toHaveAttribute('data-card-study',String(variant),{timeout:15000});
    await page.evaluate(() => document.fonts.ready);
    const structure=await card.innerHTML();
    if (variant===1) original=structure;
    else expect(structure).toBe(original);
    const colours=await page.locator('.stock-record').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).getPropertyValue('--stock-tea-hue')));
    expect(new Set(colours).size).toBeGreaterThanOrEqual(5);
    for (const width of [320,390,740]) {
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
      const gap=await card.locator('.stock-year-figure').evaluate(figure=>{
        if (figure.closest('[data-card-study]')?.getAttribute('data-card-study')==='2') {
          const number=figure.querySelector('.stock-number')!.getBoundingClientRect();
          const label=figure.querySelector('.stock-caption')!.getBoundingClientRect();
          return label.top-number.bottom;
        }
        const label=figure.querySelector('dt')!.getBoundingClientRect();
        const range=document.createRange();range.selectNodeContents(figure.querySelector('dd button')!);
        return range.getBoundingClientRect().top-label.bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThan(6);
      const button=await card.getByRole('button',{name:/Edit year in figures/}).boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(44);
      if(variant===2) {
        const more=await card.getByRole('button',{name:/More details for/}).boundingBox();
        const strip=await card.locator('.stock-subtitle').boundingBox();
        expect(more!.y+more!.height).toBeLessThanOrEqual(strip!.y);
      }
      if(width===390) await page.screenshot({path:test.info().outputPath(`card-finish-${variant}.png`)});
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/stock');
  await expect(page.locator('.stock-record').first()).toBeVisible();
  await expect(page.locator('.stock-record').first()).toHaveAttribute('data-card-polish','4');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/preview/stock-cards/index.html');
  await page.getByRole('button',{name:'05 Soft glaze',exact:true}).click();
  await expect(page.locator('iframe')).toHaveAttribute('src','/admin/stock?cardStudy=5');
  await expect(page.frameLocator('iframe').locator('[data-card-study="5"]').first()).toBeVisible();
  await page.screenshot({path:test.info().outputPath('card-finish-comparison.png')});
});
