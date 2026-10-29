import { attachLogisticsTracking } from './logisticsTracking';
import { calculateShipmentFreight } from '../../src/lib/logisticsFreight';
import type { LogisticsAddress, LogisticsFreight, LogisticsOrder, LogisticsShipment, LogisticsShipmentLine, LogisticsService, LogisticsTracking } from '../../src/lib/logisticsTypes';
import type { InventoryReceiptService } from './mcpTools/registry';

type Env = { DB:D1Database; inventoryReceipts?:InventoryReceiptService };
type Scope = {accountId:string;userId:string;email?:string|null};
type Row = Record<string,any>;
export type LogisticsAction = 'order'|'arrive'|'create'|'update'|'dispatch'|'receive'|'cancel'|'service_create'|'service_update'|'service_archive'|'address_create'|'address_update'|'address_archive';
export class LogisticsError extends Error { constructor(message:string,public status=400){super(message);} }
function fail(message:string,status=400):never {throw new LogisticsError(message,status);}
const parse=(value:any,fallback:any=null)=>{try{return JSON.parse(value)}catch{return fallback}};
const nullable=(value:any)=>value==null?null:Number(value);
function text(value:any,max=200):string|null {if(value==null||value==='')return null;if(typeof value!=='string'||value.length>max)fail('Invalid text field');return value.trim()||null;}
function measure(value:any):number|null {if(value==null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0)fail('Measurements and costs must be nonnegative numbers or null');return value;}
function reference(value:any):string|null {const v=text(value,2000);if(v&&!/^https:\/\//i.test(v))fail('Reference images and source links must use HTTPS');return v;}
function freight(value:any):LogisticsFreight|null {
 if(value==null)return null;
 if(!['kg','m3','fixed'].includes(value.basis)||typeof value.confirmed!=='boolean'||(value.allocation_basis!=null&&!['kg','m3'].includes(value.allocation_basis)))fail('Invalid freight basis or confirmation');
 const currency=text(value.currency,20);
 if(currency&&!/^[A-Za-z]{2,10}$/.test(currency))fail('Invalid freight currency');
 return {basis:value.basis,rate:measure(value.rate),billed_quantity:measure(value.billed_quantity),total_amount:measure(value.total_amount),currency,confirmed:value.confirmed,...(value.allocation_basis?{allocation_basis:value.allocation_basis}:{})};
}
async function company(env:Env,accountId:string,body:Row){
 const id=text(body.logistics_company_id),name=text(body.logistics_company_name);
 if(!name)fail('Logistics company name is required');
 if(id&&!await env.DB.prepare('SELECT id FROM customers WHERE id=? AND account_id=?').bind(id,accountId).first())fail('Logistics company contact not found',404);
 return {id,name};
}
const shipmentRow=(env:Env,accountId:string,id:string)=>env.DB.prepare('SELECT * FROM logistics_shipments WHERE id=? AND account_id=?').bind(id,accountId).first<Row>();
const purchaseRow=(env:Env,accountId:string,id:string)=>env.DB.prepare('SELECT * FROM purchase_orders WHERE id=? AND account_id=?').bind(id,accountId).first<Row>();

function addressView(row:Row):LogisticsAddress {
 return {id:row.id,label:row.label,role:row.role,recipient:row.recipient,address_lines:row.address_lines,city:row.city??null,region:row.region??null,postal_code:row.postal_code??null,country_code:row.country_code,phone:row.phone??null,logistics_company_id:row.logistics_company_id??null,archived:!!row.archived};
}
export async function readLogisticsAddresses(env:Env,accountId:string):Promise<LogisticsAddress[]> {
 const result=await env.DB.prepare('SELECT * FROM logistics_addresses WHERE account_id=? ORDER BY archived,label,id').bind(accountId).all<Row>();
 return (result.results??[]).map(addressView);
}
async function selectAddress(env:Env,accountId:string,value:any,role:'warehouse'|'destination',companyId?:string|null):Promise<LogisticsAddress|null> {
 const id=text(value);if(!id)return null;
 const row=await env.DB.prepare('SELECT * FROM logistics_addresses WHERE id=? AND account_id=?').bind(id,accountId).first<Row>();
 if(!row)fail('Saved address not found',404);
 if(row.archived)fail('This saved address is archived; choose an active address',409);
 if(row.role!==role)fail(role==='warehouse'?'Choose a logistics warehouse address':'Choose a delivery destination address',409);
 if(role==='warehouse'&&row.logistics_company_id&&row.logistics_company_id!==companyId)fail('Warehouse address belongs to a different logistics company',409);
 return addressView(row);
}
function checkAddressPreview(body:Row,address:LogisticsAddress|null){
 if('_expected_address' in body&&JSON.stringify(body._expected_address)!==JSON.stringify(address))fail('Saved address changed after preview; preview this operation again',409);
}

/** A single export-ready manifest powers the app and MCP. Original paid costs
 * keep their currency; shipment shares are proportional to allocated quantity. */
export async function readLogistics(env:Env,accountId:string):Promise<LogisticsTracking> {
 const [purchases,receiptLines,shipments,shipmentLines,studioReceipts,services,addresses]=await Promise.all([
  env.DB.prepare(`SELECT p.*,h.logistics_company_id,h.logistics_company_name,h.inbound_courier,h.inbound_tracking_number,h.logistics_arrived_at,h.warehouse_address_id,h.warehouse_address_json FROM purchase_orders p LEFT JOIN purchase_logistics h ON h.purchase_id=p.id AND h.account_id=p.account_id WHERE p.account_id=? ORDER BY p.created_at DESC`).bind(accountId).all<Row>(),
  env.DB.prepare(`SELECT r.*,COALESCE(p.given_name,p.product_name) product_name,p.image_url,p.source_compass_entry_id FROM inventory_receipt_lines r JOIN products p ON p.id=r.product_id AND p.account_id=r.account_id WHERE r.account_id=?`).bind(accountId).all<Row>(),
  env.DB.prepare('SELECT * FROM logistics_shipments WHERE account_id=? ORDER BY created_at DESC,id').bind(accountId).all<Row>(),
  env.DB.prepare('SELECT * FROM logistics_shipment_lines WHERE account_id=? ORDER BY id').bind(accountId).all<Row>(),
  env.DB.prepare('SELECT r.id,r.shipment_line_id line_id,r.ledger_id,r.quantity,r.received_at,s.user_email recorded_by,l.shipment_id FROM logistics_studio_receipts r JOIN logistics_shipment_lines l ON l.id=r.shipment_line_id AND l.account_id=r.account_id JOIN stock_ledger s ON s.id=r.ledger_id AND s.account_id=r.account_id WHERE r.account_id=? ORDER BY r.received_at DESC,r.id').bind(accountId).all<Row>(),
  env.DB.prepare('SELECT * FROM logistics_services WHERE account_id=? ORDER BY logistics_company_name,name').bind(accountId).all<Row>(),
  readLogisticsAddresses(env,accountId),
 ]);
 const lines=receiptLines.results??[],allocated=shipmentLines.results??[];
 const active=new Set((shipments.results??[]).filter(s=>s.state!=='cancelled').map(s=>s.id));
 const itemFor=(purchase:Row,line:Row)=>{const items=parse(purchase.items_json,[]);return Array.isArray(items)?items.find((i:Row)=>i.product_id===line.product_id||(line.source_compass_entry_id&&i.compass_entry_id===line.source_compass_entry_id)):null};
 const orders:LogisticsOrder[]=(purchases.results??[]).map(p=>({purchase_id:p.id,warehouse_address_id:p.warehouse_address_id??null,warehouse_address:parse(p.warehouse_address_json),receipt_id:p.receipt_id??null,vendor_name:p.vendor_name??null,logistics_company_id:p.logistics_company_id??null,logistics_company_name:p.logistics_company_name??null,inbound_courier:p.inbound_courier??null,inbound_tracking_number:p.logistics_company_name!=null?p.inbound_tracking_number??null:p.tracking_number??null,logistics_arrived_at:p.logistics_arrived_at??null,lines:lines.filter(l=>l.receipt_id===p.receipt_id).map(l=>{
  const item=itemFor(p,l);
  return {id:l.id,product_id:l.product_id,product_name:l.product_name,unit:l.unit,expected_quantity:Number(l.expected_quantity),received_quantity:Number(l.received_quantity),cancelled_quantity:Number(l.cancelled_quantity),available_quantity:Math.max(0,Number(l.expected_quantity)-Number(l.received_quantity)-Number(l.cancelled_quantity)-allocated.filter(a=>a.receipt_line_id===l.id&&active.has(a.shipment_id)).reduce((sum,a)=>sum+Number(a.quantity)-Number(a.received_quantity),0)),original_cost_amount:l.original_cost_amount!=null?Number(l.original_cost_amount):l.original_unit_cost!=null?Number(l.original_unit_cost)*Number(l.expected_quantity):null,original_cost_currency:l.original_cost_currency??null,image_url:l.image_url??item?.image_url??null,source_url:item?.source_url??item?.url??null};
 })}));
 const result:LogisticsShipment[]=(shipments.results??[]).map(s=>{
  const items:LogisticsShipmentLine[]=allocated.filter(a=>a.shipment_id===s.id).map(a=>{
   const line=orders.find(o=>o.purchase_id===a.purchase_id)?.lines.find(l=>l.id===a.receipt_line_id);
   return {...a,id:a.id,shipment_id:a.shipment_id,purchase_id:a.purchase_id,receipt_line_id:a.receipt_line_id,product_id:line?.product_id??'',product_name:line?.product_name??'Unknown item',unit:line?.unit??'g',quantity:Number(a.quantity),received_quantity:Number(a.received_quantity),weight_kg:nullable(a.weight_kg),volume_m3:nullable(a.volume_m3),weight_estimated:!!a.weight_estimated,volume_estimated:!!a.volume_estimated,image_url:a.image_url??line?.image_url??null,source_url:a.source_url??line?.source_url??null,original_cost_amount:line?.original_cost_amount==null?null:line.original_cost_amount*Number(a.quantity)/line.expected_quantity,original_cost_currency:line?.original_cost_currency??null,allocated_freight:null};
  });
  const cost=freight(parse(s.freight_json));
  const allocation=cost?calculateShipmentFreight(cost,items):null;
  return {studio_receipts:(studioReceipts.results??[]).filter(r=>r.shipment_id===s.id).map(({shipment_id,...r})=>({id:r.id,line_id:r.line_id,ledger_id:r.ledger_id,quantity:Number(r.quantity),received_at:r.received_at,recorded_by:r.recorded_by??null})),id:s.id,delivery_address_id:s.delivery_address_id??null,delivery_address:parse(s.delivery_address_json),service_id:s.service_id??null,service_quote:parse(s.service_quote_json),logistics_company_id:s.logistics_company_id??null,logistics_company_name:s.logistics_company_name,mode:s.mode,state:s.state,outbound_courier:s.outbound_courier??null,tracking_number:s.tracking_number??null,eta:s.eta??null,created_at:s.created_at,dispatched_at:s.dispatched_at??null,freight:cost,freight_total:allocation?.total_amount??null,freight_estimated:allocation?.estimated??true,freight_issue:allocation?.issue??(cost?null:'Freight has not been entered'),lines:items.map(l=>({...l,allocated_freight:allocation?.allocations.find(a=>a.id===l.id)?.amount??null}))};
 });
 return attachLogisticsTracking(env,accountId,{orders,shipments:result,addresses,services:(services.results??[]).map(serviceView)});
}

function serviceView(row:Row):LogisticsService {return {id:row.id,logistics_company_id:row.logistics_company_id,logistics_company_name:row.logistics_company_name,name:row.name,mode:row.mode,basis:row.basis,rate:Number(row.rate),currency:row.currency,active:!!row.active};}

/** Rechecked when a durable MCP preview is confirmed. REST uses the same path. */
export async function mutateLogistics(env:Env,scope:Scope,action:LogisticsAction,id:string,body:Row,preview=false):Promise<Row> {
 const account=scope.accountId;
 if(action.startsWith('address_')){
  const old=action==='address_create'?null:await env.DB.prepare('SELECT * FROM logistics_addresses WHERE id=? AND account_id=?').bind(id,account).first<Row>();
  if(action!=='address_create'&&!old)fail('Saved address not found',404);
  if(action==='address_archive'){
   if(preview)return {action,address:addressView(old!)};
   await env.DB.prepare("UPDATE logistics_addresses SET archived=1,updated_at=datetime('now') WHERE id=? AND account_id=?").bind(id,account).run();
   return {address:addressView({...old,archived:1})};
  }
  if(old?.archived)fail('Archived addresses cannot be edited; save a new address',409);
  const input={...old,...body};
  const label=text(input.label,120),recipient=text(input.recipient),address_lines=text(input.address_lines,1200),country_code=text(input.country_code,2)?.toUpperCase();
  if(!label||!recipient||!address_lines||!country_code||! /^[A-Z]{2}$/.test(country_code)||!['warehouse','destination'].includes(input.role))fail('Address needs a label, recipient, street address, two-letter country code and warehouse or destination role');
  const companyId=text(input.logistics_company_id);
  if(companyId&&input.role!=='warehouse')fail('Only warehouse addresses can belong to a logistics company');
  if(companyId&&!await env.DB.prepare('SELECT id FROM customers WHERE id=? AND account_id=?').bind(companyId,account).first())fail('Logistics company contact not found',404);
  const values={label,role:input.role,recipient,address_lines,city:text(input.city),region:text(input.region),postal_code:text(input.postal_code,40),country_code,phone:text(input.phone,80),logistics_company_id:companyId};
  if(preview)return {action,...values,note:'Saved address edits do not change the addresses already assigned to purchases or shipments.'};
  const addressId=old?.id??crypto.randomUUID(),keys=Object.keys(values);
  if(old)await env.DB.prepare(`UPDATE logistics_addresses SET ${keys.map(k=>`${k}=?`).join(',')},updated_at=datetime('now') WHERE id=? AND account_id=?`).bind(...Object.values(values),addressId,account).run();
  else await env.DB.prepare(`INSERT INTO logistics_addresses(id,account_id,${keys.join(',')}) VALUES(?,?,${keys.map(()=>'?').join(',')})`).bind(addressId,account,...Object.values(values)).run();
  return {address:addressView({id:addressId,...values,archived:0})};
 }
 if(action.startsWith('service_')){
  const old=action==='service_create'?null:await env.DB.prepare('SELECT * FROM logistics_services WHERE id=? AND account_id=?').bind(id,account).first<Row>();
  if(action!=='service_create'&&!old)fail('Logistics service not found',404);
  if(action==='service_archive'){
   if(preview)return {action,service:serviceView(old!)};
   await env.DB.prepare("UPDATE logistics_services SET active=0,updated_at=datetime('now') WHERE id=? AND account_id=?").bind(id,account).run();
   return {service:serviceView({...old,active:0})};
  }
  const input={...old,...body};const c=await company(env,account,input);
  if(!c.id)fail('Save a company contact before adding its services');
  const name=text(input.name),currency=text(input.currency,20),rate=measure(input.rate);
  if(!name||!currency||!/^[A-Za-z]{2,10}$/.test(currency)||rate==null||!['air','sea'].includes(input.mode)||!['kg','m3','fixed'].includes(input.basis))fail('Service needs a name, air/sea route, charging basis, rate and currency');
  const values={logistics_company_id:c.id,logistics_company_name:c.name,name,mode:input.mode,basis:input.basis,rate,currency};
  if(preview)return {action,...values,note:'Changing this rate card does not reprice existing shipment quotes.'};
  const serviceId=old?.id??crypto.randomUUID();
  try {
   if(old)await env.DB.prepare("UPDATE logistics_services SET logistics_company_id=?,logistics_company_name=?,name=?,mode=?,basis=?,rate=?,currency=?,updated_at=datetime('now') WHERE id=? AND account_id=?").bind(c.id,c.name,name,input.mode,input.basis,rate,currency,serviceId,account).run();
   else await env.DB.prepare("INSERT INTO logistics_services(id,account_id,logistics_company_id,logistics_company_name,name,mode,basis,rate,currency,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))").bind(serviceId,account,c.id,c.name,name,input.mode,input.basis,rate,currency).run();
  }catch(error){if(String(error).includes('UNIQUE'))fail('This company already has a service with that name',409);throw error;}
  return {service:serviceView({id:serviceId,...values,active:old?.active??1})};
 }

 if(action==='order'){
  const purchase=await purchaseRow(env,account,id);if(!purchase)fail('Purchase not found',404);
  const old=await env.DB.prepare('SELECT * FROM purchase_logistics WHERE purchase_id=? AND account_id=?').bind(id,account).first<Row>();
  const c=await company(env,account,{...old,...body});
  const inbound_courier='inbound_courier'in body?text(body.inbound_courier):old?.inbound_courier??null;
  const inbound_tracking_number='inbound_tracking_number'in body?text(body.inbound_tracking_number):old?old.inbound_tracking_number??null:purchase.tracking_number??null;
  if(old&&(old.logistics_company_id!==c.id||old.logistics_company_name!==c.name)&&await env.DB.prepare("SELECT l.id FROM logistics_shipment_lines l JOIN logistics_shipments s ON s.id=l.shipment_id AND s.account_id=l.account_id WHERE l.purchase_id=? AND l.account_id=? AND s.state!='cancelled' LIMIT 1").bind(id,account).first())fail('Company cannot change after shipment allocation',409);
  const companyChanged=!!old&&(old.logistics_company_id!==c.id||old.logistics_company_name!==c.name);
  const address='warehouse_address_id' in body?await selectAddress(env,account,body.warehouse_address_id,'warehouse',c.id):companyChanged?null:parse(old?.warehouse_address_json);
  if('warehouse_address_id' in body)checkAddressPreview(body,address);
  if(preview)return {action,purchase_id:id,company:c,inbound_courier,inbound_tracking_number,warehouse_address:address};
  await env.DB.prepare(`INSERT INTO purchase_logistics(purchase_id,account_id,logistics_company_id,logistics_company_name,inbound_courier,inbound_tracking_number,warehouse_address_id,warehouse_address_json,logistics_arrived_at,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,datetime('now')) ON CONFLICT(purchase_id) DO UPDATE SET logistics_company_id=excluded.logistics_company_id,logistics_company_name=excluded.logistics_company_name,inbound_courier=excluded.inbound_courier,inbound_tracking_number=excluded.inbound_tracking_number,warehouse_address_id=excluded.warehouse_address_id,warehouse_address_json=excluded.warehouse_address_json,logistics_arrived_at=CASE WHEN ? THEN NULL ELSE purchase_logistics.logistics_arrived_at END,updated_at=datetime('now')`).bind(id,account,c.id,c.name,inbound_courier,inbound_tracking_number,address?.id??null,address?JSON.stringify(address):null,companyChanged?1:0).run();
  return {order:(await readLogistics(env,account)).orders.find(o=>o.purchase_id===id)};
 }
 if(action==='arrive'){
  const order=await env.DB.prepare('SELECT * FROM purchase_logistics WHERE purchase_id=? AND account_id=?').bind(id,account).first<Row>();
  if(!order)fail('Assign a logistics company before marking arrival',409);
  if(preview)return {action,purchase_id:id,note:'Arrival at logistics only. No stock is added.'};
  await env.DB.prepare("UPDATE purchase_logistics SET logistics_arrived_at=COALESCE(logistics_arrived_at,datetime('now')),updated_at=datetime('now') WHERE purchase_id=? AND account_id=?").bind(id,account).run();
  return {order:(await readLogistics(env,account)).orders.find(o=>o.purchase_id===id)};
 }
 if(action==='create'){
  const c=await company(env,account,body);const key=text(body.idempotency_key,120);if(!key)fail('An idempotency key is required');
  if(!['air','sea'].includes(body.mode))fail('Mode must be air or sea');
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100||new Set(body.lines.map((l:Row)=>l.receipt_line_id)).size!==body.lines.length)fail('Choose 1–100 unique receipt lines');
  const lines=body.lines.map((l:Row)=>({receipt_line_id:text(l.receipt_line_id),quantity:measure(l.quantity),weight_kg:measure(l.weight_kg),weight_estimated:l.weight_estimated!==false,volume_m3:measure(l.volume_m3),volume_estimated:l.volume_estimated!==false})).sort((a:Row,b:Row)=>String(a.receipt_line_id).localeCompare(String(b.receipt_line_id)));
  const enteredFreight=freight(body.freight),serviceId=text(body.service_id);const fingerprint=JSON.stringify({company:c,mode:body.mode,lines,freight:enteredFreight,service_id:serviceId,...(body.delivery_address_id?{delivery_address_id:body.delivery_address_id}:{})});
  const prior=await env.DB.prepare('SELECT * FROM logistics_shipments WHERE account_id=? AND idempotency_key=?').bind(account,key).first<Row>();
  if(prior){if(prior.request_fingerprint!==fingerprint)fail('Idempotency key already used for a different shipment',409);return {shipment:(await readLogistics(env,account)).shipments.find(s=>s.id===prior.id),already_created:true};}
  const address=await selectAddress(env,account,body.delivery_address_id,'destination');
  checkAddressPreview(body,address);
  let quote:LogisticsService|null=null;
  if(serviceId){
   const service=await env.DB.prepare('SELECT * FROM logistics_services WHERE id=? AND account_id=?').bind(serviceId,account).first<Row>();
   if(!service)fail('Logistics service not found',404);
   if(!service.active)fail('This logistics service is archived',409);
   if(service.logistics_company_id!==c.id||service.mode!==body.mode)fail('Service must belong to the selected company and transport mode',409);
   quote=serviceView(service);
   if(body._expected_service_quote&&JSON.stringify(body._expected_service_quote)!==JSON.stringify(quote))fail('Service quote changed after preview; preview this shipment again',409);
  }
  const f=enteredFreight??(quote?{basis:quote.basis,rate:quote.rate,billed_quantity:null,total_amount:quote.basis==='fixed'?quote.rate:null,currency:quote.currency,confirmed:false}:null);
  const tracking=await readLogistics(env,account);const selected:Row[]=[];
  for(const input of lines){
   const order=tracking.orders.find(o=>o.lines.some(l=>l.id===input.receipt_line_id));const line=order?.lines.find(l=>l.id===input.receipt_line_id);
   if(!order||!line)fail('Receipt line not found',404);
   if(!order.logistics_arrived_at||order.logistics_company_id!==c.id||order.logistics_company_name!==c.name)fail('All selected goods must have arrived at this logistics company',409);
   if(!input.quantity||input.quantity>line.available_quantity||(line.unit==='unit'&&!Number.isInteger(input.quantity)))fail('Quantity exceeds unallocated goods at logistics',409);
   selected.push({...input,purchase_id:order.purchase_id});
  }
  if(preview)return {action,company:c,mode:body.mode,lines:selected,freight:f,service_quote:quote,delivery_address:address,note:'Reserves goods at logistics; no stock is added.'};
  const shipmentId=crypto.randomUUID();
  try {await env.DB.batch([
   env.DB.prepare("INSERT INTO logistics_shipments(id,account_id,logistics_company_id,logistics_company_name,mode,state,freight_json,service_id,service_quote_json,delivery_address_id,delivery_address_json,idempotency_key,request_fingerprint,created_at) VALUES(?,?,?,?,?,'draft',?,?,?,?,?,?,?,datetime('now'))").bind(shipmentId,account,c.id,c.name,body.mode,f?JSON.stringify(f):null,serviceId,quote?JSON.stringify(quote):null,address?.id??null,address?JSON.stringify(address):null,key,fingerprint),
   ...selected.map(l=>env.DB.prepare('INSERT INTO logistics_shipment_lines(id,account_id,shipment_id,purchase_id,receipt_line_id,quantity,received_quantity,weight_kg,weight_estimated,volume_m3,volume_estimated) VALUES(?,?,?,?,?,?,0,?,?,?,?)').bind(crypto.randomUUID(),account,shipmentId,l.purchase_id,l.receipt_line_id,l.quantity,l.weight_kg,l.weight_estimated?1:0,l.volume_m3,l.volume_estimated?1:0)),
  ]);}catch{
   const raced=await env.DB.prepare('SELECT * FROM logistics_shipments WHERE account_id=? AND idempotency_key=?').bind(account,key).first<Row>();
   if(raced?.request_fingerprint===fingerprint)return {shipment:(await readLogistics(env,account)).shipments.find(s=>s.id===raced.id),already_created:true};
   fail('Goods changed while creating shipment; read logistics again',409);
  }
  return {shipment:(await readLogistics(env,account)).shipments.find(s=>s.id===shipmentId)};
 }
 const shipment=await shipmentRow(env,account,id);if(!shipment)fail('Shipment not found',404);
 if(action==='cancel'){
  if(!['draft','cancelled'].includes(shipment.state))fail('Only a draft shipment can be cancelled',409);
  if(preview)return {action,shipment_id:id,note:'Releases draft allocations so these goods can be regrouped. No stock changes.'};
  await env.DB.prepare("UPDATE logistics_shipments SET state='cancelled' WHERE id=? AND account_id=? AND state='draft'").bind(id,account).run();
  const current=await shipmentRow(env,account,id);if(current?.state!=='cancelled')fail('Shipment was dispatched before cancellation; read it again',409);
 }
 if(action==='update'){
  if(shipment.state==='cancelled')fail('Cancelled shipments retain their original manifest',409);
  const updates:Row={};for(const key of ['outbound_courier','tracking_number','eta'])if(key in body)updates[key]=text(body[key]);
  if(updates.eta&&(!/^\d{4}-\d{2}-\d{2}$/.test(updates.eta)||!Number.isFinite(Date.parse(updates.eta))||new Date(updates.eta).toISOString().slice(0,10)!==updates.eta))fail('Expected date must be YYYY-MM-DD');
  let selectedAddress:LogisticsAddress|null=null;
  if('delivery_address_id'in body){selectedAddress=await selectAddress(env,account,body.delivery_address_id,'destination');checkAddressPreview(body,selectedAddress);updates.delivery_address_id=selectedAddress?.id??null;updates.delivery_address_json=selectedAddress?JSON.stringify(selectedAddress):null;}
  if('freight'in body)updates.freight_json=body.freight==null?null:JSON.stringify(freight(body.freight));
  if(body.lines!=null&&!Array.isArray(body.lines))fail('Lines must be an array');
  if(body.lines?.length>100||new Set((body.lines??[]).map((l:Row)=>l.id)).size!==(body.lines??[]).length)fail('Use at most 100 unique lines');
  const statements:D1PreparedStatement[]=[];const keys=Object.keys(updates);
  if(keys.length)statements.push(env.DB.prepare(`UPDATE logistics_shipments SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=? AND account_id=?`).bind(...keys.map(k=>updates[k]),id,account));
  for(const l of body.lines??[]){
   if(!await env.DB.prepare('SELECT id FROM logistics_shipment_lines WHERE id=? AND shipment_id=? AND account_id=?').bind(l.id,id,account).first())fail('Shipment line not found',404);
   const changes:Row={};for(const key of ['weight_kg','volume_m3'])if(key in l)changes[key]=measure(l[key]);
   for(const key of ['weight_estimated','volume_estimated'])if(key in l){if(typeof l[key]!=='boolean')fail('Measurement provenance must be explicit');changes[key]=l[key]?1:0;}
   for(const key of ['image_url','source_url'])if(key in l)changes[key]=reference(l[key]);
   const names=Object.keys(changes);if(names.length)statements.push(env.DB.prepare(`UPDATE logistics_shipment_lines SET ${names.map(k=>`${k}=?`).join(',')} WHERE id=? AND shipment_id=? AND account_id=?`).bind(...names.map(k=>changes[k]),l.id,id,account));
  }
  if(preview)return {action,shipment_id:id,changes:body,...('delivery_address_id' in body?{delivery_address:selectedAddress}:{})};
  if(statements.length)await env.DB.batch(statements);
 }
 if(action==='dispatch'){
  if(shipment.state!=='draft'&&shipment.state!=='in_transit')fail('Shipment has already reached the studio',409);
  if(!await env.DB.prepare('SELECT id FROM logistics_shipment_lines WHERE shipment_id=? AND account_id=? LIMIT 1').bind(id,account).first())fail('Shipment has no goods',409);
  if(preview)return {action,shipment_id:id,note:'Marks the combined shipment in transit; no stock is added.'};
  await env.DB.prepare("UPDATE logistics_shipments SET state='in_transit',dispatched_at=COALESCE(dispatched_at,datetime('now')) WHERE id=? AND account_id=? AND state='draft'").bind(id,account).run();
  if((await shipmentRow(env,account,id))?.state!=='in_transit')fail('Shipment changed before dispatch; read it again',409);
 }
 if(action==='receive'){
  if(!env.inventoryReceipts?.receiveLogistics)fail('Inventory receiving unavailable',503);
  const key=text(body.idempotency_key,80);if(!key)fail('An idempotency key is required');
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100||new Set(body.lines.map((l:Row)=>l.line_id)).size!==body.lines.length)fail('Choose 1–100 unique shipment lines');
  const lines:Row[]=[];
  for(const input of body.lines){
   const line=await env.DB.prepare(`SELECT l.*,r.unit FROM logistics_shipment_lines l JOIN inventory_receipt_lines r ON r.id=l.receipt_line_id AND r.account_id=l.account_id WHERE l.id=? AND l.shipment_id=? AND l.account_id=?`).bind(input.line_id,id,account).first<Row>();
   if(!line)fail('Shipment line not found',404);
   const quantity=measure(input.quantity);if(!quantity||(line.unit==='unit'&&!Number.isInteger(quantity)))fail('Invalid studio receipt quantity');
   const movementKey=`logistics:${id}:${key}:${line.id}`;
   if(movementKey.length>200)fail('Receipt request key is too long');
   const prior=await env.DB.prepare('SELECT * FROM logistics_studio_receipts WHERE account_id=? AND idempotency_key=?').bind(account,movementKey).first<Row>();
   if(prior){if(prior.shipment_line_id!==line.id||Number(prior.quantity)!==quantity)fail('Receipt key already used with different quantities',409);}
   else if(!['in_transit','partially_received'].includes(shipment.state)||quantity>Number(line.quantity)-Number(line.received_quantity))fail('Dispatch first, then receive only outstanding shipment quantities',409);
   lines.push({...line,quantity,movementKey});
  }
  if(preview)return {action,shipment_id:id,lines:lines.map(l=>({line_id:l.id,quantity:l.quantity,unit:l.unit})),note:'These explicit quantities will be added to studio stock.'};
  const recorded:Row[]=[];
  for(const line of lines){
   try{
    const response=await env.inventoryReceipts.receiveLogistics(scope,line.receipt_line_id,{quantity:line.quantity,idempotency_key:line.movementKey,note:text(body.note,1000)??'Received shipment at studio'},line.id);
    const result=await response.json() as Row;
    if(!response.ok)return {committed:false,partial:recorded.length>0,recorded,failed:{line_id:line.id,...result},retry:{shipment_id:id,...body}};
    recorded.push({line_id:line.id,...result});
   }catch{return {committed:false,partial:recorded.length>0,recorded,failed:{line_id:line.id,error:'Receipt outcome unknown; retry the same key and quantities'},retry:{shipment_id:id,...body}};}
  }
  return {committed:true,recorded,shipment:(await readLogistics(env,account)).shipments.find(s=>s.id===id)};
 }
 return {shipment:(await readLogistics(env,account)).shipments.find(s=>s.id===id)};
}
