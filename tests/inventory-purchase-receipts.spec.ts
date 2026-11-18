import { expect, test } from './fixtures';

test('Purchases retries a partial arrival against the same Stock holding before completing the receipt', async ({ page }) => {
  test.setTimeout(90_000);
  const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'admin',email:'operator@test',role:'owner',active_account_id:'acct',memberships:[{account_id:'acct',role:'owner'}],exp:Math.floor(Date.now()/1000)+86400})}.sig`;
  const ordered = 100;
  let received = 0;
  let increments = 0;
  const requests: Array<{ quantity: number; idempotency_key: string }> = [];
  const movements = new Map<string, number>();
  const purchaseRow = () => ({
    id: 'purchase',
    vendor_name: 'Lin',
    status: received === ordered ? 'received' : 'ordered',
    items_json: JSON.stringify([{ product_id: 'tea', product_name: 'Cloud Oolong', quantity: ordered, unit: 'g' }]),
    created_at: '2026-10-28',
    receipt_id: 'receipt',
  });
  const receiptRow = () => ({
    id: 'receipt',
    state: received === ordered ? 'received' : received > 0 ? 'partially_received' : 'ordered',
    vendor_name: 'Lin',
    source_kind: 'purchase_order',
    lines: [{
      id: 'line',
      product_id: 'tea',
      product_name: 'Cloud Oolong',
      expected_quantity: ordered,
      received_quantity: received,
      cancelled_quantity: 0,
      current_on_hand: received,
      unit: 'g',
      intended_purpose: 'working',
    }],
  });
  await page.addInitScript(jwt=>{localStorage.clear();localStorage.setItem('teajia_token',jwt);localStorage.setItem('teajia-storage',JSON.stringify({version:2,state:{activeAccountId:'acct',activeUserId:'admin',memberships:[{account_id:'acct',account_name:'Test',role:'owner'}]}}));},token);
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{id:'admin',email:'operator@test',role:'owner'}});
    if(path==='/api/auth/refresh')return route.fulfill({json:{token}});
    // Purchases reads one tracking row per purchase, its linked receipt included,
    // beside the logistics companies (2026-10-29).
    if(path==='/api/purchase-orders/tracking')return route.fulfill({json:{rows:[{id:'purchase',purchase:purchaseRow(),receipt:receiptRow(),attention:[],history:[],source_document:null}]}});
    if(path==='/api/logistics')return route.fulfill({json:{orders:[],shipments:[],services:[],addresses:[]}});
    if(path==='/api/purchase-orders')return route.fulfill({json:[purchaseRow()]});
    if(path==='/api/inventory/receipts')return route.fulfill({json:[receiptRow()]});
    if(path==='/api/inventory/receipt-lines/line/receive'){
      const request = route.request().postDataJSON() as (typeof requests)[number];
      requests.push(request);
      const alreadyReceived = movements.has(request.idempotency_key);
      if (!alreadyReceived) {
        movements.set(request.idempotency_key, request.quantity);
        received += request.quantity;
      }
      // The upstream commits the first write but the gateway loses its response.
      if (requests.length === 1) {
        return route.fulfill({ status: 502, json: { error: 'No response from receiving service' } });
      }
      return route.fulfill({ json: {
        received_quantity: received,
        remaining_quantity: ordered - received,
        state: receiptRow().state,
        already_received: alreadyReceived,
      } });
    }
    if(path==='/api/rpc/increment-stock'){increments++;return route.fulfill({status:500,json:{error:'Legacy increment must not run'}})}
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/purchase-orders?purchaseId=purchase');
  const purchase = page.getByRole('dialog', { name: 'Purchase', exact: true });
  await expect(purchase.getByRole('heading', { name: 'Cloud Oolong' })).toBeVisible();
  await expect(purchase.getByLabel('Logistics company', { exact: true })).toHaveCount(0);
  await purchase.getByRole('button', { name: 'Assign inbound route', exact: true }).click();
  const inbound = page.getByRole('dialog', { name: 'Assign inbound route', exact: true });
  await expect(inbound.getByLabel('Inbound courier', { exact: true })).toBeVisible();
  await expect(inbound.getByLabel('Inbound tracking', { exact: true })).toBeVisible();
  await inbound.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(inbound).toBeHidden();
  await expect(purchase).toBeVisible();
  await purchase.getByRole('button', { name: 'Edit purchase', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit purchase', exact: true });
  await expect(editor.getByLabel('Logistics company', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await purchase.getByRole('button', { name: 'Arrival history', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Arrival history', exact: true });
  await expect(history.getByText('No arrivals recorded yet.')).toBeVisible();
  await history.getByRole('button', { name: 'Done', exact: true }).click();
  // Opening the purchase only shows it; nothing is received until Receive.
  await purchase.getByRole('button', { name: 'Record arrival / manage delivery', exact: true }).click();
  const line=page.locator('.purchase-tracking-item').filter({hasText:'Cloud Oolong'});
  const quantities = line.locator('.purchase-tracking-quantities');
  const arrival = line.getByLabel('Quantity received for Cloud Oolong');
  const receive = line.getByRole('button', { name: 'Receive', exact: true });
  await expect(line).toContainText('Shelf stock: 0 g');
  await expect(line.getByRole('link', { name: 'Stock', exact: true })).toHaveAttribute('href', '/admin/stock?panel=tea');
  expect(requests).toHaveLength(0);
  await arrival.fill('40');
  await receive.click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm whether stock was received');
  await expect(arrival).toBeDisabled();
  await expect(receive).toBeDisabled();
  expect(received).toBe(40);
  await page.getByRole('button', { name: 'Retry Receive', exact: true }).click();
  await expect(quantities).toContainText('Arrived 40 g');
  await expect(quantities).toContainText('Coming 60 g');
  await expect(line).toContainText('Shelf stock: 40 g');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatchObject({ quantity: 40, idempotency_key: expect.any(String) });
  expect(requests[1]).toEqual(requests[0]);
  expect([...movements.values()]).toEqual([40]);
  expect(purchaseRow().status).toBe('ordered');
  await page.getByRole('button', { name: 'Back to purchases', exact: true }).click();
  await expect(purchase.getByRole('heading', { name: 'Cloud Oolong' })).toBeVisible();
  await expect(purchase.getByRole('heading', { name: 'Lin', exact: true })).toBeVisible();
  await expect(purchase.getByText('Part arrived', { exact: true })).toBeVisible();
  await expect(purchase.getByLabel('Studio receipt quantities')).toContainText(/Coming\s*60 g/);
  await expect(purchase.getByRole('link', { name: 'Open Stock for Cloud Oolong' })).toHaveAttribute('href', '/admin/stock?panel=tea');
  await purchase.getByRole('button', { name: 'Record arrival / manage delivery', exact: true }).click();
  await expect(arrival).toHaveValue('60');
  await receive.click();
  await expect(quantities).toContainText('Arrived 100 g');
  await page.getByRole('button',{name:'Back to purchases',exact:true}).click();
  await expect(page.getByText(/^Received/).first()).toBeVisible();
  expect(requests).toHaveLength(3);
  expect([...movements.values()]).toEqual([40, 60]);
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
  await expect(page.getByLabel('Studio receipt quantities').first().locator('.library-ribbon-metric').filter({hasText:'Received'})).toContainText('100 g');
  expect(linked).toBe(true);expect(preparations).toHaveLength(1);expect(receives).toBe(0);
});
