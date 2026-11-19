import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function seed() {
  const db = new SqliteD1(); databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`UPDATE accounts SET slug='teajia-bali',default_shipping_rate_per_kg=0,default_shipping_rate_currency='USD' WHERE id='shop';
    INSERT OR REPLACE INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1);
    INSERT INTO products(id,account_id,type,product_name,form,cost_amount,cost_currency,quantity_purchased,stock_grams)
    VALUES('tea','shop','Red','Red tea','Loose',20,'USD',300,1000);`);
  return db;
}
function payload(extra: Record<string, unknown> = {}) {
  return { source:'website',store_slug:'teajia-bali',tracking_token:'privatewebsiteordertoken00000000000001',ref_number:'TJ-US-NEW',customer_name:'Guest',customer_contact:'guest@example.com',customer_location:'Los Angeles, CA 90012, United States',delivery_country:'US',delivery_address:'12 Test Lane\nApt 3',delivery_city:'Los Angeles',delivery_state:'CA',us_shipping_postcode:'90012',currency:'USD',total_estimate_usd:14,items:[{id:'tea',name:'Red tea',category:'tea',storeSlug:'teajia-bali',quantityGrams:50,packGrams:25,packs:2,pricePerGram:0.2,totalPrice:14}],...extra };
}
function create(db:SqliteD1, body=payload()) {
  return worker.fetch(new Request('https://app.test/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{DB:db,JWT_SECRET:'test',INQUIRY_LIMITER:{limit:async()=>({success:true})}} as never,{} as never);
}
describe('flagship US-only delivery',()=>{
  it('saves full US postal address, defers shipping and keeps request retry idempotent',async()=>{
    const db=seed(); const response=await create(db); expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({shipping_quote_requested:true});
    expect(db.sqlite.prepare('SELECT delivery_address,shipping_quote_status FROM invoices').get()).toEqual({delivery_address:'12 Test Lane\nApt 3\nLos Angeles, CA 90012\nUnited States',shipping_quote_status:'requested'});
    expect((await create(db)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({n:1});
  });
  it('refuses non-US delivery without saving an order',async()=>{
    const db=seed();const response=await create(db,payload({delivery_country:'ID',us_shipping_postcode:undefined}));
    expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:expect.stringContaining('United States only')});
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({n:0});
  });
  it.each([{delivery_address:''},{delivery_city:''},{delivery_state:'ZZ'},{us_shipping_postcode:''}])('requires a complete address: %j',async(extra)=>{
    const db=seed();expect((await create(db,payload(extra))).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({n:0});
  });
  it('preserves pickup as an explicit separate request with no shipping address',async()=>{
    const db=seed();const response=await create(db,payload({pickup:true,delivery_country:undefined,us_shipping_postcode:undefined,delivery_address:'',delivery_city:undefined,delivery_state:undefined,customer_location:'Pickup requested in Bali, Indonesia'}));
    expect(response.status).toBe(201);
    expect(db.sqlite.prepare('SELECT fulfillment_method,shipping_quote_status,delivery_address FROM invoices').get()).toEqual({fulfillment_method:'bali_pickup',shipping_quote_status:null,delivery_address:null});
  });
});
