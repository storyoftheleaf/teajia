import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('tea details read shared supplier, exact shipment and store facts after reload', async ({ page }, info) => {
  test.setTimeout(60_000);
  const teaId = 'connected-tea'; const vendorId='vendor-chen'; const productId='connected-product';
  let company='Shared supplier shop'; let freight=42; let mode='sea';
  const now=new Date().toISOString();
  const entry={ id:teaId,category:'tea',name:'Connected sourcing tea',vendor_id:vendorId,linked_customer_id:vendorId,vendor_name:'Old supplier snapshot',status:'noted',type:'Sheng',form:'Cake',price_amount:1250,price_currency:'Yuan',price_per_unit_grams:1250,pack_size_grams:357,shop_name:'Earlier chosen tea name',quote_id:'quote-1',notes:'',photos:'[]',audio_clips:'[]',created_at:now,updated_at:now,draft_product_id:productId };
  await installCompassHarness(page,{compassEntries:[entry],products:[],customers:[{id:vendorId,name:'Shared supplier',company,tags:['vendor']}],rates:[{currency:'USD',rate_to_usd:1},{currency:'Yuan',rate_to_usd:7.1}],purchaseOrders:[{id:'order-1',vendor_id:vendorId,vendor_name:'Shared supplier',status:'shipped',ship_mode:mode,tracking_number:'SEA-123',updated_at:now,items_json:JSON.stringify([{id:'line-1',name:entry.name,compass_entry_id:teaId,product_id:productId,priceIsPerGram:true,quantity:1250,pricePerUnit:1}])},{id:'unrelated-order',vendor_id:vendorId,vendor_name:'Shared supplier',status:'shipped',ship_mode:'air',tracking_number:'WRONG-TEA',items_json:JSON.stringify([{id:'other-line',compass_entry_id:'other-tea',quantity:500,priceIsPerGram:true}])}],inventoryReceipts:[{id:'receipt-1',state:'in_transit',source_kind:'purchase_order',source_ref:'order-1',transport_mode:'courier',eta:'2026-12-01',lines:[]}]});
  await page.route('**/api/customers',route=>route.fulfill({json:[{id:vendorId,name:'Shared supplier',company,tags:['vendor']}]}));
  await page.route('**/api/accounts/acct-bali',route=>route.fulfill({json:{id:'acct-bali',name:'Test store',default_shipping_rate_per_kg:freight,default_shipping_rate_currency:'Yuan'}}));
  await page.route('**/api/curate/quotes/quote-1',route=>route.fulfill({json:{id:'quote-1',vendor_id:vendorId,reference:'SHARED-Q1',discount_percent:7,payment_terms:'Pay on delivery',lines:[{id:'quote-line',compass_entry_id:teaId,vendor_item_number:'Q-42',discount_percent:5}]}}));
  const widths=info.project.name==='Mobile Chrome'?[320,390]:[1280];
  for(const width of widths){
    await page.setViewportSize({width,height:844});
    await openCompass(page);
    // Select a saved fixture through the app's existing library/editor controls.
    await page.getByRole('tab',{name:'Library',exact:true}).filter({visible:true}).click();
    await page.getByRole('button',{name:`Edit details for ${entry.name}`,exact:true}).click();
    await page.getByRole('tab',{name:'Tea',exact:true}).filter({visible:true}).click();
    await page.getByRole('button',{name:'Tea details',exact:true}).click();
    const details=page.getByRole('dialog',{name:'Tea details',exact:true}).last();
    const sourcing=details.locator('[aria-label="Connected sourcing"]');
    await expect(sourcing).toContainText(company);
    await expect(sourcing).toContainText('Sea');
    await expect(sourcing).toContainText('Courier');
    await expect(sourcing).toContainText('SEA-123');
    await expect(sourcing).not.toContainText('WRONG-TEA');
    await expect(sourcing).toContainText(`${freight} CNY / kg`);
    await expect(sourcing).toContainText('Item Q-42');
    await expect(sourcing).toContainText('Quoted discount: 5%');
    for(const label of ['Shop name','Shipping method','Pu-erh processing','Discount (%)','Vendor item number']) await expect(details.getByRole('textbox',{name:label,exact:true})).toHaveCount(0);
    await expect(details.locator('details, summary')).toHaveCount(0);
    await page.screenshot({path:info.outputPath(`connected-details-${width}.png`),animations:'disabled'});
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.reload();
  }
  company='Updated shared shop';freight=55;
  await page.reload();
  await page.getByRole('button',{name:'Tea details',exact:true}).click();
  const refreshed=page.getByRole('dialog',{name:'Tea details',exact:true}).last();
  await expect(refreshed).toContainText('Updated shared shop');
  await expect(refreshed).toContainText('55 CNY / kg');
  await openCompass(page);
  await page.evaluate(async id => {
    // @ts-expect-error Local Vite test module; no production browser state is changed.
    const {useTeaCompassStore}=await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.getState().setActiveEntry(id);
  }, teaId);
  await page.getByRole('tab',{name:'Source',exact:true}).filter({visible:true}).click();
  const header=page.getByTestId('curate-supplier-header').filter({visible:true});
  await expect(header).toContainText('Shared supplier');
  await expect(header).not.toContainText('Old supplier snapshot');
  await header.getByRole('button',{name:'Source context',exact:true}).click();
  const context=page.getByRole('dialog',{name:'Source context',exact:true});
  await context.getByRole('button',{name:'New visit',exact:true}).click();
  await expect(context.getByLabel('Visit vendor',{exact:true})).toHaveValue(vendorId);

});
