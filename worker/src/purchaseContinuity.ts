import { effectiveInventoryPurpose, inventoryPurposeConflict } from './inventoryDomain';
import { compassHolding, isCompassSample } from './compassHoldings';
import { capturedHoldingFields } from './capturedHolding';
import { nameProductColumns } from './productDefaults';
import { canonicalizeCostCurrency, stampCostCurrencySource } from './costCurrency';
import { canonicalCurrency, rateToUsd } from '../../src/lib/currency';

type Context = { accountId: string; userId: string };
type Environment = { DB: D1Database };
type Row = Record<string, any>;
type Placement = { canManageCurate: boolean; status: string };
export const PLACED_PURCHASE_STATUSES = new Set(['ordered', 'confirmed', 'sent', 'shipped']);

function finiteAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

async function planHolding(
  db: D1Database, ctx: Context, order: Row, item: Row, index: number, unit: string | null, quantity: number, placement: Placement,
): Promise<{product: Row; statements: D1PreparedStatement[]} | {reason: string}> {
  const entry = item.compass_entry_id ? await db.prepare(
    `SELECT * FROM tea_compass_entries
     WHERE id = ? AND account_id = ? AND (user_id = ? OR ?)
       AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL`,
  ).bind(item.compass_entry_id, ctx.accountId, ctx.userId, placement.canManageCurate ? 1 : 0).first<Row>() : null;
  if (item.compass_entry_id && !entry) return {reason: 'Choose a Curate tea you can access in this shop'};
  const linked = item.product_id ?? entry?.draft_product_id ?? null;
  const found = linked ? await db.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?')
    .bind(linked, ctx.accountId).first<Row>() : null;
  if (linked && !found) return {reason: 'The linked Stock item was not found in this shop'};
  const source = entry ? await compassHolding(db, ctx.accountId, entry.id) : null;
  const sampleOnly = entry && isCompassSample(source, entry.id);
  const foundSample = entry && isCompassSample(found, entry.id);
  const sourceProduct = sampleOnly ? null : source;
  const selected = foundSample ? null : found;
  const existing = selected ?? sourceProduct;
  const otherEntry = entry && existing ? await db.prepare(
    'SELECT id FROM tea_compass_entries WHERE account_id = ? AND draft_product_id = ? AND id <> ? AND deleted_at IS NULL AND merged_into_id IS NULL',
  ).bind(ctx.accountId, existing.id, entry.id).first() : null;
  if ((entry && (otherEntry || (selected && sourceProduct && selected.id !== sourceProduct.id)
      || (entry.draft_product_id && !foundSample && found?.id !== entry.draft_product_id)
      || (selected?.source_compass_entry_id && selected.source_compass_entry_id !== entry.id)))
      || inventoryPurposeConflict(existing, 'working')) {
    return {reason: 'This order line conflicts with the tea’s linked Stock item'};
  }
  const isTeaware = existing ? existing.type === 'Teaware'
    : entry ? (entry.category === 'teaware' || entry.type === 'Teaware') : item.type === 'Teaware' || unit === 'unit';
  if (!Number.isFinite(quantity) || quantity <= 0 || unit !== (isTeaware ? 'unit' : 'g') || (unit === 'unit' && !Number.isInteger(quantity))) {
    return {reason: 'Confirm the ordered quantity and its Stock unit'};
  }

  const name = [entry?.name, item.product_name, item.name].find(value => typeof value === 'string' && value.trim())?.trim();
  if (!existing && !name) return {reason: 'Name this line before creating its Stock draft'};

  const accountVendorId = typeof order.vendor_id === 'string' && await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?')
    .bind(order.vendor_id, ctx.accountId).first() ? order.vendor_id : null;
  const workingId = entry ? `holding_${ctx.accountId}_${entry.id}` : `po_holding_${order.id}_${index}`;
  // A previously converted holding may already occupy the original deterministic ID.
  const productId = existing?.id ?? (sampleOnly && source?.id === workingId ? `${workingId}_working` : workingId);
  const statements: D1PreparedStatement[] = [];
  const values: Row = existing ?? nameProductColumns({
    ...(entry ? capturedHoldingFields(entry) : {}),
    id: productId, account_id: ctx.accountId, owner_user_id: ctx.userId,
    product_name: name, given_name: entry?.given_name ?? null,
    type: isTeaware ? 'Teaware' : (entry?.type ?? (typeof item.type === 'string' && item.type.trim() ? item.type : 'Misc')),
    status: 'Draft', stock_grams: unit === 'g' ? 0 : null, quantity_units: unit === 'unit' ? 0 : null,
    inventory_purpose: 'working', is_sample: 0, is_personal: 0, is_public: 0, shown_in_shop: 0,
    stock_known_at: null, source_compass_entry_id: entry?.id ?? null,
    vendor: order.vendor_name, vendor_id: accountVendorId,
    // Placing an order records the quote on its receipt line. Stock and any
    // physical acquisition basis belong to the later received quantity.
    cost_amount: null, cost_currency: null, quantity_purchased: null,
  });
  if (!existing) {
    canonicalizeCostCurrency(values);
    stampCostCurrencySource(values);
    const columns = Object.keys(values);
    statements.push(db.prepare(`INSERT INTO products (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .bind(...columns.map(column => values[column])));
  }
  if (entry && entry.draft_product_id !== productId) statements.push(db.prepare(
    "UPDATE tea_compass_entries SET draft_product_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND draft_product_id IS ?",
  ).bind(productId, entry.id, ctx.accountId, entry.draft_product_id ?? null));
  return {product: values, statements};
}

function receiptLines(value: unknown) {
  try {
    const items = JSON.parse(String(value)) as Row[];
    return items.map(item => ({
      product_id: item.product_id, compass_entry_id: item.compass_entry_id ?? null, client_line_id: item.client_line_id ?? null,
      receipt_line_id: item.receipt_line_id ?? null,
      quantity: item.quantity, unit: item.unit,
    }));
  } catch { return []; }
}

export async function placePurchaseReceipt(env: Environment, ctx: Context, id: string, status: string, canManageCurate: boolean) {
  return preparePurchaseReceipt(env, ctx, id, undefined, {status, canManageCurate});
}

export async function preparePurchaseReceipt(env: Environment, ctx: Context, id: string, replacement?: unknown[], placement?: Placement) {
  const order = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;
  if (!order) return { status:404, value:{error:'Purchase order not found'} };
  if (order.receipt_id) return { status:200, value:{receipt_id:order.receipt_id,unresolved_items:[],already_prepared:true,lines:receiptLines(order.items_json)} };
  if (order.status==='cancelled') return {status:409,value:{error:'Cancelled purchases cannot create an expected delivery'}};
  let items: any[];
  try { items = replacement ?? JSON.parse(order.items_json); if (!Array.isArray(items) || !items.length) throw new Error(); }
  catch { return { status:400, value:{error:'Purchase lines are required'} }; }
  let legacyReceivedIntake=false;
  try { const original=JSON.parse(order.items_json);legacyReceivedIntake=String(order.create_request_key??'').startsWith('intake:')&&order.status==='pending'&&Array.isArray(original)&&original.some((line:any)=>!line.product_id); } catch {}
  const unresolved: any[]=[]; const valid: any[]=[];
  const usedMovements = new Set<string>();
  const usedEntryIds = new Set<string>();
  const draftStatements: D1PreparedStatement[] = [];
  for (const [index,originalItem] of items.entries()) {
    const item = {...originalItem};
    const legacyKey = String(order.create_request_key ?? '').startsWith('ledger:')
      ? `${order.create_request_key}:${item.compass_entry_id}` : null;
    const proposal = item.compass_entry_id ? await env.DB.prepare(
      `SELECT * FROM curate_receipt_proposals WHERE account_id = ? AND idempotency_key IN (?, ?)
       ORDER BY CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END LIMIT 1`,
    ).bind(ctx.accountId, `order:${id}:${item.compass_entry_id}`, legacyKey).first<Row>() : null;
    if (placement && item.compass_entry_id && !item.source_movement_id) {
      if (proposal?.status === 'pending') { unresolved.push({index, item, code:'existing_arrival', reason:'An existing arrival already covers this tea. Review that arrival first.'}); continue; }
      if (usedEntryIds.has(item.compass_entry_id)) { unresolved.push({index, item, reason:'Combine repeated order lines for the same Curate tea'}); continue; }
      usedEntryIds.add(item.compass_entry_id);
    }
    const receivedSample = proposal?.purpose === 'sample' && proposal.acquisition_kind === 'free_sample';
    if (proposal?.status === 'accepted' && !receivedSample) {
      if (item.product_id && item.product_id !== proposal.product_id) { unresolved.push({index,item,reason:'The original arrival belongs to a different holding'}); continue; }
      item.product_id = proposal.product_id;
      item.source_movement_id = proposal.ledger_id;
      if (!item.source_movement_id) { unresolved.push({index,item,reason:'The original arrival has no stock movement to link'}); continue; }
    }
    const unit = item.unit ?? (item.quantity_grams != null ? 'g' : null);
    const rawQuantity = unit === 'g' && item.quantity_grams != null ? item.quantity_grams : item.quantity;
    const quantity = Number(rawQuantity);
    let product: Row | null;
    if (placement && !legacyReceivedIntake && !item.source_movement_id) {
      const plan = await planHolding(env.DB, ctx, order, item, index, unit, quantity, placement);
      if ('reason' in plan) { unresolved.push({index, item, reason:plan.reason}); continue; }
      product = plan.product;
      draftStatements.push(...plan.statements);
    } else {
      product = item.product_id ? await env.DB.prepare('SELECT * FROM products WHERE id=? AND account_id=?')
        .bind(item.product_id,ctx.accountId).first<Row>() : null;
    }
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
  if (unresolved.length) return {status:200,value:{
    receipt_id:null, unresolved_items:unresolved, already_prepared:false,
    existing_arrival_only:valid.length === 0 && unresolved.every(line => line.code === 'existing_arrival'),
  }};
  const receiptId=`po_${id}`;const complete=valid.every(line=>line.received===line.quantity);
  const statements:D1PreparedStatement[]=[...draftStatements,env.DB.prepare(`INSERT INTO inventory_receipts(id,account_id,state,vendor_name,source_kind,source_ref,created_by_user_id,idempotency_key,request_fingerprint,transport_mode) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(receiptId,ctx.accountId,complete?'received':valid.some(line=>line.received>0)?'partially_received':'ordered',order.vendor_name,'purchase_order',id,ctx.userId,`purchase:${id}`,JSON.stringify(items),order.ship_mode??null)];
  for (const [index,line] of valid.entries()) {
    line.item.receipt_line_id = `${receiptId}_${index}`;
    const statedTotal = finiteAmount(line.item.total_cost ?? line.item.line_total);
    const currency = canonicalCurrency(typeof line.item.currency === 'string' ? line.item.currency : null);
    const total = statedTotal === 0 || (currency && currency !== 'UNK') ? statedTotal : null;
    statements.push(env.DB.prepare(`INSERT INTO inventory_receipt_lines(id,receipt_id,account_id,product_id,expected_quantity,received_quantity,unit,intended_purpose,source_kind,source_ref,original_cost_amount,original_cost_currency,original_unit_cost,source_movement_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      `${receiptId}_${index}`,receiptId,ctx.accountId,line.product.id,line.quantity,line.received,line.unit,effectiveInventoryPurpose(line.product).purpose,
      'purchase_order',id,total,currency === 'UNK' ? null : currency,
      finiteAmount(line.item.unit_price) ?? (placement && total != null ? total / line.quantity : null),line.item.source_movement_id??null));
  }
  statements.push(env.DB.prepare("UPDATE purchase_orders SET receipt_id=?,items_json=?,status=?,updated_at=datetime('now') WHERE id=? AND account_id=? AND receipt_id IS NULL").bind(receiptId,JSON.stringify(valid.map(line=>line.item)),complete?'received':placement?.status??'ordered',id,ctx.accountId));
  try { await env.DB.batch(statements); }
  catch (error) { const raced=await env.DB.prepare('SELECT receipt_id, items_json FROM purchase_orders WHERE id=? AND account_id=?').bind(id,ctx.accountId).first() as any;if(raced?.receipt_id)return {status:200,value:{receipt_id:raced.receipt_id,unresolved_items:[],already_prepared:true,lines:receiptLines(raced.items_json)}};throw error; }
  return {status:200,value:{receipt_id:receiptId,unresolved_items:[],already_prepared:false,lines:receiptLines(JSON.stringify(valid.map(line => line.item)))}};
}

export async function updatePurchaseReceiptStatus(env:Environment, accountId:string,receiptId:string) {
 await env.DB.prepare(`UPDATE purchase_orders SET status=CASE (SELECT state FROM inventory_receipts WHERE id=? AND account_id=?) WHEN 'received' THEN 'received' WHEN 'cancelled' THEN 'cancelled' ELSE CASE WHEN status IN ('sent','shipped') THEN status ELSE 'ordered' END END,updated_at=datetime('now') WHERE receipt_id=? AND account_id=?`).bind(receiptId,accountId,receiptId,accountId).run();
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
