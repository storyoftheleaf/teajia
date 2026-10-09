import { expect, test, type Page } from './fixtures';
const enc=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const membership={account_id:'acct',account_name:'Test shop',role:'owner',bundles:['catalog','stock','publish']};
const token=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:'owner',email:'owner@test',role:'owner',active_account_id:'acct',memberships:[membership],exp:Math.floor(Date.now()/1000)+86400})}.sig`;
async function seed(page:Page, unknown=false, form?:string) {
 let grams:number|null=unknown?null:25; const requests:any[]=[];
 const tea={id:'sample-tea',account_id:'acct',user_id:'owner',name:'Mountain Oolong',vendor_id:'vendor',vendor_name:'Lin',type:'Oolong',form,sample_state:'received',price_amount:100,price_currency:'Yuan',price_per_unit_grams:500,status:'noted',category:'tea',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'};
 await page.addInitScript(({jwt,m})=>{
  localStorage.setItem('teajia_token',jwt);
  localStorage.setItem('teajia-storage',JSON.stringify({version:2,state:{activeAccountId:'acct',activeUserId:'owner',memberships:[m]}}));
  localStorage.setItem('teajia-admin-storage',JSON.stringify({version:1,state:{activeAccountId:'acct',activeUserId:'owner',memberships:[m]}}));
 },{jwt:token,m:membership});
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{id:'owner',email:'owner@test',name:'Owner',role:'owner',memberships:[membership],active_account_id:'acct'}});
  if(path==='/api/auth/refresh')return route.fulfill({json:{token}});
  if(path==='/api/accounts/acct')return route.fulfill({json:{id:'acct',name:'Test shop',slug:'test'}});
  if(path==='/api/curate/holdings')return route.fulfill({json:[{entry:tea,stock_grams:0,sample_grams:grams,samples:[{id:'portion',name:'Received portion',grams,status:'received',set_id:'set',compass_entry_id:tea.id}]}]});
  if(path==='/api/curate/correct'){
   const body=route.request().postDataJSON();const measuring=body.command.action==='edit';requests.push({kind:measuring?'measure':'taste',body});
   if(body.confirm){grams=measuring?body.command.fields.grams:Number(grams)-body.command.consumed_grams;return route.fulfill({json:{confirmed:true,mutation_id:'taste-change'}});}
   return route.fulfill({json:{preview:{changes:[{entity:'sample',after:{grams:measuring?body.command.fields.grams:Number(grams)-body.command.consumed_grams}}]},confirmation_token:'taste-token'}});
  }
  if(path==='/api/curate/order'){
   const body=route.request().postDataJSON();requests.push({kind:'order',body});
   return route.fulfill({json:body.confirm?{committed:true,purchase_order_id:'order'}:{preview:{read_back:'Order from Lin: 500 g of Mountain Oolong at 100 Yuan.',after_confirm:'The order waits on Purchase Orders; approve the arrival into stock.'},confirmation_token:'order-token'}});
  }
  if(path==='/api/compass/entries')return route.fulfill({json:{entries:[tea]}});
  if(path==='/api/notes')return route.fulfill({json:{notes:[]}});
  if(path==='/api/products')return route.fulfill({json:[]});
  return route.fulfill({json:[]});
 });
 return requests;
}
test('samples without products stay separate and tasting/order require review and confirmation',async({page},testInfo)=>{
 const requests=await seed(page);await page.goto('/admin/inventory?stock_view=samples');
 const view=page.getByRole('region',{name:'Samples-only inventory'});
 await expect(view.getByText('Mountain Oolong',{exact:true})).toBeVisible({timeout:20000});
 await expect(view.getByText('25 g',{exact:true})).toBeVisible();await expect(view.getByText('0 g',{exact:true})).toBeVisible();
 await view.getByRole('button',{name:'Taste sample',exact:true}).click();
 await view.getByLabel('Grams consumed').fill('5');await view.getByLabel('Score, optional').fill('8');
 await view.getByText('Tasting terms, optional').click();await view.getByLabel('Flavor').selectOption('honey');
 await view.getByRole('button',{name:'Review tasting'}).click();
 await expect(view.getByText(/Consume 5 g from this portion; 20 g will remain/)).toBeVisible();
 await expect(view.getByText('Tasting: Honey',{exact:true})).toBeVisible();
 await expect(view.getByLabel('Review change').getByRole('button')).toHaveText(['Cancel','Change details','Confirm tasting']);
 expect(requests.filter(r=>r.kind==='taste')).toHaveLength(1);
 expect(requests[0].body.command).toMatchObject({action:'taste_sample',entity:'sample',id:'portion',consumed_grams:5,score:8,tasting:{flavor:['honey']}});
 await view.getByRole('button',{name:'Confirm tasting'}).click();
 await expect(view.getByText('20 g',{exact:true})).toBeVisible();
 expect(requests.filter(r=>r.kind==='taste')[1].body.confirm).toBe('taste-token');
 await view.getByRole('button',{name:'Order tea',exact:true}).click();await view.getByLabel('Quantity requested').fill('500');
 await view.getByRole('button',{name:'Review order'}).click();
 await expect(view.getByText('Order from Lin: 500 g of Mountain Oolong at 100 Yuan.')).toBeVisible();
 expect(requests.filter(r=>r.kind==='order')).toHaveLength(1);
 expect(requests.find(r=>r.kind==='order').body).toMatchObject({vendor_id:'vendor',lines:[{tea_id:'sample-tea',quantity:{amount:500,unit:'g'}}]});
 await view.getByRole('button',{name:'Confirm order'}).click();
 await expect(view.getByRole('status')).toContainText('Order created');
 expect(requests.filter(r=>r.kind==='order')[1].body.confirm).toBe('order-token');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
 await page.screenshot({path:testInfo.outputPath('samples-only.png'),fullPage:true});
});
test('inventory toggle opens real sample portions and zero consumption is explicit',async({page})=>{
 const requests=await seed(page);await page.goto('/admin/inventory');
 await page.getByRole('button',{name:'Samples only',exact:true}).click();
 await expect(page).toHaveURL(/stock_view=samples/);
 const view=page.getByRole('region',{name:'Samples-only inventory'});await expect(view.getByText('Mountain Oolong',{exact:true})).toBeVisible();
 await view.getByRole('button',{name:'Taste sample',exact:true}).click();await view.getByLabel('Grams consumed').fill('0');
 await view.getByRole('button',{name:'Review tasting'}).click();await expect(view.getByText(/Consume 0 g.*25 g will remain/)).toBeVisible();
 await view.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(requests.filter(r=>r.kind==='taste')).toHaveLength(1);expect(requests[0].body.confirm).toBeUndefined();
});

test('Edit tea loads the existing Curate capture form for a legacy Loose Leaf record',async({page})=>{
 await seed(page,false,'Loose Leaf');
 await page.goto('/admin/inventory?stock_view=samples');
 await page.getByRole('button',{name:'Edit tea',exact:true}).click();
 await expect(page.getByRole('button',{name:'Back to samples'})).toBeVisible();
 await expect(page.locator('input[value="Mountain Oolong"]')).toBeVisible();
 await page.getByRole('button',{name:'Back to samples'}).click();
 await expect(page.getByRole('region',{name:'Samples-only inventory'})).toBeVisible();
});

test('an unknown portion must have its measured grams reviewed before tasting',async({page})=>{
 const requests=await seed(page,true);await page.goto('/admin/inventory?stock_view=samples');
 const view=page.getByRole('region',{name:'Samples-only inventory'});
 await expect(view.getByText(/Weight not recorded/)).toBeVisible();
 await expect(view.getByRole('button',{name:'Taste sample',exact:true})).toBeDisabled();
 await view.getByRole('button',{name:'Record grams',exact:true}).click();
 await view.getByLabel('Measured grams remaining').fill('0');await view.getByRole('button',{name:'Review measurement'}).click();
 await expect(view.getByText('Record 0 g as the measured remaining weight. This does not consume the sample.')).toBeVisible();
 expect(requests.filter(r=>r.kind==='measure')).toHaveLength(1);
 expect(requests[0].body.command).toEqual({action:'edit',entity:'sample',id:'portion',fields:{grams:0}});
 await expect(view.getByText(/Weight not recorded/)).toBeVisible();
 await view.getByRole('button',{name:'Confirm measurement'}).click();
 await expect(view.getByRole('status')).toContainText('Measured sample weight recorded');
 await expect(view.getByRole('button',{name:'Taste sample',exact:true})).toBeEnabled();
 expect(requests.filter(r=>r.kind==='measure')[1].body.confirm).toBe('taste-token');
});
