import { readPurchaseTracking } from '../purchaseTracking';
import { remainingReceiptQuantity } from '../inventoryDomain';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';
import type { ToolAuth, ToolEnv, ToolHandler, ToolModule } from './registry';

type ArrivalLine={line_id:string;quantity:number};
type Ticket={kind:'purchase:arrival';accountId:string;receiptId:string;key:string;lines:ArrivalLine[];note:string|null}
 |{kind:'purchase:cancel';accountId:string;lineId:string;remaining:number}
 |{kind:'purchase:tracking';accountId:string;receiptId:string;changes:Record<string,string|null>};
const scope=(auth:ToolAuth)=>({accountId:auth.accountId,userId:auth.userId,email:auth.userEmail});
const readLine=async(env:ToolEnv,auth:ToolAuth,id:string)=>env.DB.prepare('SELECT * FROM inventory_receipt_lines WHERE id=? AND account_id=?').bind(id,auth.accountId).first<Record<string,any>>();
const remaining=(line:Record<string,any>)=>remainingReceiptQuantity(Number(line.expected_quantity),Number(line.received_quantity),Number(line.cancelled_quantity));
const receipt=async(env:ToolEnv,auth:ToolAuth,id:string)=>env.DB.prepare('SELECT * FROM inventory_receipts WHERE id=? AND account_id=?').bind(id,auth.accountId).first<Record<string,any>>();

async function checkArrival(env:ToolEnv,auth:ToolAuth,receiptId:string,key:string,lines:ArrivalLine[]) {
  if(!await receipt(env,auth,receiptId))return {error:'receipt_not_found'};
  const preview=[];
  for(const input of lines){
    if(`${key}:${input.line_id}`.length>200)return {error:'arrival_request_key_too_long',line_id:input.line_id};
    const line=await readLine(env,auth,input.line_id);
    if(!line||line.receipt_id!==receiptId)return {error:'receipt_line_not_found',line_id:input.line_id};
    const prior=await env.DB.prepare('SELECT * FROM stock_ledger WHERE account_id = ? AND idempotency_key = ?').bind(auth.accountId,`${key}:${input.line_id}`).first<Record<string,any>>();
    if(prior){
      let fingerprint:any;try{fingerprint=JSON.parse(prior.movement_fingerprint);}catch{}
      if(prior.inventory_receipt_line_id!==input.line_id||prior.movement_type!=='receipt'||Number(fingerprint?.quantity)!==input.quantity)return {error:'arrival_request_conflict',line_id:input.line_id};
    }else if(!Number.isFinite(input.quantity)||input.quantity<=0||input.quantity>remaining(line)||(line.unit==='unit'&&!Number.isInteger(input.quantity)))return {error:'invalid_arrival_quantity',line_id:input.line_id,remaining:remaining(line),unit:line.unit};
    preview.push({line_id:line.id,product_id:line.product_id,quantity:input.quantity,unit:line.unit,coming_before:remaining(line),already_recorded:!!prior});
  }
  return {lines:preview};
}

