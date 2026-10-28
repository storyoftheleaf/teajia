import { effectiveInventoryPurpose } from './inventoryDomain';

type Context = { accountId: string; userId: string };
type Environment = { DB: D1Database };
export async function preparePurchaseReceipt(env: Environment, ctx: Context, id: string, replacement?: unknown[]) {
  const order = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;
  if (!order) return { status:404, value:{error:'Purchase order not found'} };
  if (order.receipt_id) return { status:200, value:{receipt_id:order.receipt_id,unresolved_items:[],already_prepared:true} };
  let items: any[];
  try { items = replacement ?? JSON.parse(order.items_json); if (!Array.isArray(items) || !items.length) throw new Error(); }
  catch { return { status:400, value:{error:'Purchase lines are required'} }; }
  let legacyReceivedIntake=false;
  try { const original=JSON.parse(order.items_json);legacyReceivedIntake=String(order.create_request_key??'').startsWith('intake:')&&order.status==='pending'&&Array.isArray(original)&&original.some((line:any)=>!line.product_id); } catch {}
  const unresolved: any[]=[]; const valid: any[]=[];
  for (const [index,item] of items.entries()) {
    const quantity=Number(item.quantity ?? item.quantity_grams);
    const product=item.product_id ? await env.DB.prepare('SELECT * FROM products WHERE id=? AND account_id=?').bind(item.product_id,ctx.accountId).first() as any : null;
    const unit=item.unit ?? (item.quantity_grams != null ? 'g' : null);
    if (!product || !Number.isFinite(quantity) || quantity<=0 || unit!==(product.type==='Teaware'?'unit':'g') || (unit==='unit'&&!Number.isInteger(quantity))) { unresolved.push({index,item,reason:'Match this line to a holding and confirm its quantity and unit'});continue; }
    if(legacyReceivedIntake&&!item.source_movement_id){unresolved.push({index,item,reason:'This legacy intake already recorded stock. Link its original received-stock movement before continuing; do not receive it again.'});continue;}
    let received=0;
    if (item.source_movement_id) {
      const movement=await env.DB.prepare('SELECT * FROM stock_ledger WHERE id=? AND account_id=? AND product_id=?').bind(item.source_movement_id,ctx.accountId,product.id).first() as any;
      if (!movement || Number(movement.delta)!==quantity || !['RECEIPT','PURCHASE_RECEIPT'].includes(String(movement.reason).toUpperCase())) { unresolved.push({index,item,reason:'The received-stock reference does not match this line'});continue; }
      received=quantity;
    }
    valid.push({item,product,quantity,unit,received});
  }
  if (unresolved.length) return {status:200,value:{receipt_id:null,unresolved_items:unresolved,already_prepared:false}};
  const receiptId=`po_${id}`;const complete=valid.every(line=>line.received===line.quantity);
  const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO inventory_receipts(id,account_id,state,vendor_name,source_kind,source_ref,created_by_user_id,idempotency_key,request_fingerprint) VALUES(?,?,?,?,?,?,?,?,?)`).bind(receiptId,ctx.accountId,complete?'received':valid.some(line=>line.received>0)?'partially_received':'ordered',order.vendor_name,'purchase_order',id,ctx.userId,`purchase:${id}`,JSON.stringify(items))];
  for (const [index,line] of valid.entries()) statements.push(env.DB.prepare(`INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,received_quantity,unit,intended_purpose,source_kind,source_ref,original_cost_amount,original_cost_currency,original_unit_cost,source_movement_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${receiptId}_${index}`,receiptId,ctx.accountId,line.product.id,line.quantity,line.received,line.unit,effectiveInventoryPurpose(line.product).purpose,'purchase_order',id,line.item.total_cost??null,line.item.currency??null,line.item.unit_price??null,line.item.source_movement_id??null));
  statements.push(env.DB.prepare("UPDATE purchase_orders SET receipt_id=?,items_json=?,status=?,updated_at=datetime('now') WHERE id=? AND account_id=? AND receipt_id IS NULL").bind(receiptId,JSON.stringify(items),complete?'received':'ordered',id,ctx.accountId));
  try { await env.DB.batch(statements); }
  catch (error) { const raced=await env.DB.prepare('SELECT receipt_id FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;if(raced?.receipt_id)return {status:200,value:{receipt_id:raced.receipt_id,unresolved_items:[],already_prepared:true}};throw error; }
  return {status:200,value:{receipt_id:receiptId,unresolved_items:[],already_prepared:false}};
}

export async function updatePurchaseReceiptStatus(env:Environment, accountId:string,receiptId:string) {
 await env.DB.prepare(`UPDATE purchase_orders SET status=CASE (SELECT state FROM inventory_receipts WHERE id=? AND account_id=?) WHEN 'received' THEN 'received' WHEN 'cancelled' THEN 'cancelled' ELSE 'ordered' END,updated_at=datetime('now') WHERE receipt_id=? AND account_id=?`).bind(receiptId,accountId,receiptId,accountId).run();
}
