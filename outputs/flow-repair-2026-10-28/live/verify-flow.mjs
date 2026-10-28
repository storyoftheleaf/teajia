#!/usr/bin/env node
// Default invocation prepares isolated fixture/cleanup SQL only. No network writes.
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base=dirname(fileURLToPath(import.meta.url));
const execute=process.argv.includes('--execute');
const supplied=process.env.LIVE_FLOW_RUN_ID;
const run=supplied??new Date().toISOString().replace(/\D/g,'').slice(0,14)+'_'+randomBytes(4).toString('hex');
assert(/^[a-z0-9_]{8,60}$/.test(run),'Invalid run id');
const shop='acc_live_flow_'+run,home=shop+'_home',owner='live_owner_'+run,buyer='live_buyer_'+run;
const dir=resolve(base,run);mkdirSync(dir,{recursive:true,mode:0o700});
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const manifest={run,shop,home,owner,buyer,slug:'flow-verify-'+run.replaceAll('_','-'),createdAt:new Date().toISOString()};
// Match worker hashPasswordPBKDF2: 16-byte salt, SHA-256,100000iterations,256bits.
// Raw fixture passwords and API-issued tokens never leave this process.
let ownerPassword=randomBytes(32).toString('base64url'),buyerPassword=randomBytes(32).toString('base64url');
function passwordHash(password){const salt=randomBytes(16);return 'pbkdf2:100000:'+salt.toString('hex')+':'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');}
const ownerHash=passwordHash(ownerPassword),buyerHash=passwordHash(buyerPassword);
const fixture=`BEGIN TRANSACTION;
INSERT INTO accounts(id,slug,name,status,kind,public_enabled,default_shipping_rate_per_kg,default_shipping_rate_currency)VALUES(${q(shop)},${q(manifest.slug)},'Isolated live verification','active','location',1,85,'Yuan'),(${q(home)},${q(manifest.slug+'-home')},'Isolated verification customer','active','personal',0,85,'Yuan');
INSERT INTO users(id,email,name,password_hash,role,session_version,email_verified_at)VALUES(${q(owner)},${q(owner+'@example.invalid')},'Verification owner',${q(ownerHash)},'user',0,datetime('now')),(${q(buyer)},${q(buyer+'@example.invalid')},'Verification customer',${q(buyerHash)},'user',0,datetime('now'));
INSERT INTO account_members(id,account_id,user_id,role,permissions,status)VALUES(${q('member_'+owner)},${q(shop)},${q(owner)},'owner','{"bundles":["catalog","stock","publish","sell"]}','active'),(${q('member_'+buyer)},${q(home)},${q(buyer)},'owner','{"bundles":["catalog","stock","publish"]}','active');
INSERT INTO account_features(account_id,feature,enabled)VALUES(${q(shop)},'live_verification_notifications_suppressed',1),(${q(home)},'live_verification_notifications_suppressed',1);
COMMIT;`;
const cleanup=`-- Retain paid test records and ledger as audit evidence; archive exact isolated accounts.
BEGIN TRANSACTION;
UPDATE accounts SET public_enabled=0,status='suspended',updated_at=datetime('now') WHERE id IN(${q(shop)},${q(home)});
UPDATE products SET is_public=0,shown_in_shop=0,status='Archived',updated_at=datetime('now') WHERE account_id IN(${q(shop)},${q(home)});
UPDATE product_listings SET is_public=0,shown_in_shop=0,status='archived',updated_at=datetime('now') WHERE account_id IN(${q(shop)},${q(home)});
UPDATE tea_profiles SET network_visible=0 WHERE originated_by_account_id IN(${q(shop)},${q(home)});
UPDATE users SET password_hash='!disabled-after-live-verification',session_version=session_version+1 WHERE id IN(${q(owner)},${q(buyer)});
UPDATE account_members SET status='inactive' WHERE account_id IN(${q(shop)},${q(home)}) AND user_id IN(${q(owner)},${q(buyer)});
DELETE FROM refresh_tokens WHERE user_id IN(${q(owner)},${q(buyer)});
UPDATE mcp_tokens SET revoked_at=datetime('now') WHERE user_id IN(${q(owner)},${q(buyer)}) AND account_id IN(${q(shop)},${q(home)});
COMMIT;`;
for(const [name,value]of [['manifest.json',JSON.stringify(manifest,null,2)],['fixture.sql',fixture],['archive.sql',cleanup]])writeFileSync(resolve(dir,name),value,{mode:0o600});
if(!execute){console.log(JSON.stringify({mode:'prepared_only',run,directory:dir,productionMutations:0}));process.exit(0);}
assert(process.env.LIVE_FLOW_ALLOW_MUTATIONS==='isolated-account-only','Explicit isolated execution guard required');
const api='https://api.teajia.com';
const expected=process.env.LIVE_FLOW_EXPECTED_REVISION;assert(/^[a-f0-9]{40}$/.test(expected??''),'Exact deployed revision required');
const release=await fetch(api+'/api/release').then(r=>r.json());assert.equal(release.revision,expected,'Wrong deployed revision');
const root=resolve(base,'../../..');
const sql=(name)=>{const result=spawnSync(resolve(root,'worker/node_modules/.bin/wrangler'),['d1','execute','teajia-db','--remote','--config',resolve(root,'worker/wrangler.toml'),'--file',resolve(dir,name)],{cwd:root,encoding:'utf8',env:process.env});assert.equal(result.status,0,'Scoped D1 operation failed; output withheld to avoid credential leakage');};
async function login(user,expectedAccount,password){
 const response=await fetch(api+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:user+'@example.invalid',password})});
 assert(response.ok,'Fixture password login failed HTTP '+response.status);
 const result=await response.json();assert.equal(typeof result.token,'string','Login did not return a token');
 assert.equal(result.active_account_id,expectedAccount,'Login selected an unexpected account');
 assert.equal(result.user?.id,user,'Login returned an unexpected fixture identity');
 assert.equal(result.memberships?.length,1,'Fixture unexpectedly belongs to more than one account');
 assert.equal(result.memberships[0].account_id,expectedAccount,'Fixture membership does not match');
 return result.token;
}
let ownerToken,buyerToken;const proof={...manifest,revision:expected,checks:[],records:{}};
async function req(label,path,body,method=body===undefined?'GET':'POST',identity='owner'){
 const headers={'Content-Type':'application/json'};if(identity==='owner'){headers.Authorization='Bearer '+ownerToken;headers['X-Teajia-Account']=shop;}if(identity==='buyer')headers.Authorization='Bearer '+buyerToken;
 const response=await fetch(api+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>null);assert(response.ok,label+' failed HTTP '+response.status);return data;
}
function checked(label,fn){fn();proof.checks.push(label);}
try{
 sql('fixture.sql');ownerToken=await login(owner,shop,ownerPassword);buyerToken=await login(buyer,home,buyerPassword);ownerPassword=undefined;buyerPassword=undefined;checked('normal verified password login selects isolated memberships',()=>{});
 const policy=await req('silent policy','/api/accounts/'+shop+'/features');assert.equal(policy.live_verification_policy,'isolated-flow-v1','Refusing commerce without deployed silent policy');
 const capture='live_capture_'+run;await req('capture','/api/compass/sync',{entries:[{id:capture,name:'Isolated flow verification tea',category:'tea',type:'Red',origin_country:'China',origin_region:'Yunnan',form:'Loose',price_amount:100,price_currency:'CNY',price_per_unit_grams:100,buy_total:500,buy_quantity_grams:500,tasting:{flavor:['orchid']}}]});
 const proposal=await req('receipt proposal','/api/compass/entries/'+capture+'/receipt-proposals',{purpose:'working',quantity:500,unit:'g',acquisition_kind:'purchase',idempotency_key:'receipt_'+run});
 const receipt=await req('accept receipt','/api/curate/receipt-proposals/'+proposal.id+'/accept',{});const replay=await req('retry receipt','/api/curate/receipt-proposals/'+proposal.id+'/accept',{});checked('receipt retry same product and ledger',()=>{assert.equal(receipt.product_id,replay.product_id);assert.equal(receipt.ledger_id,replay.ledger_id);});
 const product=receipt.product_id;proof.records={capture,proposal:proposal.id,product,receiptLedger:receipt.ledger_id};
 await req('activate','/api/products/'+product+'/publication',{status:'Active'},'PUT');await req('publish','/api/products/'+product+'/publication',{is_public:true},'PUT');await req('shelf','/api/products/'+product+'/shown',{shown_in_shop:true},'PUT');
 const shelf=await req('public catalogue','/api/s/'+manifest.slug+'/products',undefined,'GET','anonymous');checked('normal public shelf reflects committed stock',()=>assert(shelf.some(p=>p.id===product&&Number(p.stock_grams)===500)));
 const tracking=randomBytes(32).toString('hex');const body={source:'website',store_slug:manifest.slug,tracking_token:tracking,ref_number:'LIVE-'+run,customer_name:'Isolated verification',customer_contact:buyer+'@example.invalid',customer_location:'Isolated verification fixture',currency:'USD',total_estimate_usd:0.01,items:[{id:product,name:'Isolated flow verification tea',category:'tea',storeSlug:manifest.slug,quantityGrams:50,packGrams:50,packs:1,pricePerGram:0.0002,totalPrice:0.01}]};
 const order=await req('save order','/api/inquiries',body,'POST','buyer');const again=await req('retry order','/api/inquiries',body,'POST','buyer');checked('one invoice and canonical price',()=>{assert.equal(order.invoice_id,again.invoice_id);assert(order.total_estimate_usd>0.01);assert.equal(order.invoice_items[0].quantity_unit,'g');});proof.records.invoice=order.invoice_id;
 const draft=await req('customer draft history','/api/me/orders',undefined,'GET','buyer');checked('customer sees own draft across stores',()=>assert(draft.orders.some(o=>o.id===order.invoice_id)));
 await req('agree invoice','/api/invoices/'+order.invoice_id,{status:'Pending',shipping_cost_usd:3},'PUT');const payment={amount_usd:order.total_estimate_usd+3,method_label:'Cash',request_id:'payment_'+run};await req('record test payment','/api/invoices/'+order.invoice_id+'/payments',payment);await req('retry payment','/api/invoices/'+order.invoice_id+'/payments',payment);
 const shipping={invoice_id:order.invoice_id,tracking_number:'ISOLATED-'+run};await req('ship','/api/rpc/ship-invoice',shipping);await req('retry ship','/api/rpc/ship-invoice',shipping);
 const history=await req('customer completed history','/api/me/orders/'+order.invoice_id,undefined,'GET','buyer');checked('customer filled and persisted invoice units',()=>{assert.equal(history.status,'Filled');assert.equal(history.items[0].quantity_unit,'g');});
 const library=await req('customer tea trail','/api/compass/entries',undefined,'GET','buyer');checked('one customer library record after shipment retries',()=>assert.equal(library.entries.filter(row=>row.source_invoice_id===order.invoice_id).length,1));
 const tracked=await req('private tracking','/api/inquiries/'+tracking,undefined,'GET','anonymous');checked('tracking canonical invoice',()=>assert.equal(tracked.order.status,'Filled'));
 const ledger=await req('stock ledger','/api/stock-ledger?product_id='+encodeURIComponent(product)+'&limit=100');checked('stock deducted exactly once after all retries',()=>{const receipts=ledger.entries.filter(x=>x.id===receipt.ledger_id);const deductions=ledger.entries.filter(x=>x.source_invoice_id===order.invoice_id&&x.reason==='PAYMENT_CONFIRMED');assert.equal(receipts.length,1);assert.equal(deductions.length,1);assert.equal(Number(deductions[0].delta),-50);assert.equal(Number(deductions[0].balance_after),450);});
 proof.result='passed';
}catch(error){proof.result='failed';proof.error=String(error.message).slice(0,300);process.exitCode=1;
}finally{writeFileSync(resolve(dir,'proof.json'),JSON.stringify(proof,null,2),{mode:0o600});if(process.env.LIVE_FLOW_ARCHIVE_AFTER==='1'){try{sql('archive.sql');proof.archived=true;}catch{proof.archiveFailed=true;process.exitCode=1;}writeFileSync(resolve(dir,'proof.json'),JSON.stringify(proof,null,2),{mode:0o600});}console.log(JSON.stringify({result:proof.result,run,checks:proof.checks.length,proof:resolve(dir,'proof.json'),archived:proof.archived??false}));}
