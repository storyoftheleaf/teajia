import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

test('four visual finishes preserve the approved card structure and exact geometry', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/products', route => route.fulfill({ json: [
    ...MOCK_PRODUCTS.slice(0,6),
    {...MOCK_PRODUCTS[1], id:'dark-polish-reference', type:'Dark', product_name:'Aged Liu Bao', given_name:''},
  ] }));
  const selectors=['.stock-title-line','.stock-title','.stock-subtitle','.stock-given-name','.stock-form-edit','[data-field=type]','.stock-workbar','.stock-camera-action','.stock-tasting-action','.stock-more-action','.stock-figure','.stock-number','.stock-caption'];
  const measure=async()=>page.locator('.stock-record').first().evaluate((card, selectors)=>{
    const origin=card.getBoundingClientRect();
    return {html:card.innerHTML,rects:Array.from(card.querySelectorAll(selectors.join(','))).map(el=>{
      const rect=el.getBoundingClientRect();
      return [rect.x-origin.x,rect.y-origin.y,rect.width,rect.height].map(n=>Math.round(n*1000)/1000);
    })};
  },selectors);
  for(const width of [320,390,740]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/admin/stock?cardStudy=2');
    await expect(page.locator('.stock-record').first()).toBeVisible({timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    const approved=await measure();
    for(const polish of [1,2,3,4]) {
      await page.goto(`/admin/stock?cardPolish=${polish}`);
      await expect(page.locator('.stock-record').first()).toHaveAttribute('data-card-polish',String(polish),{timeout:15000});
      await page.evaluate(()=>document.fonts.ready);
      expect(await measure()).toEqual(approved);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
      if(width===390) await page.screenshot({path:test.info().outputPath(`polish-${polish}.png`)});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/preview/stock-polish/index.html');
  await expect(page.getByRole('navigation',{name:'Visual polish options'}).getByRole('button')).toHaveCount(4);
  await page.getByRole('button',{name:'Fine metalwork',exact:true}).click();
  await expect(page.frameLocator('iframe').locator('[data-card-polish="4"]').first()).toBeVisible({timeout:15000});
  await page.screenshot({path:test.info().outputPath('polish-comparison.png')});
});