const recordArrival:ToolHandler=async(env,auth,args)=>{
  if(!env.inventoryReceipts)return {error:'inventory_receiving_unavailable'};
  if(args.confirm){
    const ticket=await consumeTicket<Ticket,'purchase:arrival'>(env,String(args.confirm),'purchase:arrival',auth);if(!ticket)return INVALID_TICKET;
    const checked=await checkArrival(env,auth,ticket.receiptId,ticket.key,ticket.lines);if('error'in checked)return checked;
    const recorded=[];
    for(const line of ticket.lines){
      try {
        const response=await env.inventoryReceipts.receive(scope(auth),line.line_id,{quantity:line.quantity,idempotency_key:`${ticket.key}:${line.line_id}`,note:ticket.note??'Arrival recorded by agent'});
        const result=await response.json() as any;
        if(!response.ok)return {committed:false,partial:recorded.length>0,recorded,failed:{line_id:line.line_id,...result},retry:{receipt_id:ticket.receiptId,idempotency_key:ticket.key,lines:ticket.lines},instruction:'Retry the same request key and quantities. Recorded lines are not added twice.'};
        recorded.push({line_id:line.line_id,...result});
      }catch{return {committed:false,partial:recorded.length>0,recorded,failed:{line_id:line.line_id,error:'arrival_outcome_unknown'},retry:{receipt_id:ticket.receiptId,idempotency_key:ticket.key,lines:ticket.lines},instruction:'Read the purchase, then retry with the same request key and quantities; never invent a new key for this arrival.'};}
    }
    return {committed:true,action:'record_arrival',receipt_id:ticket.receiptId,recorded,...await readPurchaseTracking(env,auth.accountId,ticket.receiptId)};
  }
  const receiptId=String(args.receipt_id??'').trim(),key=String(args.idempotency_key??'').trim();
  if(!receiptId||!key||key.length>120)return {error:'receipt_id_and_idempotency_key_required'};
  if(!Array.isArray(args.lines)||!args.lines.length||args.lines.length>100)return {error:'one_to_100_explicit_arrival_lines_required'};
  const lines=args.lines.map((line:any)=>({line_id:String(line.line_id??''),quantity:line.quantity}));
  if(lines.some((line:ArrivalLine)=>!line.line_id||typeof line.quantity!=='number')||new Set(lines.map((line:ArrivalLine)=>line.line_id)).size!==lines.length)return {error:'unique_lines_with_numeric_quantities_required'};
  const checked=await checkArrival(env,auth,receiptId,key,lines);if('error'in checked)return checked;
  const ticket:Ticket={kind:'purchase:arrival',accountId:auth.accountId,receiptId,key,lines,note:typeof args.note==='string'?args.note.slice(0,1000):null};
  return previewEnvelope({action:'record_arrival',receipt_id:receiptId,...checked,note:'Only the quantities stated here are added to stock. Use the same request key for retries.'},await issueTicket(env,ticket,auth.tokenId));
};

const cancelRemaining:ToolHandler=async(env,auth,args)=>{
  if(!env.inventoryReceipts)return {error:'inventory_receiving_unavailable'};
  if(args.confirm){
    const ticket=await consumeTicket<Ticket,'purchase:cancel'>(env,String(args.confirm),'purchase:cancel',auth);if(!ticket)return INVALID_TICKET;
    const line=await readLine(env,auth,ticket.lineId);if(!line)return {error:'receipt_line_not_found'};
    if(remaining(line)!==ticket.remaining)return {error:'delivery_changed',instruction:'Read the purchase and preview the cancellation again.'};
    const response=await env.inventoryReceipts.cancel(scope(auth),ticket.lineId);return {committed:response.ok,...await response.json() as object};
  }
  const line=await readLine(env,auth,String(args.line_id??''));if(!line)return {error:'receipt_line_not_found'};
  const ticket:Ticket={kind:'purchase:cancel',accountId:auth.accountId,lineId:line.id,remaining:remaining(line)};
  return previewEnvelope({action:'cancel_delivery_remainder',line_id:line.id,quantity:ticket.remaining,unit:line.unit,note:'Cancels only the outstanding amount; shelf stock does not change.'},await issueTicket(env,ticket,auth.tokenId));
};

