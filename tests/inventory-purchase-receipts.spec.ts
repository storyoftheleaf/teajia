import { expect, test } from './fixtures';

test('Purchases receives through the linked receipt before showing Received',async({page})=>{
  test.setTimeout(90_000);
  const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'admin',email:'operator@test',role:'owner',active_account_id:'acct',memberships:[{account_id:'acct',role:'owner'}],exp:Math.floor(Date.now()/1000)+86400})}.sig`;
  let received=0;let poStatus='ordered';let increments=0;
  const requests:Array<Record<string,unknown>>=[];
  await page.addInitScript(jwt=>{localStorage.clear();localStorage.setItem('teajia_token',jwt);localStorage.setItem('teajia-storage',JSON.stringify({version:2,state:{activeAccountId:'acct',activeUserId:'admin',memberships:[{account_id:'acct',account_name:'Test',role:'owner'}]}}));},token);
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{id:'admin',email:'operator@test',role:'owner'}});
    if(path==='/api/auth/refresh')return route.fulfill({json:{token}});
    // Purchases reads one tracking row per purchase, its linked receipt included,
    // beside the logistics companies (2026-10-29).
    const purchaseRow=()=>({id:'purchase',vendor_name:'Lin',status:poStatus,items_json:JSON.stringify([{product_id:'tea',product_name:'Cloud Oolong',quantity:100,unit:'g'}]),created_at:'2026-10-28',receipt_id:'receipt'});
    const receiptRow=()=>({id:'receipt',state:poStatus==='received'?'received':'ordered',vendor_name:'Lin',source_kind:'purchase_order',lines:[{id:'line',product_id:'tea',product_name:'Cloud Oolong',expected_quantity:100,received_quantity:received,cancelled_quantity:0,current_on_hand:received,unit:'g',intended_purpose:'working'}]});
    if(path==='/api/purchase-orders/tracking')return route.fulfill({json:{rows:[{id:'purchase',purchase:purchaseRow(),receipt:receiptRow(),attention:[],history:[],source_document:null}]}});
    if(path==='/api/logistics')return route.fulfill({json:{orders:[],shipments:[],services:[],addresses:[]}});
    if(path==='/api/purchase-orders')return route.fulfill({json:[purchaseRow()]});
    if(path==='/api/inventory/receipts')return route.fulfill({json:[{id:'receipt',state:poStatus==='received'?'received':'ordered',vendor_name:'Lin',source_kind:'purchase_order',lines:[{id:'line',product_id:'tea',product_name:'Cloud Oolong',expected_quantity:100,received_quantity:received,cancelled_quantity:0,current_on_hand:received,unit:'g',intended_purpose:'working'}]}]});
    if(path==='/api/inventory/receipt-lines/line/receive'){
      requests.push(route.request().postDataJSON());received=100;poStatus='received';
      return route.fulfill({json:{received_quantity:100,remaining_quantity:0,state:'received',ledger_id:'movement'}});
    }
    if(path==='/api/rpc/increment-stock'){increments++;return route.fulfill({status:500,json:{error:'Legacy increment must not run'}})}
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/purchase-orders?purchaseId=purchase');
  // Opening the purchase only shows it; nothing is received until Receive.
  await page.getByRole('button',{name:'Record arrival / manage delivery',exact:true}).click();
  const line=page.locator('.purchase-tracking-item').filter({hasText:'Cloud Oolong'});
  await expect(line).toContainText('Shelf stock: 0 g');
  expect(poStatus).toBe('ordered');
  await page.getByRole('button',{name:'Receive',exact:true}).click();
  await expect(line.locator('.purchase-tracking-quantities')).toContainText('Arrived 100 g');
  await page.getByRole('button',{name:'Back to purchases',exact:true}).click();
  await expect(page.getByText(/^Received/).first()).toBeVisible();
  expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({quantity:100,idempotency_key:expect.any(String)});
  expect(increments).toBe(0);
});

test('legacy intake review links the original stock movement without receiving it again',async({page})=>{
  test.setTimeout(60_000);
  const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'admin',email:'operator@test',role:'owner',active_account_id:'acct',memberships:[{account_id:'acct',role:'owner'}],exp:Math.floor(Date.now()/1000)+86400})}.sig`;
  let linked=false;let receives=0;const preparations:Array<Record<string,any>>=[];
  const legacyPurchase=()=>({id:'legacy',vendor_name:'Lin',status:linked?'received':'pending',create_request_key:'intake:old-import:po:0',items_json:JSON.stringify([{product_name:'Cloud Oolong',quantity:100,unit_price:40,currency:'USD'}]),created_at:'2026-10-28',receipt_id:linked?'receipt':null});
  const legacyReceipt=()=>({id:'receipt',state:'received',vendor_name:'Lin',source_kind:'purchase_order',lines:[{id:'line',product_id:'tea',product_name:'Cloud Oolong',expected_quantity:100,received_quantity:100,cancelled_quantity:0,current_on_hand:100,unit:'g',intended_purpose:'working'}]});
  await page.addInitScript(jwt=>{localStorage.clear();localStorage.setItem('teajia_token',jwt);localStorage.setItem('teajia-storage',JSON.stringify({version:2,state:{activeAccountId:'acct',activeUserId:'admin',memberships:[{account_id:'acct',account_name:'Test',role:'owner'}]}}));},token);
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{id:'admin',email:'operator@test',role:'owner'}});
    if(path==='/api/auth/refresh')return route.fulfill({json:{token}});
    if(path==='/api/products')return route.fulfill({json:[{id:'tea',product_name:'Cloud Oolong',given_name:'Cloud',type:'Oolong',status:'Draft',stock_grams:100,cost_amount:40,cost_currency:'USD',quantity_purchased:100}]});
    if(path==='/api/logistics')return route.fulfill({json:{orders:[],shipments:[],services:[],addresses:[]}});
    if(path==='/api/purchase-orders/tracking')return route.fulfill({json:{rows:[{id:'legacy',purchase:legacyPurchase(),receipt:linked?legacyReceipt():null,attention:[],history:[],source_document:null}]}});
    if(path==='/api/purchase-orders')return route.fulfill({json:[{id:'legacy',vendor_name:'Lin',status:'pending',create_request_key:'intake:old-import:po:0',items_json:JSON.stringify([{product_name:'Cloud Oolong',quantity:100,unit_price:40,currency:'USD'}]),created_at:'2026-10-28'}]});
    if(path==='/api/stock-ledger')return route.fulfill({json:{total:2,entries:[{id:'wrong',reason:'MANUAL_ADJUST',delta:100,created_at:'2026-10-27'},{id:'original',reason:'RECEIPT',delta:100,created_at:'2026-10-28',reference:'Intake old-import part 1'}]}});
    if(path==='/api/purchase-orders/legacy/prepare-receipt'){
      const body=route.request().postDataJSON();
      // The first call asks whether the purchase can be linked as it stands; an
      // intake purchase with no holding cannot, so the matcher opens.
      if(!body?.items)return route.fulfill({json:{receipt_id:null,unresolved_items:[{index:0,product_name:'Cloud Oolong'}]}});
      preparations.push(body);
      expect(body.items[0]).toMatchObject({product_id:'tea',quantity:100,unit:'g',source_movement_id:'original'});linked=true;
      return route.fulfill({json:{receipt_id:'receipt',unresolved_items:[]}});
    }
    if(path==='/api/inventory/receipts')return route.fulfill({json:[{id:'receipt',state:'received',vendor_name:'Lin',source_kind:'purchase_order',lines:[{id:'line',product_id:'tea',product_name:'Cloud Oolong',expected_quantity:100,received_quantity:100,cancelled_quantity:0,current_on_hand:100,unit:'g',intended_purpose:'working'}]}]});
    if(path.includes('/receive')||path==='/api/rpc/increment-stock'){receives++;return route.fulfill({status:500,json:{error:'Existing stock cannot be received twice'}})}
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/purchase-orders?purchaseId=legacy');
  await page.getByRole('button',{name:'Link original stock entry',exact:true}).click();
  await page.getByRole('dialog',{name:'Match purchase lines'}).waitFor();
  await page.getByRole('combobox',{name:'Holding for line 1'}).selectOption('tea');
  const continueButton=page.getByRole('button',{name:'Link recorded stock'});
  await expect(continueButton).toBeDisabled();
  const stock=page.getByRole('combobox',{name:'Original stock entry'});
  await expect(stock.locator('option[value="original"]')).toHaveCount(1);
  await expect(stock.locator('option[value="wrong"]')).toHaveCount(0);
  await stock.selectOption('original');
  await expect(continueButton).toBeEnabled();
  await page.screenshot({path:test.info().outputPath('legacy-purchase-matcher.png')});
  await continueButton.click();
  await expect(page.getByLabel('Studio receipt quantities').first()).toContainText('Received 100 g');
  expect(linked).toBe(true);expect(preparations).toHaveLength(1);expect(receives).toBe(0);
});
