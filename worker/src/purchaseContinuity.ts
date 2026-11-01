import { effectiveInventoryPurpose } from './inventoryDomain';
import { canonicalCurrency, rateToUsd } from '../../src/lib/currency';

type Context = { accountId: string; userId: string };
type Environment = { DB: D1Database };
export async function preparePurchaseReceipt(env: Environment, ctx: Context, id: string, replacement?: unknown[]) {
  const order = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;
  if (!order) return { status:404, value:{error:'Purchase order not found'} };
  if (order.receipt_id) return { status:200, value:{receipt_id:order.receipt_id,unresolved_items:[],already_prepared:true} };
  if (order.status==='cancelled') return {status:409,value:{error:'Cancelled purchases cannot create an expected delivery'}};
  let items: any[];
  try { items = replacement ?? JSON.parse(order.items_json); if (!Array.isArray(items) || !items.length) throw new Error(); }
  catch { return { status:400, value:{error:'Purchase lines are required'} }; }
  let legacyReceivedIntake=false;
  try { const original=JSON.parse(order.items_json);legacyReceivedIntake=String(order.create_request_key??'').startsWith('intake:')&&order.status==='pending'&&Array.isArray(original)&&original.some((line:any)=>!line.product_id); } catch {}
  const unresolved: any[]=[]; const valid: any[]=[];
  const usedMovements = new Set<string>();
  for (const [index,originalItem] of items.entries()) {
    const item = {...originalItem};
    const proposal = item.compass_entry_id ? await env.DB.prepare('SELECT * FROM curate_receipt_proposals WHERE account_id=? AND idempotency_key=?')
      .bind(ctx.accountId,`order:${id}:${item.compass_entry_id}`).first<Record<string, any>>() : null;
    if (proposal?.status === 'accepted') {
      if (item.product_id && item.product_id !== proposal.product_id) { unresolved.push({index,item,reason:'The original arrival belongs to a different holding'}); continue; }
      item.product_id = proposal.product_id;
      item.source_movement_id = proposal.ledger_id;
      if (!item.source_movement_id) { unresolved.push({index,item,reason:'The original arrival has no stock movement to link'}); continue; }
    }
    const rawQuantity = typeof item.quantity==='string' && !Number.isFinite(Number(item.quantity)) ? item.quantity_grams : item.quantity ?? item.quantity_grams;
    const quantity=Number(rawQuantity);
    const product=item.product_id ? await env.DB.prepare('SELECT * FROM products WHERE id=? AND account_id=?').bind(item.product_id,ctx.accountId).first() as any : null;
    const unit=item.unit ?? (item.quantity_grams != null ? 'g' : null);
    if (!product || !Number.isFinite(quantity) || quantity<=0 || unit!==(product.type==='Teaware'?'unit':'g') || (unit==='unit'&&!Number.isInteger(quantity))) { unresolved.push({index,item,reason:'Match this line to a holding and confirm its quantity and unit'});continue; }
    if(legacyReceivedIntake&&!item.source_movement_id){unresolved.push({index,item,reason:'This legacy intake already recorded stock. Link its original received-stock movement before continuing; do not receive it again.'});continue;}
    let received=0;
    if (item.source_movement_id) {
      const movement=await env.DB.prepare('SELECT * FROM stock_ledger WHERE id=? AND account_id=? AND product_id=?').bind(item.source_movement_id,ctx.accountId,product.id).first() as any;
      if (!movement || Number(movement.delta)!==quantity || (movement.movement_unit && movement.movement_unit!==(unit==='g'?'gram':'unit')) || !['RECEIPT','PURCHASE_RECEIPT'].includes(String(movement.reason).toUpperCase())) { unresolved.push({index,item,reason:'The received-stock reference does not match this line'});continue; }
      const linked = await env.DB.prepare('SELECT id FROM inventory_receipt_lines WHERE account_id=? AND source_movement_id=?').bind(ctx.accountId,item.source_movement_id).first();
      if (movement.inventory_receipt_line_id || linked || usedMovements.has(item.source_movement_id)) { unresolved.push({index,item,reason:'This stock movement is already linked to another receipt line'}); continue; }
      usedMovements.add(item.source_movement_id);
      received=quantity;
    }
    valid.push({item:{...item,quantity,unit,product_id:product.id},product,quantity,unit,received});
  }
  if (unresolved.length) return {status:200,value:{receipt_id:null,unresolved_items:unresolved,already_prepared:false}};
  const receiptId=`po_${id}`;const complete=valid.every(line=>line.received===line.quantity);
  const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO inventory_receipts(id,account_id,state,vendor_name,source_kind,source_ref,created_by_user_id,idempotency_key,request_fingerprint) VALUES(?,?,?,?,?,?,?,?,?)`).bind(receiptId,ctx.accountId,complete?'received':valid.some(line=>line.received>0)?'partially_received':'ordered',order.vendor_name,'purchase_order',id,ctx.userId,`purchase:${id}`,JSON.stringify(items))];
  for (const [index,line] of valid.entries()) statements.push(env.DB.prepare(`INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,received_quantity,unit,intended_purpose,source_kind,source_ref,original_cost_amount,original_cost_currency,original_unit_cost,source_movement_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${receiptId}_${index}`,receiptId,ctx.accountId,line.product.id,line.quantity,line.received,line.unit,effectiveInventoryPurpose(line.product).purpose,'purchase_order',id,line.item.total_cost??line.item.line_total??null,line.item.currency??null,typeof line.item.unit_price==='number'?line.item.unit_price:null,line.item.source_movement_id??null));
  statements.push(env.DB.prepare("UPDATE purchase_orders SET receipt_id=?,items_json=?,status=?,updated_at=datetime('now') WHERE id=? AND account_id=? AND receipt_id IS NULL").bind(receiptId,JSON.stringify(valid.map(line=>line.item)),complete?'received':'ordered',id,ctx.accountId));
  try { await env.DB.batch(statements); }
  catch (error) { const raced=await env.DB.prepare('SELECT receipt_id FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;if(raced?.receipt_id)return {status:200,value:{receipt_id:raced.receipt_id,unresolved_items:[],already_prepared:true}};throw error; }
  return {status:200,value:{receipt_id:receiptId,unresolved_items:[],already_prepared:false}};
}

export async function updatePurchaseReceiptStatus(env:Environment, accountId:string,receiptId:string) {
 await env.DB.prepare(`UPDATE purchase_orders SET status=CASE (SELECT state FROM inventory_receipts WHERE id=? AND account_id=?) WHEN 'received' THEN 'received' WHEN 'cancelled' THEN 'cancelled' ELSE 'ordered' END,updated_at=datetime('now') WHERE receipt_id=? AND account_id=?`).bind(receiptId,accountId,receiptId,accountId).run();
}

/** An invoice vendor group and its expected receipt are one purchase. This is
 * resumable after receipt creation: no stock is moved, and the receipt identity
 * is the replay key rather than a guessed vendor/date/amount match. */
export async function linkImportReceiptPurchase(env: Environment, ctx: Context, input: {
  receiptId: string; importId: string; groupId: string; vendorId: string | null;
}) {
  const receipt = await env.DB.prepare('SELECT * FROM inventory_receipts WHERE id=? AND account_id=?')
    .bind(input.receiptId, ctx.accountId).first<Record<string, any>>();
  if (!receipt) throw new Error('Import receipt not found in this account');
  if (input.vendorId && !await env.DB.prepare('SELECT id FROM customers WHERE id=? AND account_id=?').bind(input.vendorId, ctx.accountId).first()) {
    throw new Error('Import vendor not found in this account');
  }
  const existing = await env.DB.prepare('SELECT id FROM purchase_orders WHERE receipt_id=? AND account_id=?').bind(input.receiptId, ctx.accountId).first<{id:string}>();
  if (existing) return existing.id;
  const rows = await env.DB.prepare(`SELECT l.*, p.product_name FROM inventory_receipt_lines l
    JOIN products p ON p.id=l.product_id AND p.account_id=l.account_id
    WHERE l.receipt_id=? AND l.account_id=? ORDER BY l.id`).bind(input.receiptId, ctx.accountId).all<Record<string, any>>();
  if (!rows.results.length) throw new Error('Import receipt has no matched lines');
  const rates = await env.DB.prepare('SELECT currency,rate_to_usd FROM exchange_rates').all<{currency:string;rate_to_usd:number}>();
  let totalUsd: number | null = 0;
  const currencies = new Set<string>();
  const items = rows.results.map(line => {
    const currency = canonicalCurrency(line.original_cost_currency);
    if (currency) currencies.add(currency);
    const rate = currency === 'USD' ? 1 : rateToUsd(rates.results.map(row=>({currency:row.currency,rateToUSD:row.rate_to_usd})), currency);
    const cost = line.original_cost_amount == null ? null : Number(line.original_cost_amount);
    if (cost == null || !Number.isFinite(cost) || cost < 0 || !rate) totalUsd = null;
    else if (totalUsd != null) totalUsd += cost / rate;
    return {product_id:line.product_id, product_name:line.product_name, quantity:Number(line.expected_quantity), unit:line.unit,
      ...(line.unit==='g'?{quantity_grams:Number(line.expected_quantity)}:{}),
      total_cost:cost, line_total:cost, currency, unit_price:line.original_unit_cost,
      original_cost_amount_exact:line.original_cost_amount_exact, original_unit_cost_exact:line.original_unit_cost_exact,
      source_kind:'curate_import', source_ref:line.source_ref, receipt_line_id:line.id};
  });
  const id = `import_${input.receiptId}`;
  const requestKey = `curate-import:${input.importId}:${input.groupId}`;
  await env.DB.prepare(`INSERT OR IGNORE INTO purchase_orders
    (id,account_id,vendor_id,vendor_name,items_json,total_usd,display_currency,status,receipt_id,create_request_key,create_request_fingerprint,ship_mode,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).bind(id,ctx.accountId,input.vendorId,receipt.vendor_name,JSON.stringify(items),totalUsd,
      currencies.size===1?[...currencies][0]:'USD',receipt.state==='received'?'received':receipt.state==='cancelled'?'cancelled':'ordered',
      input.receiptId,requestKey,JSON.stringify({receipt_id:input.receiptId,import_id:input.importId,group_id:input.groupId}),
      ['air','sea'].includes(receipt.transport_mode)?receipt.transport_mode:null).run();
  const stored = await env.DB.prepare('SELECT id,receipt_id FROM purchase_orders WHERE account_id=? AND create_request_key=?')
    .bind(ctx.accountId,requestKey).first<{id:string;receipt_id:string}>();
  if (!stored || stored.receipt_id !== input.receiptId) throw new Error('Import purchase identity conflicts with an existing receipt');
  return stored.id;
}