const updateTracking:ToolHandler=async(env,auth,args)=>{
  if(args.confirm){
    const ticket=await consumeTicket<Ticket,'purchase:tracking'>(env,String(args.confirm),'purchase:tracking',auth);if(!ticket)return INVALID_TICKET;
    if(!await receipt(env,auth,ticket.receiptId))return {error:'receipt_not_found'};
    const statements:D1PreparedStatement[]=[];
    const fields=Object.keys(ticket.changes).filter(key=>key!=='tracking_number');
    if(fields.length)statements.push(env.DB.prepare(`UPDATE inventory_receipts SET ${fields.map(key=>`${key}=?`).join(',')},updated_at=datetime('now') WHERE id=? AND account_id=?`).bind(...fields.map(key=>ticket.changes[key]),ticket.receiptId,auth.accountId));
    if('tracking_number'in ticket.changes)statements.push(env.DB.prepare("UPDATE purchase_orders SET tracking_number=?,updated_at=datetime('now') WHERE receipt_id=? AND account_id=?").bind(ticket.changes.tracking_number,ticket.receiptId,auth.accountId));
    if(statements.length)await env.DB.batch(statements);
    return {committed:true,action:'update_delivery_tracking',...await readPurchaseTracking(env,auth.accountId,ticket.receiptId)};
  }
  const receiptId=String(args.receipt_id??'');if(!await receipt(env,auth,receiptId))return {error:'receipt_not_found'};
  const changes:Record<string,string|null>={};
  if('eta'in args){if(args.eta!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(args.eta)||!Number.isFinite(Date.parse(args.eta))))return {error:'eta_must_be_date_or_null'};changes.eta=args.eta;}
  if('transport_mode'in args){if(args.transport_mode!==null&&!['air','sea','land','courier'].includes(args.transport_mode))return {error:'invalid_transport_mode'};changes.transport_mode=args.transport_mode;}
  if('tracking_number'in args){if(args.tracking_number!==null&&(typeof args.tracking_number!=='string'||args.tracking_number.length>200))return {error:'invalid_tracking_number'};if(!await env.DB.prepare('SELECT id FROM purchase_orders WHERE receipt_id=? AND account_id=?').bind(receiptId,auth.accountId).first())return {error:'purchase_link_required_for_tracking_number'};changes.tracking_number=args.tracking_number;}
  if(!Object.keys(changes).length)return {error:'no_tracking_changes'};
  const ticket:Ticket={kind:'purchase:tracking',accountId:auth.accountId,receiptId,changes};return previewEnvelope({action:'update_delivery_tracking',receipt_id:receiptId,changes},await issueTicket(env,ticket,auth.tokenId));
};
const confirm={type:'string',description:'Token from the preview. Confirm only the user-authorized operation; no manual UI step is required.'};
export const purchaseArrivalTools:ToolModule={area:'purchase arrivals',defs:[
  {name:'list_purchases',scope:'inventory:read',description:'Read purchases and incoming deliveries from the same tracking view as the app, including linked invoice source, arrival history, quantities and attention reasons. Partial delivery is normal and stays Coming. Use intake_start/add_source/analyze/update_item/finalize to import an invoice; do not create a second purchase for that invoice.',inputSchema:{type:'object',properties:{}}},
  {name:'get_purchase',scope:'inventory:read',description:'Read one purchase or delivery before recording arrivals, including receipt line IDs, units, received and remaining quantities. Never infer all goods arrived from invoice existence.',inputSchema:{type:'object',properties:{id:{type:'string',description:'Purchase ID or receipt ID'}},required:['id']}},
  {name:'record_arrival',scope:'stock:write',description:'Record confirmed physical arrivals for a delivery, partial or complete. Provide explicit quantities for each receipt line from get_purchase, not cumulative received totals. If the user explicitly says everything arrived, use the current remaining quantities; ask about unclear amounts. Preview/confirm updates stock, ledger, receipt and purchase together per line. Bulk results identify partial success; retry identical key and quantities after failure. A purchase invoice alone never authorizes receiving.',inputSchema:{type:'object',properties:{receipt_id:{type:'string'},idempotency_key:{type:'string'},lines:{type:'array',items:{type:'object',properties:{line_id:{type:'string'},quantity:{type:'number',exclusiveMinimum:0}},required:['line_id','quantity']}},note:{type:'string'},confirm}}},
  {name:'cancel_delivery_remainder',scope:'stock:write',description:'Preview/confirm cancellation of the outstanding quantity of one receipt line, only when the user says it will not arrive. Preserves received stock and the arrival ledger.',inputSchema:{type:'object',properties:{line_id:{type:'string'},confirm}}},
  {name:'update_delivery_tracking',scope:'stock:write',description:'Preview/confirm expected arrival date, transport or tracking number on the linked delivery/purchase. Does not change stock or mark anything received. Null clears a field.',inputSchema:{type:'object',properties:{receipt_id:{type:'string'},eta:{type:['string','null']},transport_mode:{type:['string','null'],enum:['air','sea','land','courier',null]},tracking_number:{type:['string','null']},confirm}}},
],handlers:{list_purchases:(env,auth)=>readPurchaseTracking(env,auth.accountId),get_purchase:async(env,auth,args)=>{const id=typeof args.id==='string'?args.id.trim():'';if(!id)return {error:'purchase_id_required'};const result=await readPurchaseTracking(env,auth.accountId,id);return result.rows.length?result:{error:'purchase_not_found'};},record_arrival:recordArrival,cancel_delivery_remainder:cancelRemaining,update_delivery_tracking:updateTracking}};
