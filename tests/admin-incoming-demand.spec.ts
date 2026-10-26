import { test, expect, type Page } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'admin-incoming',email:'incoming@test.dev',role:'owner',platform_role:'platform_owner',active_account_id:'incoming-account',exp:Math.floor(Date.now()/1000)+86400*30,memberships:[{account_id:'incoming-account',account_name:'Incoming test',role:'owner',slug:'incoming-test'}]})}.fake`;

async function prepare(page:Page) {
  const reads:string[]=[];
  let shares=[{id:'share-a',tea_key:'Test tea A',shared_metadata:{teaName:'Test tea A'},source_user_name:'Supplier A'},{id:'share-b',tea_key:'Test tea B',shared_metadata:{teaName:'Test tea B'},source_user_name:'Supplier B'}];
  await page.clock.install();
  await page.addInitScript(value=>localStorage.setItem('teajia_token',value),token);
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    let body:unknown=[];
    if(path==='/api/auth/me')body={id:'admin-incoming',email:'incoming@test.dev',role:'owner'};
    if(path==='/api/auth/refresh')body={token};
    if(path==='/api/accounts/incoming-account')body={id:'incoming-account',name:'Incoming test',slug:'incoming-test'};
    if(path==='/api/rates')body=[{currency:'Yuan',rate_to_usd:0.14,last_updated:new Date().toISOString()}];
    if(path==='/api/platform/exchange-rates')body={rates:[]};
    if(path==='/api/curate/journeys')body={journeys:[]};
    if(path==='/api/curate/visits')body={visits:[]};
    if(path==='/api/curate/receipt-proposals')body={pending:[]};
    if(path==='/api/compass/entries')body={entries:[]};
    if(path==='/api/compass/incoming'){reads.push(path);body={shares};}
    const mutation=path.match(/^\/api\/compass\/shares\/([^/]+)\/(accept|decline)$/);
    if(mutation){shares=shares.filter(share=>share.id!==mutation[1]);body={success:true};}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  return reads;
}

test('unrelated admin screen never fetches incoming shares, including after the former polling interval',async({page})=>{
  const reads=await prepare(page);
  await page.goto('/admin/currency');
  await expect(page.getByText('Exchange rates',{exact:true})).toBeVisible({timeout:15_000});
  await page.clock.fastForward(61_000);
  expect(reads).toEqual([]);
});

for(const path of ['/admin/compass?tab=library','/admin/compass/v2?tab=library']) {
  test(`incoming shares remain fresh and accept/decline invalidate the open inbox: ${path}`,async({page})=>{
    const reads=await prepare(page);
    await page.goto(path);
    await expect(page.getByText('2 pending shares').filter({visible:true}).first()).toBeVisible();
    const before=reads.length;
    await page.clock.fastForward(61_000);
    await expect.poll(()=>reads.length).toBeGreaterThan(before);
    const beforeAccept=reads.length;
    await page.getByRole('button',{name:'Accept',exact:true}).first().click();
    await expect(page.getByText('1 pending share',{exact:true}).filter({visible:true}).first()).toBeVisible();
    await expect.poll(()=>reads.length).toBeGreaterThan(beforeAccept);
    const afterAccept=reads.length;
    await page.getByRole('button',{name:'Decline',exact:true}).first().click();
    await expect(page.getByText('1 pending share',{exact:true})).toHaveCount(0);
    await expect.poll(()=>reads.length).toBeGreaterThan(afterAccept);
  });
}
