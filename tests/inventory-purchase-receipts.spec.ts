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
    if(path==='/api/purchase-orders')return route.fulfill({json:[{id:'purchase',vendor_name:'Lin',status:poStatus,items_json:JSON.stringify([{product_id:'tea',product_name:'Cloud Oolong',quantity:100,unit:'g'}]),created_at:'2026-10-28'}]});
    if(path==='/api/purchase-orders/purchase/prepare-receipt')return route.fulfill({json:{receipt_id:'receipt',unresolved_items:[]}});
    if(path==='/api/inventory/receipts')return route.fulfill({json:[{id:'receipt',state:poStatus==='received'?'received':'ordered',vendor_name:'Lin',source_kind:'purchase_order',lines:[{id:'line',product_id:'tea',product_name:'Cloud Oolong',expected_quantity:100,received_quantity:received,cancelled_quantity:0,current_on_hand:received,unit:'g',intended_purpose:'working'}]}]});
    if(path==='/api/inventory/receipt-lines/line/receive'){
      requests.push(route.request().postDataJSON());received=100;poStatus='received';
      return route.fulfill({json:{received_quantity:100,remaining_quantity:0,state:'received',ledger_id:'movement'}});
    }
    if(path==='/api/rpc/increment-stock'){increments++;return route.fulfill({status:500,json:{error:'Legacy increment must not run'}})}
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/purchase-orders');
  await page.getByRole('button',{name:'Receive',exact:true}).click();
  await expect(page.getByText('Current on hand: 0',{exact:false})).toBeVisible();
  expect(poStatus).toBe('ordered');
  await page.getByRole('button',{name:'Receive',exact:true}).click();
  await expect(page.getByText('Received here: 100',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Back to purchases',exact:true}).click();
  await expect(page.getByRole('combobox')).toHaveValue('received');
  await expect(page.getByRole('combobox')).toBeDisabled();
  expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({quantity:100,idempotency_key:expect.any(String)});
  expect(increments).toBe(0);
});
