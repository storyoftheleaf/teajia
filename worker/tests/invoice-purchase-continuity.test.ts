import {afterEach,describe,it,expect} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {finalizeCurateImportRequest} from '../src/curateImports';
import {linkImportReceiptPurchase,preparePurchaseReceipt} from '../src/purchaseContinuity';
import {curateIntakeTools} from '../src/mcpTools/curateIntake';
import {curateSupplyTools} from '../src/mcpTools/curateSupply';

const ctx={accountId:'shop',userId:'owner'};
const databases:SqliteD1[]=[];
afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function dbFor(){const db=new SqliteD1('migrations');databases.push(db);seedIdentity(db,{...ctx,role:'owner'});return db;}
function seedInvoice(db:SqliteD1){
 db.sqlite.prepare("INSERT INTO curate_import_batches(id,account_id,created_by_user_id,title,review_state) VALUES('invoice','shop','owner','October invoice','reviewing')").run();
 for(const [id,name] of [['v1','Tea supplier'],['v2','Porcelain supplier']]) {
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES(?,'shop',?,'[\"vendor\"]')").run(id,name);
  db.sqlite.prepare("INSERT INTO curate_import_vendor_groups(id,batch_id,account_id,position,group_key,resolved_vendor_customer_id) VALUES(?,'invoice','shop',0,?,?)").run('g'+id,id,id);
 }
 for(const [id,category,group,quantity,cost] of [['tea','tea','gv1',500,70],['ware','teaware','gv2',4,40]] as const){
  const parsed={englishName:id,category,disposition:'in_transit',duplicateResolution:'new',inventoryPurpose:'working',packCount:1,lineCost:cost,lineCostExact:String(cost),unitCost:cost/quantity,unitCostExact:String(cost/quantity),currency:'USD',...(category==='tea'?{totalQuantityGrams:quantity}:{totalUnits:quantity})};
  db.sqlite.prepare("INSERT INTO curate_import_items(id,batch_id,account_id,created_by_user_id,position,category,name,parsed_data_json,reserved_compass_entry_id,vendor_group_id,transport_mode) VALUES(?,'invoice','shop','owner',0,?,?,?,?,?,'air')")
   .run(id,category,id,JSON.stringify(parsed),'identity-'+id,group);
 }
}
const finalize=(db:SqliteD1,context=ctx)=>finalizeCurateImportRequest(new Request('http://local/finalize',{method:'POST',body:JSON.stringify({idempotency_key:'invoice-confirm'})}),{DB:db as any},context,{id:'invoice'},async()=>{throw Error('In-transit invoice must not receive stock');});

describe('an agent invoice is one connected purchase and expected delivery per vendor',()=>{
 it('links both vendor groups, keeps grams and pieces and exact money, and replays without duplicate purchases or stock',async()=>{
  const db=dbFor();seedInvoice(db);
  db.sqlite.prepare("UPDATE curate_import_items SET transport_mode='unknown' WHERE id='ware'").run();
  const response=await finalize(db);const body:any=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);
  expect(body.receipts).toHaveLength(2);
  for(const receipt of body.receipts){
   const order:any=db.sqlite.prepare('SELECT * FROM purchase_orders WHERE id=?').get(receipt.purchase_order_id);
   expect(order).toMatchObject({account_id:'shop',receipt_id:receipt.id,status:'ordered',ship_mode:receipt.vendorId==='v1'?'air':null});
   const items=JSON.parse(order.items_json);expect(items[0].receipt_line_id).toBe(receipt.lines[0].id);
   expect(items[0].original_cost_amount_exact).toBe(String(items[0].line_total));
  }
  expect(db.sqlite.prepare('SELECT total_usd FROM purchase_orders ORDER BY total_usd').all()).toEqual([{total_usd:40},{total_usd:70}]);
  expect(db.sqlite.prepare('SELECT unit,expected_quantity,received_quantity FROM inventory_receipt_lines ORDER BY unit').all()).toEqual([{unit:'g',expected_quantity:500,received_quantity:0},{unit:'unit',expected_quantity:4,received_quantity:0}]);
  expect(db.sqlite.prepare('SELECT COALESCE(stock_grams,0)+COALESCE(quantity_units,0) AS balance FROM products').all()).toEqual([{balance:0},{balance:0}]);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger').get()).toEqual({n:0});
  const replay:any=await (await finalize(db)).json();expect(replay.receipts).toEqual(body.receipts);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM purchase_orders').get()).toEqual({n:2});
  const again=await linkImportReceiptPurchase({DB:db as any},ctx,{receiptId:body.receipts[0].id,importId:'invoice',groupId:body.receipts[0].groupId,vendorId:body.receipts[0].vendorId});
  expect(again).toBe(body.receipts[0].purchase_order_id);
 });
 it('does not turn unresolved identity or another account invoice into purchases',async()=>{
  const db=dbFor();seedInvoice(db);
  db.sqlite.prepare("UPDATE curate_import_items SET parsed_data_json=json_set(parsed_data_json,'$.duplicateResolution','unresolved') WHERE id='tea'").run();
  expect((await finalize(db)).status).toBe(409);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM purchase_orders').get()).toEqual({n:0});
  expect((await finalize(db,{accountId:'other',userId:'owner'})).status).toBe(404);
 });
});

