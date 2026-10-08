import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curatePromotionTools } from '../src/mcpTools/curatePromotion';
import { promoteCompassEntry } from '../src/curatePromotion';
import { previewCurateUndo,confirmCurateMutation } from '../src/curateMutations';

const auth={accountId:'a',userId:'owner',userEmail:'owner@test.dev',tokenId:'token',creatorTier:'account_owner'};
const call=(db:SqliteD1,args:any,who=auth)=>curatePromotionTools.handlers.curate_promote_tea({DB:db} as any,who,args) as Promise<any>;
function setup() {
  const db=new SqliteD1();
  seedIdentity(db,{accountId:'a',userId:'owner',role:'owner'});
  seedIdentity(db,{accountId:'b',userId:'other',role:'owner'});
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,type,tags) VALUES ('vendor','a','Wang','vendor','[\"vendor\"]')").run();
  db.sqlite.prepare(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,chinese_name,type,form,year,origin_region,vendor_id,vendor_name,price_amount,price_currency,price_per_unit_grams,buy_quantity_grams,photos,tea_key)
    VALUES ('tea','a','owner','Old tea','老茶','Sheng','Cake',2019,'Yiwu','vendor','Wang',1200,'Yuan',357,250,'["https://example.com/bag.jpg"]','identity')`).run();
  db.sqlite.prepare("INSERT INTO tea_samples(id,account_id,compass_entry_id,set_id,grams,name) VALUES ('sample','a','tea','set',12,'Old tea')").run();
  return db;
}
const one=(db:SqliteD1,table:string)=>db.sqlite.prepare(`SELECT * FROM ${table}`).get() as any;

describe('agent Curate promotion shares the app inventory boundary',()=>{
  it('previews without changing tea, inventory or sample holdings; commits private unknown-cost zero-stock once',async()=>{
    const db=setup(); const tea=one(db,'tea_compass_entries'); const sample=one(db,'tea_samples');
    const preview=await call(db,{tea_id:'tea'});
    expect(preview.expires_in_seconds).toBe(300);
    expect(preview.preview.creates).toMatchObject({cost_amount:null,stock_grams:0,status:'Draft',is_public:0});
    expect(one(db,'products')).toBeUndefined(); expect(one(db,'tea_compass_entries')).toEqual(tea);
    const result=await call(db,{confirm:preview.confirmation_token});
    expect(result).toMatchObject({committed:true,alreadyPromoted:false});
    expect(one(db,'products')).toMatchObject({id:result.id,status:'Draft',is_public:0,shown_in_shop:0,stock_grams:0,cost_amount:null,cost_currency:null,quantity_purchased:null,shipping_rate_per_kg:null,markup_multiplier:null,vendor_id:'vendor',source_compass_entry_id:'tea',chinese_name:'老茶',tea_key:'identity',bag_photo_url:'https://example.com/bag.jpg'});
    expect(one(db,'tea_samples')).toEqual(sample);
    expect(one(db,'stock_ledger')).toBeUndefined();
    expect(one(db,'tea_compass_entries').draft_product_id).toBe(result.id);
    expect(one(db,'curate_mutation_records')).toMatchObject({entity_type:'tea',entity_id:'tea'});
    expect(await call(db,{confirm:preview.confirmation_token})).toMatchObject({error:'invalid_or_expired_confirmation_token'});
    const retry=await call(db,{tea_id:'tea'});
    expect(retry.preview.existing_product_id).toBe(result.id);
    expect(await call(db,{confirm:retry.confirmation_token})).toMatchObject({id:result.id,alreadyPromoted:true});
    expect(db.sqlite.prepare('SELECT count(*) n FROM products').get()).toMatchObject({n:1});
  });
  it.each(['tea','vendor','product'])('refuses stale %s previews without creating or relinking',async(which)=>{
    const db=setup();const p=await call(db,{tea_id:'tea'});
    if(which==='tea') db.sqlite.exec("UPDATE tea_compass_entries SET name='New name'");
    if(which==='vendor') db.sqlite.exec("UPDATE customers SET name='New vendor'");
    if(which==='product') await promoteCompassEntry(db as any,'a',one(db,'tea_compass_entries'));
    const products=db.sqlite.prepare('SELECT * FROM products').all();
    expect(await call(db,{confirm:p.confirmation_token})).toMatchObject({error:'stale_preview'});
    expect(db.sqlite.prepare('SELECT * FROM products').all()).toEqual(products);
  });
  it('checks account, member capability and confirmation principal',async()=>{
    const db=setup();
    await expect(call(db,{tea_id:'tea'},{...auth,accountId:'b',userId:'other'})).rejects.toThrow(/not found/);
    seedIdentity(db,{accountId:'a',userId:'viewer',role:'viewer'});
    await expect(call(db,{tea_id:'tea'},{...auth,userId:'viewer'})).rejects.toThrow(/management/);
    const p=await call(db,{tea_id:'tea'});
    db.sqlite.exec("UPDATE account_members SET status='inactive' WHERE account_id='a' AND user_id='owner'");
    await expect(call(db,{confirm:p.confirmation_token})).rejects.toThrow(/management/);
    expect(one(db,'products')).toBeUndefined();
  });
  it('rolls back the entire batch if a tea changes after the confirmation read',async()=>{
    const db=setup();const p=await call(db,{tea_id:'tea'});
    const batch=db.batch.bind(db);
    db.batch=(statements:any)=>{db.sqlite.exec("UPDATE tea_compass_entries SET name='Changed concurrently'");return batch(statements);};
    expect(await call(db,{confirm:p.confirmation_token})).toMatchObject({error:'stale_preview'});
    expect(one(db,'products')).toBeUndefined();
    expect(one(db,'curate_mutations')).toBeUndefined();
    expect(one(db,'tea_compass_entries').draft_product_id).toBeNull();
  });
  it('resolves a legacy vendor name only to the existing sourcing vendor, never a same-named customer',async()=>{
    const db=setup();db.sqlite.exec("UPDATE tea_compass_entries SET vendor_id=NULL");
    db.sqlite.exec("INSERT INTO customers(id,account_id,name,type,tags) VALUES ('buyer','a','Wang','customer','[]')");
    const p=await call(db,{tea_id:'tea'});expect(p.preview.vendor_id).toBe('vendor');
    const r=await call(db,{confirm:p.confirmation_token});expect(r.product.vendor_id).toBe('vendor');
  });
  it('expires after five minutes and rejects a sibling token',async()=>{
    const db=setup();const p=await call(db,{tea_id:'tea'});
    expect(await call(db,{confirm:p.confirmation_token},{...auth,tokenId:'sibling'})).toMatchObject({error:'invalid_or_expired_confirmation_token'});
    const next=await call(db,{tea_id:'tea'});db.sqlite.exec('UPDATE mcp_confirmation_tickets SET expires_at=0');
    expect(await call(db,{confirm:next.confirmation_token})).toMatchObject({error:'invalid_or_expired_confirmation_token'});
    expect(one(db,'products')).toBeUndefined();
  });
  it('shares the existing REST identity, repairs stale links and keeps teaware private with zero pieces',async()=>{
    const db=setup();db.sqlite.exec("UPDATE tea_compass_entries SET draft_product_id='gone',category='teaware',material='Clay',capacity_ml=120");
    const p=await call(db,{tea_id:'tea'});const created=await call(db,{confirm:p.confirmation_token});
    const retry=await promoteCompassEntry(db as any,'a',one(db,'tea_compass_entries'));
    expect(retry).toMatchObject({id:created.id,alreadyPromoted:true});
    expect(one(db,'products')).toMatchObject({type:'Teaware',quantity_units:0,material:'Clay',capacity_ml:120});
    expect(curatePromotionTools.defs[0].scope).toBe('stock:write');
  });
});

describe('last confirmed promotion can be safely undone',()=>{
  async function promote(db:SqliteD1) { const p=await call(db,{tea_id:'tea'});return call(db,{confirm:p.confirmation_token}); }
  it('removes only the pristine new private Draft, restoring the tea link and preserving samples',async()=>{
    const db=setup();const tea=one(db,'tea_compass_entries');const sample=one(db,'tea_samples');const created=await promote(db);
    const record=db.sqlite.prepare("SELECT after_json FROM curate_mutation_records WHERE entity_type='promotion_product'").get() as any;
    expect(JSON.parse(record.after_json)).toEqual(one(db,'products'));
    const undo=await previewCurateUndo({DB:db} as any,auth);
    expect(undo.preview.removes_pristine_draft_product).toBe(created.id);
    const payload=JSON.parse((db.sqlite.prepare("SELECT payload_json FROM mcp_confirmation_tickets WHERE kind='curate:manage' ORDER BY rowid DESC LIMIT 1").get() as any).payload_json);
    expect(payload.guards.flatMap((guard:any)=>guard.values).length).toBeLessThan(50);
    // Prove generated statements also fit D1's bind ceiling, not just SQLite.
    const prepare=db.prepare.bind(db);
    db.prepare=((sql:string)=>{const statement=prepare(sql);const bind=statement.bind.bind(statement);statement.bind=(...values:any[])=>{expect(values.length).toBeLessThanOrEqual(100);return bind(...values);};return statement;}) as typeof db.prepare;
    expect(one(db,'products')).toBeDefined();
    expect(await confirmCurateMutation({DB:db} as any,auth,undo.confirmation_token)).toMatchObject({confirmed:true});
    expect(one(db,'products')).toBeUndefined();expect(one(db,'tea_compass_entries')).toEqual(tea);expect(one(db,'tea_samples')).toEqual(sample);
  });
  it.each(['edit','stock','sample','listing','receipt','other tea','order JSON'])('refuses undo once %s work appears',async(kind)=>{
    const db=setup();const created=await promote(db);
    if(kind==='edit') db.sqlite.prepare("UPDATE products SET description='Edited' WHERE id=?").run(created.id);
    if(kind==='stock') db.sqlite.prepare('UPDATE products SET stock_grams=10 WHERE id=?').run(created.id);
    if(kind==='sample') db.sqlite.prepare('UPDATE tea_samples SET product_id=?').run(created.id);
    if(kind==='listing') {db.sqlite.exec("INSERT INTO tea_profiles(id,slug,name,originated_by_account_id,curated_by_account_id) VALUES ('profile','profile','Listed','a','a')");db.sqlite.prepare("INSERT INTO product_listings(id,account_id,profile_id,legacy_product_id) VALUES ('listing','a','profile',?)").run(created.id);}
    if(kind==='receipt') db.sqlite.exec('CREATE TABLE new_receipt_dependency (product_id TEXT)');
    if(kind==='receipt') db.sqlite.prepare('INSERT INTO new_receipt_dependency(product_id) VALUES (?)').run(created.id);
    if(kind==='order JSON') {db.sqlite.exec('CREATE TABLE order_json_dependency (items TEXT)');db.sqlite.prepare('INSERT INTO order_json_dependency(items) VALUES (?)').run(JSON.stringify([{product_id:created.id}]));}
    if(kind==='other tea') db.sqlite.prepare("INSERT INTO tea_compass_entries(id,user_id,account_id,name,draft_product_id) VALUES ('another','owner','a','Another',?)").run(created.id);
    await expect(previewCurateUndo({DB:db} as any,auth)).rejects.toThrow(/changed|pristine|referenced/);
    expect(one(db,'products').id).toBe(created.id);
  });
  it('rechecks dependencies at undo confirmation and keeps the product/link when work arrived meanwhile',async()=>{
    const db=setup();const created=await promote(db);const undo=await previewCurateUndo({DB:db} as any,auth);
    db.sqlite.prepare('UPDATE tea_samples SET product_id=?').run(created.id);
    expect(await confirmCurateMutation({DB:db} as any,auth,undo.confirmation_token)).toMatchObject({error:'stale_preview'});
    expect(one(db,'products').id).toBe(created.id);expect(one(db,'tea_compass_entries').draft_product_id).toBe(created.id);
  });
  it('never deletes an existing inventory product when undoing a reused identity',async()=>{
    const db=setup();const original=await promoteCompassEntry(db as any,'a',one(db,'tea_compass_entries'));
    const before=one(db,'products');db.sqlite.exec('UPDATE tea_compass_entries SET draft_product_id=NULL');await promote(db);
    const undo=await previewCurateUndo({DB:db} as any,auth);
    expect(undo.preview.removes_pristine_draft_product).toBeNull();
    expect(await confirmCurateMutation({DB:db} as any,auth,undo.confirmation_token)).toMatchObject({confirmed:true});
    expect(one(db,'products')).toEqual(before);expect(one(db,'products').id).toBe(original.id);expect(one(db,'tea_compass_entries').draft_product_id).toBeNull();
  });
});
