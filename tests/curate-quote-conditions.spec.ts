import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test('quote conditions remain structured through unknown and known thresholds', async ({ page }) => {
  await installCompassHarness(page);
  await page.route('**/api/customers/vendor-1', route => route.fulfill({json:{id:'vendor-1',name:'Private Vendor',tags:['vendor'],contacts:[]}}));
  for (const path of ['customers/vendor-1/products','customers/vendor-1/supplied-products','purchase-orders','inventory/receipts*']) await page.route(`**/api/${path}`, route => route.fulfill({json:[]}));
  let quote:any={id:'quote-1',vendor_id:'vendor-1',reference:'LKY quote',discount_percent:25,discount_condition_type:'unknown',lines:[]};
  const writes:any[]=[];
  await page.route('**/api/curate/quotes*', route => route.fulfill({json:[quote]}));
  await page.route('**/api/curate/quotes/quote-1', async route => {
    if(route.request().method()==='PUT'){const body=route.request().postDataJSON();writes.push(body);quote={...quote,...body};}
    await route.fulfill({json:quote});
  });
  await page.route('**/api/curate/attachments?*', route => route.fulfill({json:[]}));
  await page.route('**/api/curate/history?*', route => route.fulfill({json:{history:[]}}));
  await page.goto('/admin/vendors/vendor-1');
  const panel=page.getByTestId('curate-quotes-panel');
  await panel.getByText('Vendor quotes',{exact:true}).click();
  await panel.getByRole('button',{name:'LKY quote',exact:true}).click();
  await expect(panel.getByLabel('Quote discount (%)')).toHaveValue('25');
  await expect(panel.getByLabel('Discount condition',{exact:true})).toHaveValue('unknown');
  await panel.getByLabel('Discount condition',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/teajia-quote-conditions-${test.info().project.name.replace(/ /g,'-')}.png`});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',await page.locator('body').evaluate(el=>el.clientWidth));
  await panel.getByLabel('Payment terms').fill('Payment up front');
  await panel.getByRole('button',{name:'Save vendor quote'}).click();
  await expect(panel.getByRole('status')).toHaveText('Vendor quote saved');
  expect(writes[0]).toMatchObject({discount_percent:25,discount_condition_type:'unknown',discount_min_amount:null,discount_min_currency:null,payment_terms:'Payment up front'});
  await panel.getByLabel('Discount condition',{exact:true}).selectOption('min_order_amount');
  await panel.getByLabel('Discount minimum amount').fill('2000');
  await panel.getByLabel('Discount minimum currency').fill('HKD');
  await panel.getByRole('button',{name:'Save vendor quote'}).click();
  await expect(panel.getByRole('status')).toHaveText('Vendor quote saved');
  expect(writes[1]).toMatchObject({discount_condition_type:'min_order_amount',discount_min_amount:2000,discount_min_currency:'HKD'});
  await panel.getByLabel('Discount condition',{exact:true}).selectOption('unknown');
  await expect(panel.getByLabel('Discount minimum amount')).toHaveCount(0);
  await panel.getByRole('button',{name:'Save vendor quote'}).click();
  await expect(panel.getByRole('status')).toHaveText('Vendor quote saved');
  expect(writes[2]).toMatchObject({discount_condition_type:'unknown',discount_min_amount:null,discount_min_currency:null});
  await expectNoUnhandledCompassApi(page);
});
