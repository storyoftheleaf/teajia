import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import worker from '../src/index';
import {SqliteD1,seedIdentity,signedToken} from './helpers/sqliteD1';

const databases:SqliteD1[]=[];
afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function fixture(){
 const db=new SqliteD1();databases.push(db);
 seedIdentity(db,{userId:'owner',accountId:'shop'});seedIdentity(db,{userId:'other',accountId:'other'});seedIdentity(db,{userId:'staff',accountId:'shop',role:'staff',bundles:['catalog']});
 let failProduct:string|null=null;let beforeBatch:(()=>Promise<unknown>)|null=null;
 const DB={prepare(sql:string){const stmt=db.prepare(sql);const wrapped:any={_stmt:stmt,_sql:sql,_values:[] as any[],bind(...v:any[]){wrapped._values=v;stmt.bind(...v);return wrapped},async first(){return stmt.first()},async all(){return stmt.all()},async run(){return stmt.run()}};return wrapped},async batch(stmts:any[]){if(beforeBatch&&stmts.some(s=>s._sql.includes('INSERT INTO logistics_shipments'))){const run=beforeBatch;beforeBatch=null;await run()}if(failProduct&&stmts.some(s=>s._sql.includes('INSERT INTO stock_ledger')&&s._values.includes(failProduct))){failProduct=null;throw new Error('Simulated interruption')}return db.batch(stmts.map(s=>s._stmt))}};
 for(const [id,account,user,scopes] of [['write','shop','owner',['inventory:read','stock:write']],['read','shop','owner',['inventory:read']],['other','other','other',['inventory:read','stock:write']]] as const){db.sqlite.prepare('INSERT INTO mcp_tokens(id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,account,user,user+'@test.dev',id,createHash('sha256').update('tjmcp_'+id).digest('hex'),'tjmcp_',JSON.stringify(scopes),'account_owner',Math.floor(Date.now()/1000)+3600)}
 db.sqlite.exec(`INSERT INTO products(id,account_id,type,product_name,stock_grams,quantity_units,cost_amount,quantity_purchased,image_url) VALUES('tea','shop','Red','Tea',0,0,NULL,NULL,'https://images.test/tea.jpg'),('ware','shop','Teaware','Cup',0,0,NULL,NULL,NULL);
 INSERT INTO inventory_receipts(id,account_id,state,source_kind,created_by_user_id,idempotency_key,request_fingerprint) VALUES('receipt','shop','in_transit','purchase_order','owner','invoice','{}');
 INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,unit,intended_purpose,source_kind,original_cost_amount,original_cost_currency) VALUES('tea-line','receipt','shop','tea',1000,'g','working','purchase_order',50,'USD'),('ware-line','receipt','shop','ware',4,'unit','working','purchase_order',40,'USD');
 INSERT INTO purchase_orders(id,account_id,status,receipt_id,tracking_number,created_at,updated_at) VALUES('purchase','shop','shipped','receipt','SUPPLIER-OLD',datetime('now'),datetime('now'));`);
 const env={DB,JWT_SECRET:'secret'};
 async function rpc(method:string,params:any={},token='write'){const response=await worker.fetch(new Request('https://app.test/mcp',{method:'POST',headers:{Authorization:'Bearer tjmcp_'+token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),env as never,{} as never);const body:any=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);return body}
 async function call(name:string,args:any={},token='write'){const body=await rpc('tools/call',{name,arguments:args},token);expect(body.error,JSON.stringify(body)).toBeUndefined();return JSON.parse(body.result.content[0].text)}
 async function confirm(name:string,args:any={}){const preview=await call(name,args);expect(preview.confirmation_token,JSON.stringify(preview)).toBeTruthy();return call(name,{confirm:preview.confirmation_token})}
 async function rest(method:string,path:string,body?:any,user='owner',account='shop') {const token=await signedToken('secret',{sub:user,active_account_id:account});const response=await worker.fetch(new Request('https://app.test/api/'+path,{method,headers:{Authorization:'Bearer '+token,'X-Teajia-Account':account,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env as never,{} as never);return {status:response.status,body:await response.json() as any}}
 const assignment={logistics_company_id:null,logistics_company_name:'Forwarder',inbound_courier:'Domestic',inbound_tracking_number:'INBOUND-1'};
 async function hub(){expect((await rest('PUT','logistics/orders/purchase',assignment)).status).toBe(200);expect((await confirm('mark_logistics_arrival',{purchase_id:'purchase'})).committed).toBe(true)}
 const createInput=(key='shipment',quantity=1000)=>({idempotency_key:key,logistics_company_id:null,logistics_company_name:'Forwarder',mode:'sea',lines:[{receipt_line_id:'tea-line',quantity,weight_kg:quantity/1000,weight_estimated:true,volume_m3:.008,volume_estimated:true},{receipt_line_id:'ware-line',quantity:4,weight_kg:1,weight_estimated:true,volume_m3:.004,volume_estimated:true}]});
 async function shipment(){await hub();const created=await confirm('create_logistics_shipment',createInput());return created.shipment}
 return {db,call,confirm,rpc,rest,hub,shipment,createInput,assignment,failNext:(product:string)=>{failProduct=product},race:(run:()=>Promise<unknown>)=>{beforeBatch=run}};
}
describe('supplier → logistics → studio through actual worker REST and MCP',()=>{
 it('preserves courier and tracking when the agent assigns only an address',async()=>{
  const f=fixture();await f.rest('PUT','logistics/orders/purchase',f.assignment);
  const made=await f.confirm('create_logistics_address',{label:'Warehouse',role:'warehouse',recipient:'Receiving',address_lines:'Example Street',country_code:'CN'});
  const assigned=await f.confirm('set_purchase_logistics',{purchase_id:'purchase',warehouse_address_id:made.address.id});
  expect(assigned.order).toMatchObject({inbound_courier:'Domestic',inbound_tracking_number:'INBOUND-1',logistics_company_name:'Forwarder',warehouse_address_id:made.address.id});
 });
 it('saves addresses and sourced reports through scoped REST, reflected by MCP',async()=>{
  const f=fixture();
  const address={label:'Studio',role:'destination',recipient:'Receiving',address_lines:'Example Street',country_code:'ID'};
  const made=await f.rest('POST','logistics/addresses',address);expect(made.status).toBe(200);
  const id=made.body.address.id;
  expect((await f.rest('PATCH',`logistics/addresses/${id}`,{city:'Ubud'})).body.address.city).toBe('Ubud');
  expect((await f.rest('PATCH',`logistics/addresses/${id}`,{city:'Elsewhere'},'other','other')).status).toBe(404);
  const update={kind:'purchase',entity_id:'purchase',tracking_number:'SUPPLIER-OLD',status:'Collected',reported_at:null,source_text:'The courier collected this parcel.',idempotency_key:'message-rest'};
  expect((await f.rest('POST','logistics/tracking-updates',update)).status).toBe(200);
  expect((await f.call('list_logistics')).orders[0].tracking_update).toMatchObject({status:'Collected',reported_at:null,source_text:update.source_text});
  expect((await f.rest('POST','logistics/tracking-updates',update,'other','other')).status).toBe(404);
  expect((await f.rest('POST',`logistics/addresses/${id}/archive`,{})).body.address.archived).toBe(true);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:0});
 });
 it('keeps hub arrivals and shipment dispatch out of stock, then splits, retries and completes at studio',async()=>{
  const f=fixture();const s=await f.shipment();
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:0});
  const state=await f.call('list_logistics');expect(state.orders[0]).toMatchObject({inbound_tracking_number:'INBOUND-1',logistics_arrived_at:expect.any(String)});
  expect((await f.call('record_arrival',{receipt_id:'receipt',idempotency_key:'bypass',lines:[{line_id:'tea-line',quantity:100}]})).error).toBe('purchase_uses_logistics');
  expect((await f.rest('POST','inventory/receipt-lines/tea-line/receive',{quantity:100,idempotency_key:'bypass'})).status).toBe(409);
  expect((await f.rest('POST',`logistics/shipments/${s.id}/receive`,{idempotency_key:'early',lines:[{line_id:s.lines[0].id,quantity:1}]})).status).toBe(409);
  await f.confirm('update_logistics_shipment',{shipment_id:s.id,tracking_number:'OUTBOUND-9',outbound_courier:'Air Freight'});
  await f.confirm('dispatch_logistics_shipment',{shipment_id:s.id});expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:0});
  const tea=s.lines.find((l:any)=>l.receipt_line_id==='tea-line'),ware=s.lines.find((l:any)=>l.receipt_line_id==='ware-line');
  const first={shipment_id:s.id,idempotency_key:'first',lines:[{line_id:tea.id,quantity:250},{line_id:ware.id,quantity:1}]};
  expect((await f.confirm('receive_logistics_shipment',first)).shipment.state).toBe('partially_received');
  expect((await f.confirm('receive_logistics_shipment',first)).committed).toBe(true);
  const last={...first,idempotency_key:'last',lines:[{line_id:tea.id,quantity:750},{line_id:ware.id,quantity:3}]};
  expect((await f.confirm('receive_logistics_shipment',last)).shipment.state).toBe('received');
  expect((await f.confirm('receive_logistics_shipment',last)).committed).toBe(true);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:4});expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_studio_receipts').get()).toEqual({n:4});
  expect(f.db.sqlite.prepare('SELECT stock_grams,quantity_units FROM products ORDER BY id').all()).toEqual([{stock_grams:1000,quantity_units:0},{stock_grams:0,quantity_units:4}]);
  expect((await f.call('list_logistics')).orders[0].inbound_tracking_number).toBe('INBOUND-1');
  expect(f.db.sqlite.prepare("SELECT status FROM purchase_orders WHERE id='purchase'").get()).toEqual({status:'received'});
 });
 it('requires hub arrival, protects reservations from concurrency and rejects overreceiving and changed retry quantities',async()=>{
  const f=fixture();await f.rest('PUT','logistics/orders/purchase',f.assignment);
  expect((await f.rest('POST','logistics/shipments',f.createInput())).status).toBe(409);await f.hub();
  f.race(()=>f.rest('POST','logistics/shipments',f.createInput('winner')));
  expect((await f.rest('POST','logistics/shipments',f.createInput('loser'))).status).toBe(409);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_shipments').get()).toEqual({n:1});
  const s=(await f.call('list_logistics')).shipments[0];const line=s.lines[0];await f.confirm('dispatch_logistics_shipment',{shipment_id:s.id});
  expect((await f.rest('POST',`logistics/shipments/${s.id}/receive`,{idempotency_key:'over',lines:[{line_id:line.id,quantity:line.quantity+1}]})).status).toBe(409);
  const args={shipment_id:s.id,idempotency_key:'same',lines:[{line_id:line.id,quantity:1}]};await f.confirm('receive_logistics_shipment',args);
  expect((await f.call('receive_logistics_shipment',{...args,lines:[{line_id:line.id,quantity:2}]})).error).toContain('different quantities');
  expect((await f.rest('POST','inventory/receipt-lines/tea-line/cancel-remaining',{})).status).toBe(409);
 });
 it('guards the stored expected quantity against reducing already allocated goods',async()=>{
  const f=fixture();await f.shipment();
  expect(()=>f.db.sqlite.prepare("UPDATE inventory_receipt_lines SET expected_quantity=500 WHERE id='tea-line'").run()).toThrow('goods reserved');
  expect(f.db.sqlite.prepare("SELECT expected_quantity FROM inventory_receipt_lines WHERE id='tea-line'").get()).toEqual({expected_quantity:1000});
 });
 it('atomically records studio counters with stock and resumes a partial batch failure',async()=>{
  const f=fixture();const s=await f.shipment();await f.confirm('dispatch_logistics_shipment',{shipment_id:s.id});
  const tea=s.lines.find((l:any)=>l.receipt_line_id==='tea-line'),ware=s.lines.find((l:any)=>l.receipt_line_id==='ware-line');
  const args={shipment_id:s.id,idempotency_key:'bulk',lines:[{line_id:tea.id,quantity:100},{line_id:ware.id,quantity:1}]};f.failNext('ware');
  const failed=await f.confirm('receive_logistics_shipment',args);expect(failed).toMatchObject({committed:false,partial:true});
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_studio_receipts').get()).toEqual({n:1});
  expect((await f.confirm('receive_logistics_shipment',failed.retry)).committed).toBe(true);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:2});expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_studio_receipts').get()).toEqual({n:2});
 });
 it('isolates accounts and Stock permissions, with the same scoped manifest on REST and MCP',async()=>{
  const f=fixture();const s=await f.shipment();expect((await f.rest('GET','logistics')).body).toEqual(await f.call('list_logistics'));
  expect(await f.call('list_logistics',{},'other')).toEqual({orders:[],shipments:[],services:[],addresses:[]});
  expect((await f.rest('PATCH',`logistics/shipments/${s.id}`,{tracking_number:'hijack'},'other','other')).status).toBe(404);
  expect((await f.rest('GET','logistics',undefined,'staff')).status).toBe(403);
  const names=(await f.rpc('tools/list',{},'read')).result.tools.map((x:any)=>x.name);expect(names).toContain('list_logistics');expect(names).not.toContain('receive_logistics_shipment');
  const denied=await f.rpc('tools/call',{name:'receive_logistics_shipment',arguments:{shipment_id:s.id}},'read');expect(denied.result?.isError||denied.error).toBeTruthy();
  expect((await f.rest('PUT','logistics/orders/purchase',{...f.assignment,logistics_company_id:'private-contact'})).status).toBe(404);
 });
 it('keeps unknown freight distinct, allocates estimates transparently, and preserves per-line paid costs and references',async()=>{
  const f=fixture();await f.hub();const input=f.createInput('split',500);input.lines=input.lines.filter(l=>l.receipt_line_id==='tea-line');
  const made=await f.rest('POST','logistics/shipments',input);const s=made.body.shipment;
  expect(s.freight_total).toBeNull();expect(s.freight_issue).toContain('not been entered');expect(s.lines[0]).toMatchObject({original_cost_amount:25,original_cost_currency:'USD',image_url:'https://images.test/tea.jpg'});
  const update={freight:{basis:'m3',rate:100,billed_quantity:.1,total_amount:null,currency:'CNY',confirmed:false},lines:[{id:s.lines[0].id,image_url:'https://photo.test/cup.jpg',source_url:'https://supplier.test/cup'}]};
  const changed=(await f.rest('PATCH',`logistics/shipments/${s.id}`,update)).body.shipment;expect(changed).toMatchObject({freight_total:10,freight_estimated:true});expect(changed.lines[0].allocated_freight).toBe(10);
  expect((await f.rest('PATCH',`logistics/shipments/${s.id}`,{lines:[{id:s.lines[0].id,image_url:'javascript:evil()'}]})).status).toBe(400);
  expect(f.db.sqlite.prepare("SELECT shipping_rate_per_kg,cost_amount FROM products WHERE id='tea'").get()).toEqual({shipping_rate_per_kg:null,cost_amount:null});
  expect((await f.rest('POST','logistics/shipments',input)).body.shipment.id).toBe(s.id);
  expect((await f.rest('POST','logistics/shipments',{...input,mode:'air'})).status).toBe(409);
  const remaining=(await f.call('list_logistics')).orders[0].lines.find((l:any)=>l.id==='tea-line');expect(remaining.available_quantity).toBe(500);
 });
 it('combines suppliers only at the same company and preserves their separate tracking and split costs',async()=>{
  const f=fixture();await f.hub();f.db.sqlite.exec(`INSERT INTO inventory_receipts(id,account_id,state,source_kind,created_by_user_id,idempotency_key,request_fingerprint) VALUES('second-receipt','shop','ordered','purchase_order','owner','invoice-two','{}');
   INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,unit,intended_purpose,source_kind,original_cost_amount,original_cost_currency) VALUES('second-line','second-receipt','shop','ware',6,'unit','working','purchase_order',120,'CNY');
   INSERT INTO purchase_orders(id,account_id,status,receipt_id,vendor_name,created_at,updated_at) VALUES('second','shop','ordered','second-receipt','Supplier Two',datetime('now'),datetime('now'));`);
  await f.rest('PUT','logistics/orders/second',{...f.assignment,logistics_company_name:'Other Forwarder',inbound_tracking_number:'SUPPLIER-TWO'});
  await f.confirm('mark_logistics_arrival',{purchase_id:'second'});
  const input={...f.createInput('combined',500),lines:[{receipt_line_id:'tea-line',quantity:500},{receipt_line_id:'second-line',quantity:3}]};
  expect((await f.rest('POST','logistics/shipments',input)).status).toBe(409);
  await f.rest('PUT','logistics/orders/second',{...f.assignment,inbound_tracking_number:'SUPPLIER-TWO'});
  expect((await f.rest('POST','logistics/shipments',input)).status).toBe(409); // a new company needs its own arrival
  await f.confirm('mark_logistics_arrival',{purchase_id:'second'});
  const created=await f.rest('POST','logistics/shipments',input);expect(created.status).toBe(200);
  expect(created.body.shipment.lines).toEqual(expect.arrayContaining([expect.objectContaining({purchase_id:'purchase',original_cost_amount:25,original_cost_currency:'USD'}),expect.objectContaining({purchase_id:'second',original_cost_amount:60,original_cost_currency:'CNY'})]));
  const orders=(await f.call('list_logistics')).orders;expect(orders.find((o:any)=>o.purchase_id==='purchase').inbound_tracking_number).toBe('INBOUND-1');expect(orders.find((o:any)=>o.purchase_id==='second').inbound_tracking_number).toBe('SUPPLIER-TWO');
 });
 it('saves company services, isolates them, and freezes shipment quotes across service edits and archive retries',async()=>{
  const f=fixture();f.db.sqlite.exec("INSERT INTO customers(id,account_id,name,type) VALUES('forwarder','shop','Forwarder','logistics'),('foreign-forwarder','other','Foreign','logistics')");
  const input={logistics_company_id:'forwarder',logistics_company_name:'Forwarder',name:'Airmail',mode:'air',basis:'kg',rate:90,currency:'CNY'};
  const made=await f.confirm('create_logistics_service',input);expect(made.service).toMatchObject({...input,active:true});
  const serviceId=made.service.id;
  expect((await f.rest('PATCH',`logistics/services/${serviceId}`,{rate:1},'other','other')).status).toBe(404);
  expect((await f.rest('POST','logistics/services',{...input,logistics_company_id:'foreign-forwarder'})).status).toBe(404);
  await f.rest('PUT','logistics/orders/purchase',{...f.assignment,logistics_company_id:'forwarder'});await f.confirm('mark_logistics_arrival',{purchase_id:'purchase'});
  const request={...f.createInput('quoted'),logistics_company_id:'forwarder',mode:'air',service_id:serviceId};
  const s=(await f.rest('POST','logistics/shipments',request)).body.shipment;
  expect(s.service_quote).toMatchObject({name:'Airmail',rate:90,currency:'CNY'});expect(s.freight).toMatchObject({basis:'kg',rate:90,billed_quantity:null,total_amount:null,confirmed:false});expect(s.freight_total).toBeNull();
  await f.confirm('update_logistics_service',{service_id:serviceId,rate:100});
  await f.confirm('archive_logistics_service',{service_id:serviceId});
  const replay=(await f.rest('POST','logistics/shipments',request)).body;expect(replay.already_created).toBe(true);expect(replay.shipment.service_quote.rate).toBe(90);expect(replay.shipment.freight.rate).toBe(90);
  expect((await f.rest('POST','logistics/shipments',{...request,idempotency_key:'new'})).status).toBe(409);
  const fixed=(await f.rest('POST','logistics/services',{...input,name:'Fixed parcel',basis:'fixed',rate:12})).body.service;
  await f.rest('POST',`logistics/shipments/${s.id}/cancel`,{});
  const fixedShipment=(await f.rest('POST','logistics/shipments',{...request,idempotency_key:'fixed',service_id:fixed.id})).body.shipment;
  expect(fixedShipment.freight_total).toBe(12);expect(fixedShipment.freight_estimated).toBe(true);
  expect((await f.call('list_logistics',{},'other')).services).toEqual([]);
 });
 it('requires a fresh preview if the selected service quote changes before confirmation',async()=>{
  const f=fixture();f.db.sqlite.exec("INSERT INTO customers(id,account_id,name,type) VALUES('forwarder','shop','Forwarder','logistics')");
  const service=(await f.rest('POST','logistics/services',{logistics_company_id:'forwarder',logistics_company_name:'Forwarder',name:'Sea',mode:'sea',basis:'m3',rate:120,currency:'CNY'})).body.service;
  await f.rest('PUT','logistics/orders/purchase',{...f.assignment,logistics_company_id:'forwarder'});await f.confirm('mark_logistics_arrival',{purchase_id:'purchase'});
  const preview=await f.call('create_logistics_shipment',{...f.createInput('changed'),logistics_company_id:'forwarder',service_id:service.id});
  expect(preview.preview.service_quote.rate).toBe(120);
  await f.rest('PATCH',`logistics/services/${service.id}`,{rate:150});
  expect((await f.call('create_logistics_shipment',{confirm:preview.confirmation_token})).error).toContain('quote changed');
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_shipments').get()).toEqual({n:0});
 });
 it('applies the logistics migration on the real migration ledger',()=>{
  const db=new SqliteD1('migrations','0052');databases.push(db);
  expect(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'logistics_%'").all()).toHaveLength(4);
  expect(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='logistics_reserve_line'").get()).toBeTruthy();
 });
 it('releases draft allocations for regrouping, retaining cancelled manifest and refusing dispatched cancellation',async()=>{
  const f=fixture();const s=await f.shipment();
  expect((await f.rest('POST',`logistics/shipments/${s.id}/cancel`,{})).body.shipment.state).toBe('cancelled');
  const read=await f.call('list_logistics');expect(read.orders[0].lines.find((l:any)=>l.id==='tea-line').available_quantity).toBe(1000);expect(read.shipments[0].lines).toHaveLength(2);
  const next=(await f.rest('POST','logistics/shipments',f.createInput('replacement'))).body.shipment;expect(next.id).not.toBe(s.id);
  await f.confirm('dispatch_logistics_shipment',{shipment_id:next.id});
  expect((await f.rest('POST',`logistics/shipments/${next.id}/cancel`,{})).status).toBe(409);
  expect((await f.rest('PATCH',`logistics/shipments/${s.id}`,{tracking_number:'change history'})).status).toBe(409);
 });
 it('offers the same estimated packing rules to agents with strict item validation',async()=>{
  const f=fixture();const result=await f.call('estimate_logistics_volume',{items:[{id:'tea',kind:'loose_tea',quantity:1000,unit:'g'},{id:'cup',kind:'cup',quantity:4,unit:'unit'},{id:'other',kind:'other',quantity:1,unit:'unit'}]},'read');
  expect(result.items).toEqual([expect.objectContaining({id:'tea',volume_m3:.008,estimated:true}),expect.objectContaining({id:'cup',volume_m3:.002,estimated:true}),expect.objectContaining({id:'other',volume_m3:null,estimated:true})]);
  expect((await f.call('estimate_logistics_volume',{items:[{id:'x',kind:'invented',quantity:1,unit:'unit'}]})).error).toBeTruthy();
 });
 it('allows legacy direct receipts while refusing them for a managed purchase before a shipment exists',async()=>{
  const f=fixture();expect((await f.confirm('record_arrival',{receipt_id:'receipt',idempotency_key:'legacy',lines:[{line_id:'tea-line',quantity:100}]})).committed).toBe(true);
  await f.rest('PUT','logistics/orders/purchase',f.assignment);
  expect((await f.rest('POST','inventory/receipt-lines/tea-line/receive',{quantity:100,idempotency_key:'managed'})).status).toBe(409);
  expect(f.db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()).toEqual({stock_grams:100});
 });
});