const auth={...ctx,userEmail:'owner@example.test',tokenId:'token',creatorTier:'account_owner'};
async function callConfirm(db:SqliteD1,name:string,args:any){
 const handlers={...curateIntakeTools.handlers,...curateSupplyTools.handlers};
 const preview:any=await handlers[name]({DB:db as any},auth,args);expect(preview.confirmation_token).toBeTruthy();
 return handlers[name]({DB:db as any},auth,{confirm:preview.confirmation_token}) as Promise<any>;
}
describe('agent purchase creates its receipt without arrival stock',()=>{
 it('orders mixed tea and teaware, with per-piece holding cost and no duplicate proposal path',async()=>{
  const db=dbFor();
  await callConfirm(db,'curate_add_tea',{name:'Red tea',vendor_name:'Supplier',price:{amount:25,currency:'USD',per_grams:100}});
  await callConfirm(db,'curate_add_tea',{name:'Gaiwan',vendor_name:'Supplier',category:'teaware',price:{amount:12,currency:'USD',per:'piece'}});
  const teas:any[]=db.sqlite.prepare('SELECT * FROM tea_compass_entries ORDER BY name').all();
  const result=await callConfirm(db,'curate_order',{vendor_name:'Supplier',lines:teas.map(t=>({tea_id:t.id,quantity:{amount:t.category==='teaware'?3:500,unit:t.category==='teaware'?'piece':'g'}}))});
  expect(result.lines).toHaveLength(2);expect(result.receipt_id).toBeTruthy();
  const ware:any=db.sqlite.prepare("SELECT * FROM products WHERE type='Teaware'").get();
  expect(ware).toMatchObject({quantity_units:0,cost_amount:12,cost_currency:'USD',quantity_purchased:1,shipping_rate_per_kg:null,markup_multiplier:null});
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_receipt_proposals').get()).toEqual({n:0});
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger').get()).toEqual({n:0});
  const replay=await preparePurchaseReceipt({DB:db as any},ctx,result.purchase_order_id);expect(replay.value).toMatchObject({already_prepared:true,receipt_id:result.receipt_id});
 });
});

describe('older Curate purchases keep their original arrival',()=>{
 it('links the exact accepted proposal movement once without receiving the same tea again',async()=>{
  const db=dbFor();
  db.sqlite.exec(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,category) VALUES('legacy-tea','shop','owner','Legacy tea','tea');
    INSERT INTO products(id,account_id,product_name,type,source_compass_entry_id,stock_grams) VALUES('legacy-holding','shop','Legacy tea','Red','legacy-tea',500);
    INSERT INTO stock_ledger(id,account_id,product_id,delta,balance_after,movement_unit,reason) VALUES('legacy-movement','shop','legacy-holding',500,500,'gram','PURCHASE_RECEIPT');
    INSERT INTO curate_receipt_proposals(id,account_id,compass_entry_id,product_id,purpose,quantity,unit,acquisition_kind,status,idempotency_key,ledger_id,proposed_by_user_id)
      VALUES('legacy-proposal','shop','legacy-tea','legacy-holding','working',500,'g','purchase','accepted','order:legacy-order:legacy-tea','legacy-movement','owner');`);
  const items=[{compass_entry_id:'legacy-tea',product_name:'Legacy tea',quantity:'500 g',quantity_grams:500,line_total:75,currency:'USD',unit_price:'15 USD / 100 g'}];
  db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,vendor_name,items_json,status,created_at,updated_at) VALUES('legacy-order','shop','Supplier',?,'pending',datetime('now'),datetime('now'))").run(JSON.stringify(items));
  const result=await preparePurchaseReceipt({DB:db as any},ctx,'legacy-order');
  expect(result.value).toMatchObject({receipt_id:'po_legacy-order',unresolved_items:[]});
  expect(db.sqlite.prepare('SELECT state FROM inventory_receipts').get()).toEqual({state:'received'});
  expect(db.sqlite.prepare('SELECT received_quantity,source_movement_id,original_cost_amount,original_unit_cost FROM inventory_receipt_lines').get()).toEqual({received_quantity:500,source_movement_id:'legacy-movement',original_cost_amount:75,original_unit_cost:null});
  expect(db.sqlite.prepare('SELECT stock_grams FROM products').get()).toEqual({stock_grams:500});
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger').get()).toEqual({n:1});
  expect((await preparePurchaseReceipt({DB:db as any},ctx,'legacy-order')).value.already_prepared).toBe(true);
  db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,vendor_name,items_json,status,created_at,updated_at) VALUES('other-order','shop','Supplier',?,'pending',datetime('now'),datetime('now'))").run(JSON.stringify([{product_id:'legacy-holding',quantity:500,unit:'g',source_movement_id:'legacy-movement'}]));
  expect((await preparePurchaseReceipt({DB:db as any},ctx,'other-order')).value).toMatchObject({receipt_id:null,unresolved_items:[expect.objectContaining({reason:expect.stringContaining('already linked')})]});
 });
 it('leaves an unmatched historical line for attention and cannot link a foreign holding',async()=>{
  const db=dbFor();
  seedIdentity(db,{accountId:'other',userId:'other-owner',role:'owner'});
  db.sqlite.exec("INSERT INTO products(id,account_id,product_name,type,stock_grams) VALUES('foreign-holding','other','Foreign tea','Red',100)");
  db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,vendor_name,items_json,status,created_at,updated_at) VALUES('unresolved','shop','Supplier',?,'pending',datetime('now'),datetime('now'))").run(JSON.stringify([{product_id:'foreign-holding',quantity:100,unit:'g'}]));
  expect((await preparePurchaseReceipt({DB:db as any},ctx,'unresolved')).value).toMatchObject({receipt_id:null,unresolved_items:[expect.objectContaining({index:0})]});
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inventory_receipts').get()).toEqual({n:0});
 });
});
