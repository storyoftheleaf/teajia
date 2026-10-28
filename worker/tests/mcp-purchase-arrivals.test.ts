import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import worker from '../src/index';
import {readPurchaseTracking} from '../src/purchaseTracking';
import {SqliteD1,seedIdentity,signedToken} from './helpers/sqliteD1';

const databases:SqliteD1[]=[];
afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function fixture(){
 const db=new SqliteD1();databases.push(db);seedIdentity(db,{userId:'owner',accountId:'shop'});seedIdentity(db,{userId:'other',accountId:'other'});
 // D1 is asynchronous; keep the real SQLite statements/transactions underneath.
 let failProduct:string|null=null;let beforeCancel:(()=>Promise<unknown>)|null=null;
 const DB={prepare(sql:string){const stmt=db.prepare(sql);const wrapped:any={_stmt:stmt,_sql:sql,_values:[] as any[],bind(...v:any[]){wrapped._values=v;stmt.bind(...v);return wrapped},async first(){return stmt.first()},async all(){return stmt.all()},async run(){return stmt.run()}};return wrapped;},async batch(stmts:any[]){if(beforeCancel&&stmts.some(s=>s._sql.includes('cancelled_quantity=expected_quantity-received_quantity'))){const action=beforeCancel;beforeCancel=null;await action();}if(failProduct&&stmts.some(s=>s._sql.includes('INSERT INTO stock_ledger')&&s._values.includes(failProduct))){failProduct=null;throw new Error('Simulated storage interruption');}return db.batch(stmts.map(s=>s._stmt));}};
 for(const [id,account,user,scopes] of [['write','shop','owner',['inventory:read','stock:write']],['read','shop','owner',['inventory:read']],['other','other','other',['inventory:read','stock:write']]] as const){
  db.sqlite.prepare("INSERT INTO mcp_tokens(id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,account,user,user+'@test.dev',id,createHash('sha256').update('tjmcp_'+id).digest('hex'),'tjmcp_',JSON.stringify(scopes),'account_owner',Math.floor(Date.now()/1000)+3600);
 }
 db.sqlite.exec(`INSERT INTO products(id,account_id,type,product_name,stock_grams,quantity_units,cost_amount,quantity_purchased) VALUES('tea','shop','Red','Tea',0,0,NULL,NULL),('ware','shop','Teaware','Cup',0,0,NULL,NULL);
 INSERT INTO inventory_receipts(id,account_id,state,source_kind,created_by_user_id,idempotency_key,request_fingerprint) VALUES('receipt','shop','in_transit','purchase_order','owner','invoice','{}');
 INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,unit,intended_purpose,source_kind,original_cost_amount,original_cost_currency) VALUES('tea-line','receipt','shop','tea',1000,'g','working','purchase_order',50,'USD'),('ware-line','receipt','shop','ware',4,'unit','working','purchase_order',40,'USD');
 INSERT INTO purchase_orders(id,account_id,status,receipt_id,created_at,updated_at) VALUES('purchase','shop','shipped','receipt',datetime('now'),datetime('now'));`);
 const env={DB,JWT_SECRET:'secret'};
 async function rpc(method:string,params:any={},token='write'){
  const response=await worker.fetch(new Request('https://app.test/mcp',{method:'POST',headers:{Authorization:'Bearer tjmcp_'+token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),env as never,{} as never);
  const body:any=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);return body;
 }
 async function call(name:string,args:any={},token='write') {const body=await rpc('tools/call',{name,arguments:args},token);expect(body.error,JSON.stringify(body)).toBeUndefined();return JSON.parse(body.result.content[0].text);}
 async function confirm(name:string,args:any){const preview=await call(name,args);expect(preview.confirmation_token,JSON.stringify(preview)).toBeTruthy();return call(name,{confirm:preview.confirmation_token});}
 return {db,env,rpc,call,confirm,failNextArrivalFor:(id:string)=>{failProduct=id;},beforeCancel:(action:()=>Promise<unknown>)=>{beforeCancel=action;}};
}

describe('real MCP purchase arrival dispatch',()=>{
 it('advertises scoped tools and uses the same account-scoped tracking read as REST',async()=>{
  const {env,rpc,call}=fixture();const names=(await rpc('tools/list')).result.tools.map((x:any)=>x.name);expect(names).toContain('record_arrival');expect(names).toContain('list_purchases');
  expect((await rpc('tools/list',{},'read')).result.tools.map((x:any)=>x.name)).not.toContain('record_arrival');
  const token=await signedToken('secret',{sub:'owner',active_account_id:'shop'});
  const response=await worker.fetch(new Request('https://app.test/api/purchase-orders/tracking',{headers:{Authorization:'Bearer '+token,'X-Teajia-Account':'shop'}}),env as never,{} as never);
  expect(response.status).toBe(200);expect(await response.json()).toEqual(await call('list_purchases'));
  expect(await call('get_purchase',{id:''})).toEqual({error:'purchase_id_required'});
  expect(await call('get_purchase',{id:'purchase'},'other')).toEqual({error:'purchase_not_found'});
 });
 it('previews, receives partial quantities, replays safely and completes purchase with financial basis intact',async()=>{
  const {db,call,confirm}=fixture();const args={receipt_id:'receipt',idempotency_key:'arrival-one',lines:[{line_id:'tea-line',quantity:250},{line_id:'ware-line',quantity:1}]};
  const preview=await call('record_arrival',args);expect(preview.preview.lines).toHaveLength(2);expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:0});
  const first=await call('record_arrival',{confirm:preview.confirmation_token});expect(first.committed,JSON.stringify(first)).toBe(true);expect(first.rows[0].receipt.state).toBe('partially_received');expect(first.rows[0].attention).toEqual([]);expect(first.rows[0].history).toHaveLength(2);
  expect(db.sqlite.prepare("SELECT cost_amount,cost_currency,quantity_purchased FROM products WHERE id='tea'").get()).toEqual({cost_amount:50,cost_currency:'USD',quantity_purchased:1000});
  expect(db.sqlite.prepare("SELECT cost_amount,cost_currency,quantity_purchased FROM products WHERE id='ware'").get()).toEqual({cost_amount:10,cost_currency:'USD',quantity_purchased:1});
  expect((await confirm('record_arrival',args)).committed).toBe(true);expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:2});
  const done=await confirm('record_arrival',{...args,idempotency_key:'arrival-two',lines:[{line_id:'tea-line',quantity:750},{line_id:'ware-line',quantity:3}]});
  expect(done.committed).toBe(true);expect(done.rows[0].receipt.state).toBe('received');expect(done.rows[0].purchase.status).toBe('received');expect(done.rows[0].history).toHaveLength(4);
  expect(db.sqlite.prepare('SELECT stock_grams,quantity_units FROM products ORDER BY id').all()).toEqual([{stock_grams:1000,quantity_units:0},{stock_grams:0,quantity_units:4}]);
 });
 it('rejects cross-account, oversized, fractional and conflicting arrivals before any stock write',async()=>{
  const {db,call,confirm}=fixture();const args={receipt_id:'receipt',idempotency_key:'one',lines:[{line_id:'tea-line',quantity:100}]};
  expect(await call('record_arrival',args,'other')).toEqual({error:'receipt_not_found'});
  expect(await call('record_arrival',{...args,lines:[{line_id:'tea-line',quantity:100},{line_id:'ware-line',quantity:0.5}]})).toMatchObject({error:'invalid_arrival_quantity'});
  expect(await call('record_arrival',{...args,lines:[{line_id:'tea-line',quantity:1001}]})).toMatchObject({error:'invalid_arrival_quantity'});
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:0});
  await confirm('record_arrival',args);expect(await call('record_arrival',{...args,lines:[{line_id:'tea-line',quantity:101}]})).toMatchObject({error:'arrival_request_conflict'});
  const stale=await call('record_arrival',{...args,idempotency_key:'stale',lines:[{line_id:'tea-line',quantity:900}]});await confirm('record_arrival',{...args,idempotency_key:'next'});
  expect(await call('record_arrival',{confirm:stale.confirmation_token})).toMatchObject({error:'invalid_arrival_quantity'});
  expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()).toEqual({stock_grams:200});
 });
 it('updates tracking and cancels only the remaining quantity without changing received stock',async()=>{
  const {db,confirm}=fixture();await confirm('record_arrival',{receipt_id:'receipt',idempotency_key:'partial',lines:[{line_id:'tea-line',quantity:100}]});
  const tracked=await confirm('update_delivery_tracking',{receipt_id:'receipt',eta:'2099-01-01',transport_mode:'air',tracking_number:'TEST123'});expect(tracked.rows[0].receipt).toMatchObject({eta:'2099-01-01',transport_mode:'air'});expect(tracked.rows[0].purchase.tracking_number).toBe('TEST123');
  expect((await confirm('cancel_delivery_remainder',{line_id:'tea-line'})).committed).toBe(true);
  expect(db.sqlite.prepare("SELECT received_quantity,cancelled_quantity FROM inventory_receipt_lines WHERE id='tea-line'").get()).toEqual({received_quantity:100,cancelled_quantity:900});expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()).toEqual({stock_grams:100});
 });
 it('reports a partial bulk failure and resumes the identical arrival without duplicating stock',async()=>{
  const {db,confirm,failNextArrivalFor}=fixture();const args={receipt_id:'receipt',idempotency_key:'bulk',lines:[{line_id:'tea-line',quantity:100},{line_id:'ware-line',quantity:1}]};
  failNextArrivalFor('ware');const failed=await confirm('record_arrival',args);expect(failed).toMatchObject({committed:false,partial:true,retry:args});expect(failed.recorded).toHaveLength(1);
  const recovered=await confirm('record_arrival',failed.retry);expect(recovered.committed).toBe(true);expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:2});expect(db.sqlite.prepare('SELECT stock_grams,quantity_units FROM products ORDER BY id').all()).toEqual([{stock_grams:100,quantity_units:0},{stock_grams:0,quantity_units:1}]);
 });
 it('keeps unknown cost unknown, preserves a known shelf basis and accepts an explicitly free invoice',async()=>{
  const {db,confirm}=fixture();db.sqlite.exec("UPDATE inventory_receipt_lines SET original_cost_amount=NULL WHERE id='tea-line';UPDATE products SET cost_amount=7,cost_currency='USD',quantity_purchased=1 WHERE id='ware'");
  await confirm('record_arrival',{receipt_id:'receipt',idempotency_key:'unknown',lines:[{line_id:'tea-line',quantity:100},{line_id:'ware-line',quantity:1}]});
  expect(db.sqlite.prepare('SELECT cost_amount FROM products ORDER BY id').all()).toEqual([{cost_amount:null},{cost_amount:7}]);
  // A new empty holding, with a supplier explicitly stating zero, is free rather than unknown.
  db.sqlite.exec("INSERT INTO products(id,account_id,type,product_name,stock_grams,cost_amount) VALUES('free','shop','Red','Free sample',0,NULL); INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,unit,intended_purpose,source_kind,original_cost_amount) VALUES('free-line','receipt','shop','free',10,'g','working','purchase_order',0)");
  await confirm('record_arrival',{receipt_id:'receipt',idempotency_key:'free',lines:[{line_id:'free-line',quantity:10}]});expect(db.sqlite.prepare("SELECT cost_amount FROM products WHERE id='free'").get()).toEqual({cost_amount:0});
 });

 it('bridges a legacy proposal to the existing purchase receipt and makes repeated acceptance harmless',async()=>{
  const {db,env,call}=fixture();db.sqlite.exec("INSERT INTO tea_compass_entries(id,account_id,name) VALUES('identity','shop','Tea'); UPDATE purchase_orders SET items_json='[{\"compass_entry_id\":\"identity\",\"quantity_grams\":1000,\"line_total\":50,\"currency\":\"USD\"}]' WHERE id='purchase';INSERT INTO curate_receipt_proposals(id,account_id,product_id,product_name,product_type,purpose,quantity,unit,acquisition_kind,acquisition_state,status,idempotency_key,proposed_by_user_id) VALUES('legacy','shop','tea','Tea','Red','working',1000,'g','purchase','in_transit','pending','order:purchase:identity','owner'),('standalone','shop','ware','Cup','Teaware','working',1,'unit','purchase','in_transit','pending','standalone','owner');UPDATE curate_receipt_proposals SET compass_entry_id='identity' WHERE id='legacy'");
  const tracking=await call('list_purchases');expect(tracking.rows.filter((r:any)=>r.id==='proposal:standalone')).toHaveLength(1);expect(tracking.rows.filter((r:any)=>r.id==='proposal:legacy')).toHaveLength(0);
  const preview=await call('curate_approve_arrival',{arrival_id:'legacy'});expect(preview.confirmation_token,JSON.stringify(preview)).toBeTruthy();const accepted=await call('curate_approve_arrival',{arrival_id:'legacy',confirm:preview.confirmation_token});expect(accepted.committed,JSON.stringify(accepted)).toBe(true);
  expect(db.sqlite.prepare("SELECT received_quantity FROM inventory_receipt_lines WHERE id='tea-line'").get()).toEqual({received_quantity:1000});expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:1});
  const token=await signedToken('secret',{sub:'owner',active_account_id:'shop'});
  const response=await worker.fetch(new Request('https://app.test/api/curate/receipt-proposals/legacy/accept',{method:'POST',headers:{Authorization:'Bearer '+token,'X-Teajia-Account':'shop'}}),env as never,{} as never);
  expect(response.status).toBe(200);expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({n:1});
 });

 it('refuses private tracking for an account member without Stock access',async()=>{
  const {db,env}=fixture();seedIdentity(db,{accountId:'shop',userId:'catalog-staff',role:'staff',bundles:['catalog']});
  const token=await signedToken('secret',{sub:'catalog-staff',active_account_id:'shop'});
  const response=await worker.fetch(new Request('https://app.test/api/purchase-orders/tracking',{headers:{Authorization:'Bearer '+token,'X-Teajia-Account':'shop'}}),env as never,{} as never);expect(response.status).toBe(403);
 });
 it('refuses a stale cancellation when another arrival wins immediately before its database batch',async()=>{
  const {db,confirm,beforeCancel}=fixture();beforeCancel(()=>confirm('record_arrival',{receipt_id:'receipt',idempotency_key:'concurrent-arrival',lines:[{line_id:'tea-line',quantity:100}]}));
  const result=await confirm('cancel_delivery_remainder',{line_id:'tea-line'});expect(result).toMatchObject({committed:false,error:expect.stringContaining('changed')});
  expect(db.sqlite.prepare("SELECT received_quantity,cancelled_quantity FROM inventory_receipt_lines WHERE id='tea-line'").get()).toEqual({received_quantity:100,cancelled_quantity:0});expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()).toEqual({stock_grams:100});
 });

 it('shows reconciled legacy arrival evidence once, including receipts linked through both references',async()=>{
  const {db,call}=fixture();db.sqlite.exec("INSERT INTO stock_ledger(id,account_id,product_id,delta,balance_after,reason,user_email,note) VALUES('legacy-movement','shop','ware',4,4,'RECEIPT','owner@test.dev','Original arrival');UPDATE inventory_receipt_lines SET source_movement_id='legacy-movement',received_quantity=4 WHERE id='ware-line'");
  const read=async()=>(await call('get_purchase',{id:'purchase'})).rows[0].history;
  expect(await read()).toEqual([expect.objectContaining({id:'legacy-movement',line_id:'ware-line',product_id:'ware',quantity:4,unit:'unit',note:'Original arrival'})]);
  db.sqlite.exec("UPDATE stock_ledger SET inventory_receipt_line_id='ware-line' WHERE id='legacy-movement'");expect(await read()).toHaveLength(1);
  db.sqlite.exec("UPDATE stock_ledger SET account_id='other' WHERE id='legacy-movement'");expect(await read()).toEqual([]);
 });

 it('surfaces unfinished invoice drafts without completed, abandoned, cross-account or duplicate receipt rows',async()=>{
  const {db,env}=fixture();db.sqlite.exec(`INSERT INTO curate_import_batches(id,account_id,created_by_user_id,title,review_state,analysis_state) VALUES('draft','shop','owner','Invoice to match','reviewing','failed'),('done','shop','owner','Done','completed','complete'),('abandoned','shop','owner','Discarded','abandoned','complete'),('foreign','other','other','Private invoice','pending','not_started'),('linked','shop','owner','Partially finalized','reviewing','complete');
  INSERT INTO curate_import_items(id,batch_id,account_id,created_by_user_id,name,position,review_state,reserved_compass_entry_id) VALUES('draft-item','draft','shop','owner','Tea',0,'pending','draft-identity'),('discarded-item','draft','shop','owner','Ignored',1,'abandoned','discarded-identity');
  INSERT INTO curate_import_vendor_groups(id,batch_id,account_id,position,group_key) VALUES('linked-group','linked','shop',0,'vendor');
  INSERT INTO curate_import_receipts(id,account_id,batch_id,vendor_group_id,inventory_receipt_id) VALUES('linked-import-receipt','shop','linked','linked-group','receipt');`);
  const before=db.sqlite.prepare('SELECT total_changes() n').get();const result=await readPurchaseTracking(env as any,'shop');expect(db.sqlite.prepare('SELECT total_changes() n').get()).toEqual(before);
  expect(result.rows.map(r=>r.id).sort()).toEqual(['import:draft','purchase']);
  expect(result.rows.find(r=>r.id==='import:draft')).toMatchObject({invoice_draft:{id:'draft',title:'Invoice to match',item_count:1,analysis_state:'failed',review_state:'reviewing'},source_document:{import_id:'draft',title:'Invoice to match'},attention:[{code:'invoice_review',message:expect.any(String)}]});
  expect(result.rows.find(r=>r.id==='purchase')?.invoice_draft).toMatchObject({id:'linked',title:'Partially finalized'});
  expect(result.rows.find(r=>r.id==='purchase')?.attention).toContainEqual({code:'invoice_review',message:expect.any(String)});
  expect((await readPurchaseTracking(env as any,'shop','import:draft')).rows).toHaveLength(1);
 });

});
