import { readFileSync } from 'node:fs';
function requireMigration(){return readFileSync(new URL('../migrations/0031_flow_continuity.sql',import.meta.url),'utf8');}
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { capturedHoldingFields,recordedImageKey } from '../src/capturedHolding';
import { seedFromMigrations } from './helpers/migratedSqlite';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'website-order-lifecycle-test';
const databases: SqliteD1[] = [];
let sequence = 0;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  databases.splice(0).forEach(db => db.close());
});

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner-a', accountId: 'shop-a', bundles: ['sell','stock','catalog'] });
  seedIdentity(db, { userId: 'owner-b', accountId: 'shop-b', bundles: ['sell','stock','catalog'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
    VALUES ('tea-a', 'shop-a', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000),
           ('tea-b', 'shop-b', 'Red', 'Other red tea', 'Loose', 20, 'USD', 300, 1000);
  `);
  return db;
}

function orderPayload(account = 'shop-a', contact = 'guest@example.com', overrides: Record<string, unknown> = {}) {
  const id = ++sequence;
  return {
    source: 'website', store_slug: account,
    tracking_token: `privatewebsiteordertoken000000000000${String(id).padStart(2, '0')}`,
    ref_number: `TJ-WEB-${id}`, customer_name: 'Guest', customer_contact: contact,
    customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 1,
    items: [{ id: account === 'shop-a' ? 'tea-a' : 'tea-b', name: 'Red tea', category: 'tea',
      storeSlug: account, quantityGrams: 50, packGrams: 25, packs: 2,
      pricePerGram: 0.001, totalPrice: 0.01 }],
    ...overrides,
  };
}

function publicOrder(db: SqliteD1, body: Record<string, unknown>) {
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
}

async function admin(db: SqliteD1, accountId: string, path: string, body?: unknown, method = 'POST') {
  const userId = accountId === 'shop-a' ? 'owner-a' : 'owner-b';
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, active_account_id: accountId, role: 'owner',
  });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId,
      'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

async function create(db: SqliteD1, body = orderPayload()) {
  const response = await publicOrder(db, body);
  expect(response.status).toBe(201);
  return { body, result: await response.json() as Record<string, any> };
}

function invoice(db: SqliteD1, id: string) {
  return db.sqlite.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Record<string, any>;
}

function stock(db: SqliteD1, account = 'shop-a') {
  return (db.sqlite.prepare('SELECT stock_grams FROM products WHERE account_id = ?').get(account) as { stock_grams: number }).stock_grams;
}

function ledger(db: SqliteD1, id: string) {
  return db.sqlite.prepare('SELECT status, amount_usd FROM invoice_payments WHERE invoice_id = ?').all(id) as Array<Record<string, any>>;
}

describe('flow repair economic boundaries',()=>{
 it('keeps ware acquisition denominator stable and missing cost unknown',async()=>{
  const db=seed();db.sqlite.exec("UPDATE products SET type='Teaware',cost_amount=40,quantity_purchased=4,quantity_units=3 WHERE id='tea-a'");
  const r=await admin(db,'shop-a','/api/products',undefined,'GET'); const rows=await r.json() as any[];
  expect(rows[0].retail_price_per_gram_usd).toBe(30);
  db.sqlite.exec("UPDATE products SET cost_amount=NULL WHERE id='tea-a'");
  const n=await admin(db,'shop-a','/api/products',undefined,'GET');expect((await n.json() as any[])[0].retail_price_per_gram_usd).toBeNull();
 });
 it('retains ware identity and consumes pieces once',async()=>{
  const db=seed();db.sqlite.exec("UPDATE products SET type='Teaware',fixed_retail_price_usd=10,quantity_purchased=3,quantity_units=3 WHERE id='tea-a'");
  const {result}=await create(db,orderPayload('shop-a','guest@example.com',{items:[{id:'tea-a',name:'Cup',category:'ware',storeSlug:'shop-a',quantityGrams:2,pricePerGram:10,totalPrice:20}]})); const id=result.invoice_id;
  expect(db.sqlite.prepare('SELECT product_id FROM invoice_line_items WHERE invoice_id=?').get(id)).toMatchObject({product_id:'tea-a'});
  expect((await admin(db,'shop-a',`/api/invoices/${id}`,{status:'Pending'},'PUT')).status).toBe(200);
  expect((await admin(db,'shop-a',`/api/invoices/${id}/payments`,{amount_usd:20,method_label:'Cash'})).status).toBe(201);
  expect(db.sqlite.prepare("SELECT quantity_units FROM products WHERE id='tea-a'").get()).toEqual({quantity_units:1});
 });
 it('restores cancelled paid stock and reverses settlement',async()=>{
  const db=seed();const {result}=await create(db);const id=result.invoice_id;
  await admin(db,'shop-a',`/api/invoices/${id}`,{status:'Pending'},'PUT');await admin(db,'shop-a',`/api/invoices/${id}/payments`,{amount_usd:14,method_label:'Cash'});
  expect((await admin(db,'shop-a','/api/rpc/cancel-invoice',{invoice_id:id})).status).toBe(200);expect(stock(db)).toBe(1000);
  expect(db.sqlite.prepare('SELECT status FROM sales_settlements WHERE invoice_id=?').get(id)).toEqual({status:'reversed'});
  await admin(db,'shop-a','/api/rpc/cancel-invoice',{invoice_id:id});expect(stock(db)).toBe(1000);
 });
 it('normalizes NULL units and reopens a sold-out holding on receipt',async()=>{
  const db=seed();db.sqlite.exec("UPDATE products SET type='Teaware',quantity_units=NULL,status='Sold Out' WHERE id='tea-a'");
  const r=await admin(db,'shop-a','/api/products/tea-a/movements',{movement_type:'receipt',quantity:2,unit:'unit',expected_balance:0,idempotency_key:'null-units-receive'});
  expect(r.status).toBe(201);expect(db.sqlite.prepare("SELECT quantity_units,status FROM products WHERE id='tea-a'").get()).toEqual({quantity_units:2,status:'Active'});
 });
 it('records one cancellation refund and closes its due amount',async()=>{
  const db=seed();const {result}=await create(db);const id=result.invoice_id;await admin(db,'shop-a',`/api/invoices/${id}`,{status:'Pending'},'PUT');await admin(db,'shop-a',`/api/invoices/${id}/payments`,{amount_usd:14,method_label:'Cash'});await admin(db,'shop-a','/api/rpc/cancel-invoice',{invoice_id:id});
  const r=await admin(db,'shop-a',`/api/invoices/${id}/refunds`,{amount_usd:14,request_id:'refund-001'});expect(r.status).toBe(201);expect(await r.json()).toMatchObject({refunded_usd:14,refund_due_usd:0,refund_required:false});
  expect((await admin(db,'shop-a',`/api/invoices/${id}/refunds`,{amount_usd:14,request_id:'refund-001'})).status).toBe(200);
 });
 it('creates an idempotent purchase and prepares a canonical expected receipt',async()=>{
  const db=seed();const body={vendor_name:'Vendor',idempotency_key:'purchase-1',items_json:JSON.stringify([{product_id:'tea-a',product_name:'Tea',quantity:20,unit:'g',currency:'USD',total_cost:5}]),total_usd:5};
  const r=await admin(db,'shop-a','/api/purchase-orders',body);expect(r.status).toBe(201);const id=(await r.json() as any).id;
  const replay=await admin(db,'shop-a','/api/purchase-orders',body);expect((await replay.json() as any).id).toBe(id);
  const receipt=await admin(db,'shop-a',`/api/purchase-orders/${id}/prepare-receipt`,{});expect(receipt.status).toBe(200);expect(await receipt.json()).toMatchObject({receipt_id:expect.any(String),unresolved_items:[]});expect(stock(db)).toBe(1000);
 });
 it('carries a network quote at per-100g price into normal stock',async()=>{
  const db=seed();db.sqlite.exec("INSERT INTO tea_profiles(id,slug,originated_by_account_id,curated_by_account_id,name,type,status,network_visible) VALUES('network-tea','network-tea','shop-b','shop-b','Network tea','Red','published',1)");
  const r=await admin(db,'shop-a','/api/listings/carry',{profile_id:'network-tea',initial_stock_grams:100,initial_price_amount:144,initial_price_currency:'cny'});expect(r.status).toBe(201);const data=await r.json() as any;
  const listing=db.sqlite.prepare('SELECT fixed_retail_price_usd,legacy_product_id FROM product_listings WHERE id=?').get(data.listing_id) as any;
  expect(listing.fixed_retail_price_usd).toBeCloseTo(.2);expect(listing.legacy_product_id).toEqual(expect.any(String));expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id=? AND account_id=?').get(listing.legacy_product_id,'shop-a')).toEqual({stock_grams:100});
 });
 it('returns canonical saved prices and lets the token owner claim the guest order',async()=>{
  const db=seed();const {body,result}=await create(db);expect(result.total_estimate_usd).toBe(14);expect(result.invoice_items[0]).toMatchObject({quantity:50,quantity_unit:'g',line_total_usd:14});
  const r=await admin(db,'shop-a',`/api/inquiries/${body.tracking_token}/claim`,{});expect(r.status).toBe(200);
  const history=await admin(db,'shop-a','/api/me/orders',undefined,'GET');expect((await history.json() as any).orders).toHaveLength(1);
 });
 it('keeps source facts and quote basis through receipt, then merges source tasting',async()=>{
  const db=seed();db.sqlite.prepare(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,type,form,chinese_name,origin_country,photos,price_amount,price_currency,price_per_unit_grams,buy_total,buy_quantity_grams,tasting) VALUES('capture','owner-a','shop-a','Captured','Red','Loose','茶','China','["https://example.test/photo.jpg"]',100,'Yuan',100,100,100,'{"flavor":["honey"]}')`).run();
  const proposal=await admin(db,'shop-a','/api/compass/entries/capture/receipt-proposals',{quantity:50,unit:'g',purpose:'working',acquisition_kind:'purchase',idempotency_key:'captured-receipt'});expect(proposal.status).toBe(201);const id=(await proposal.json() as any).id;
  const accepted=await admin(db,'shop-a',`/api/curate/receipt-proposals/${id}/accept`,{});expect(accepted.status).toBe(200);const product=(await accepted.json() as any).product_id;
  expect(db.sqlite.prepare('SELECT form,chinese_name,origin_country,image_url,cost_amount,quantity_purchased FROM products WHERE id=?').get(product)).toEqual({form:'Loose',chinese_name:'茶',origin_country:'China',image_url:'https://example.test/photo.jpg',cost_amount:50,quantity_purchased:50});
  db.sqlite.prepare(`UPDATE products SET tasting='{"editorial":"keep"}' WHERE id=?`).run(product);
  const saved=await admin(db,'shop-a','/api/compass/sync',{entries:[{id:'capture',name:'New name',tasting:{flavor:['orchid']}}]});expect(saved.status).toBe(200);expect(JSON.parse((db.sqlite.prepare('SELECT tasting FROM products WHERE id=?').get(product) as any).tasting)).toMatchObject({editorial:'keep',flavor:['orchid']});
 });
 it('uses the recorded current photo rather than an old slot key',()=>{
  expect(recordedImageKey({image_url:'https://media.teajia.co/accounts/shop-a/products/new.jpg?v=2'},'main','shop-a')).toBe('accounts/shop-a/products/new.jpg');
  expect(recordedImageKey({image_url:'https://media.teajia.co/accounts/shop-b/https://example.test/photo.jpg'},'main','shop-a')).toBeNull();
  expect(capturedHoldingFields({price_amount:380,price_currency:'CNY',price_per_unit_grams:500},100)).toMatchObject({cost_amount:76,quantity_purchased:100,cost_currency:'Yuan'});
 });
 it('migration0031 preserves existing product and line references',()=>{
  const {db}=seedFromMigrations({through:'0030'});try{
   db.exec(`INSERT INTO accounts(id,slug,name) VALUES('preserve-account','preserve-account','Preserve');INSERT INTO products(id,account_id,type,product_name,cost_amount,cost_currency,quantity_purchased,stock_grams) VALUES('preserve-product','preserve-account','Red','Keep',10,'USD',100,100);INSERT INTO invoices(id,account_id,invoice_number) VALUES('preserve-invoice','preserve-account','KEEP-1');INSERT INTO invoice_line_items(id,account_id,invoice_id,product_id,quantity,price_at_sale) VALUES('preserve-line','preserve-account','preserve-invoice','preserve-product',10,1);`);
   const before=(db.prepare('SELECT COUNT(*) n FROM products').get() as any).n;
   const migration=requireMigration();db.exec(migration);
   expect((db.prepare('SELECT COUNT(*) n FROM products').get() as any).n).toBe(before);
   expect((db.prepare('PRAGMA table_info(invoice_line_items)').all() as any[]).some(row=>row.name==='quantity_unit')).toBe(true);
   expect(db.prepare("SELECT product_id,quantity FROM invoice_line_items WHERE id='preserve-line'").get()).toEqual({product_id:'preserve-product',quantity:10});
   expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  }finally{db.close();}
 });
 it('keeps a shipped purchase in the identified customer tea trail once',async()=>{
  const db=seed();const {body,result}=await create(db);const id=result.invoice_id;await admin(db,'shop-a',`/api/inquiries/${body.tracking_token}/claim`,{});await admin(db,'shop-a',`/api/invoices/${id}`,{status:'Pending'},'PUT');await admin(db,'shop-a',`/api/invoices/${id}/payments`,{amount_usd:14,method_label:'Cash'});
  expect((await admin(db,'shop-a','/api/rpc/ship-invoice',{invoice_id:id})).status).toBe(200);
  const entries=db.sqlite.prepare("SELECT name,status FROM tea_compass_entries WHERE user_id='owner-a' AND account_id='shop-a'").all();expect(entries).toEqual([{name:'Red tea',status:'available_to_taste'}]);
  await admin(db,'shop-a','/api/rpc/ship-invoice',{invoice_id:id});expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM tea_compass_entries WHERE user_id='owner-a'").get()).toEqual({n:1});
 });
 it('invalidates a warm public shelf after an account product edit',async()=>{
  const db=seed();const cache=new Map<string,Response>();vi.stubGlobal('caches',{default:{match:async(r:Request)=>cache.get(r.url)?.clone(),put:async(r:Request,res:Response)=>{cache.set(r.url,res.clone());},delete:async(r:Request)=>cache.delete(r.url)}});
  const getShelf=()=>worker.fetch(new Request('https://app.test/api/s/shop-a/products'),{DB:db,JWT_SECRET:SECRET} as never,{} as never);
  const before=await (await getShelf()).json() as any[];expect(before[0].product_name).toBe('Red tea');
  expect((await admin(db,'shop-a','/api/products/tea-a/catalog',{product_name:'Fresh tea'},'PUT')).status).toBe(200);
  const after=await (await getShelf()).json() as any[];expect(after[0].product_name).toBe('Fresh tea');
 });
 it('receives wholesale into a normal buyer holding and replays without duplicate stock',async()=>{
  const db=seed();db.sqlite.exec(`INSERT INTO tea_profiles(id,slug,originated_by_account_id,curated_by_account_id,name,type,status) VALUES('wholesale-profile','wholesale-profile','shop-b','shop-b','Wholesale tea','Red','published');INSERT INTO product_listings(id,account_id,profile_id,legacy_product_id,stock_grams,status) VALUES('opaque-supplier-list','shop-b','wholesale-profile','tea-b',1000,'active');INSERT INTO wholesale_orders(id,supplier_account_id,buyer_account_id,status,currency,subtotal_amount,total_amount,shipping_amount) VALUES('wholesale-first','shop-b','shop-a','shipped','USD',20,20,0);INSERT INTO wholesale_order_items(id,order_id,supplier_listing_id,profile_id,grams,unit_price_amount,unit_price_currency,line_total) VALUES('wholesale-line','wholesale-first','opaque-supplier-list','wholesale-profile',100,.2,'USD',20);`);
  const r=await admin(db,'shop-a','/api/wholesale/orders/wholesale-first/transition',{to:'received'});expect(r.status).toBe(200);
  const holding=db.sqlite.prepare("SELECT p.id,p.stock_grams FROM products p JOIN product_listings l ON l.legacy_product_id=p.id WHERE l.account_id='shop-a' AND l.profile_id='wholesale-profile'").get() as any;expect(holding.stock_grams).toBe(100);expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea-b'").get()).toEqual({stock_grams:900});
  const replay=await admin(db,'shop-a','/api/wholesale/orders/wholesale-first/transition',{to:'received'});expect(replay.status).toBe(200);expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id=?').get(holding.id)).toEqual({stock_grams:100});
 });
 it('retains negotiated acquisition totals and independently edited tasting categories',async()=>{
  expect(capturedHoldingFields({price_amount:100,price_currency:'Yuan',price_per_unit_grams:100,buy_total:180,buy_quantity_grams:200},100)).toMatchObject({cost_amount:90,quantity_purchased:100});expect(capturedHoldingFields({price_amount:0},25)).toMatchObject({cost_amount:0,quantity_purchased:25});
  const db=seed();db.sqlite.exec(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,type,tasting,draft_product_id) VALUES('following','owner-a','shop-a','Following','Red','{"flavor":["honey"],"flavor":"source"}','tea-a');UPDATE products SET source_compass_entry_id='following',tasting='{"flavor":["honey"],"flavor":"edited"}' WHERE id='tea-a';`);
  expect((await admin(db,'shop-a','/api/compass/sync',{entries:[{id:'following',name:'Another name',tasting:{aroma:'honey',flavor:'source'}}]})).status).toBe(200);expect(JSON.parse((db.sqlite.prepare("SELECT tasting FROM products WHERE id='tea-a'").get() as any).tasting).flavor).toBe('edited');
  await admin(db,'shop-a','/api/compass/sync',{entries:[{id:'following',tasting:{aroma:'floral',flavor:'new source'}}]});expect(JSON.parse((db.sqlite.prepare("SELECT tasting FROM products WHERE id='tea-a'").get() as any).tasting)).toEqual({aroma:'floral',flavor:'edited'});
 });
});
