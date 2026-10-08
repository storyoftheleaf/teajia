import { tastingForShop, tastingHasTerms } from './curateImportTasting';
import { compassVendorId } from './curateReceiptProduct';
import { canonicalizeCostCurrency } from './costCurrency';
import { nameProductColumns } from './productDefaults';
import { prepareCurateRecordedWrite, type CurateGuard } from './curateMutations';
import type { ToolAuth } from './mcpTools/registry';

type Row = Record<string, any>;
export class CompassPromotionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function loadPromotableCompassEntry(db: D1Database, scope: {accountId:string;userId:string}, id:string, manager:boolean):Promise<Row> {
  const entry = await db.prepare('SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ? AND (user_id = ? OR ? = 1) AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL')
    .bind(id, scope.accountId, scope.userId, manager ? 1 : 0).first<Row>();
  if (!entry) throw new CompassPromotionError('Compass entry not found', 404);
  return entry;
}
/** An unchanged snapshot guards every column, including legacy rows with no updated_at. */
export function promotionRowGuard(table:'tea_compass_entries'|'customers'|'products', row:Row):CurateGuard {
  const keys=Object.keys(row).sort();
  return {sql:`EXISTS(SELECT 1 FROM ${table} snap WHERE snap.id = ? AND snap.account_id = ? AND NOT EXISTS(SELECT 1 FROM json_each(?) expected WHERE CASE expected.key ${keys.map(k=>`WHEN '${k}' THEN snap."${k}"`).join(' ')} END IS NOT expected.value))`,values:[row.id,row.account_id,JSON.stringify(row)]};
}
export function promotionCapture(entry:Row):{name:string;photos:string[]} {
  let photos: string[] = [];
  try { photos = entry.photos ? JSON.parse(entry.photos) : []; } catch { photos = []; }

  // Photo + vendor is a complete capture; the name can come later. Auto-name
  // from vendor + capture date so the record can enter the library unnamed.
  let name = (entry.name as string | null)?.trim();
  if (!name) {
    const vendor = (entry.vendor_name as string | null)?.trim();
    if (!vendor && photos.length === 0) {
      throw new CompassPromotionError('Cannot promote: entry needs a name, or a photo + vendor', 400);
    }
    const captured = new Date((entry.created_at as string) || Date.now());
    const dateLabel = isNaN(captured.getTime())
      ? ''
      : captured.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    name = [vendor, dateLabel].filter(Boolean).join(' · ') || 'Unnamed tea';
  }
  return {name,photos};
}
export interface PromotionApproval { auth:ToolAuth; guards:CurateGuard[]; agent:string; key:string }
/** One encounter identity shared by app promotion, agent promotion and receipts. */
export async function promoteCompassEntry(db:D1Database, accountId:string, entry:Row, approval?:PromotionApproval) {
  if (!approval && entry.draft_product_id) {
    const existing = await db.prepare(
      'SELECT * FROM products WHERE id = ? AND account_id = ?'
    ).bind(entry.draft_product_id, accountId).first();
    if (existing) return { id: entry.draft_product_id, product: existing, alreadyPromoted: true, status: 200 };
    // Stale link — fall through and create a new product, then re-link.
  }

  // Compatibility repair and concurrency fast-path: an older/parallel write
  // may have created the product before the Compass link became visible.
  const identityProduct = await db.prepare(
    'SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?'
  ).bind(accountId, entry.id).first() as Record<string, any> | null;
  if (!approval && identityProduct) {
    await db.prepare(
      "UPDATE tea_compass_entries SET draft_product_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(identityProduct.id, entry.id, accountId).run();
    return { id: identityProduct.id, product: identityProduct, alreadyPromoted: true, status: 200 };
  }

  const isTeaware = entry.category === 'teaware';

  const {name,photos}=promotionCapture(entry);
  // Only words the shop can print reach the product, and the page drops its
  // "potential profile" note only when there are such words: a score or a note
  // alone is not the shop's tasting.
  const shopTasting = tastingForShop(entry.tasting);
  const tasting = Object.keys(shopTasting).length ? JSON.stringify(shopTasting) : null;

  const productType = isTeaware ? 'Teaware' : (entry.type || 'Misc');
  // Captured buying quantity is intent/evidence, not received stock. Only a
  // reviewed receipt or stock movement may add a positive physical balance.
  const stockGrams = 0;
  const quantityUnits = isTeaware ? 0 : null;

  let vendorId: string | null;
  try { vendorId = await compassVendorId(db, accountId, entry); }
  catch (error) { throw new CompassPromotionError((error as Error).message, 400); }

  const productId = crypto.randomUUID();
  const cols: Record<string, any> = {
    id: productId,
    account_id: accountId,
    type: productType,
    form: entry.form ?? null,
    given_name: name,
    chinese_name: entry.chinese_name ?? null,
    product_name: name,
    year: entry.year != null ? String(entry.year) : null,
    origin_region: entry.origin_region ?? null,
    description: null,
    image_url: photos[0] ?? null,
    additional_images: JSON.stringify(photos.slice(1)),
    // The bag shot from capture keeps its own slot so later product photo
    // edits never lose it. Replaceable deliberately, never displaced.
    bag_photo_url: photos[0] ?? null,
    status: 'Draft',
    // Inventory creation and storefront publication are independent choices.
    // Schema defaults predate that boundary, so private must be explicit.
    is_public: 0,
    shown_in_shop: 0,
    vendor: entry.vendor_name ?? null,
    vendor_id: vendorId,
    stock_grams: stockGrams,
    stock_known_at: new Date().toISOString(),
    // A vendor quote is a unit price, not a paid batch cost. Acceptance of a
    // reviewed order arrival supplies both its line total and bought quantity.
    cost_amount: null,
    cost_currency: null,
    quantity_purchased: null,
    quantity_units: quantityUnits,
    material: entry.material ?? null,
    capacity_ml: entry.capacity_ml ?? null,
    teaware_category: entry.teaware_category ?? null,
    tasting: tasting ?? '{}',
    tasting_source: tastingHasTerms(shopTasting) ? 'owner' : null,
    tea_key: entry.tea_key ?? null,
    source_compass_entry_id: entry.id,
  };
  // The same canonicalisation every other write door runs, so a compass entry
  // carrying 'cny' or 'hkd' promotes to the shop's own spelling instead of a
  // currency the exchange table has no row for. No-op when the entry's
  // currency was never stated, which is what leaves cost_currency NULL above.
  canonicalizeCostCurrency(cols);

  /* A compass entry records what Adrian saw, not what it cost to bring here. It
     carries no freight rate and no markup, so both are NULL and the tea follows
     the shop on each. Omitted they would have been 0 and 2.5. */
  nameProductColumns(cols);
  const colNames = Object.keys(cols);
  const placeholders = colNames.map(() => '?').join(', ');
  // The unique encounter identity plus one D1 batch makes promotion atomic:
  // a racing loser inserts nothing and both link to the canonical product.
  if (approval) {
    const linked = entry.draft_product_id ? await db.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(entry.draft_product_id,accountId).first<Row>() : null;
    const selected = linked ?? identityProduct;
    const id = selected?.id ?? productId;
    const write=prepareCurateRecordedWrite(db, approval.auth, {commandType:'tea:promote',agent:approval.agent,idempotencyKey:approval.key,guards:approval.guards.map(guard=>({...guard,confirmationOnly:true})),
      changes:[{entityType:'tea',entityId:entry.id,before:entry,after:{...entry,draft_product_id:id,updated_at:new Date().toISOString()}}]});
    const insert = selected ? [] : [db.prepare(`INSERT OR IGNORE INTO products (${colNames.join(', ')}) SELECT ${placeholders} WHERE EXISTS(SELECT 1 FROM curate_mutations WHERE id = ? AND account_id = ?)`)
      .bind(...colNames.map(c=>cols[c]),write.mutationId,accountId)];
    const productColumns=(await db.prepare('PRAGMA table_info(products)').all<{name:string}>()).results.map(column=>column.name);
    // Capture defaults too, inside the creation transaction. A later edit to
    // any product column must stop undo, including fields promotion never set.
    const snapshot=`(SELECT json_group_object(k,v) FROM (${productColumns.map(column=>`SELECT '${column}' AS k,p."${column}" AS v`).join(' UNION ALL ')}))`;
    const record=selected?[]:[db.prepare(`INSERT INTO curate_mutation_records(mutation_id,account_id,entity_type,entity_id,before_json,after_json)
      SELECT ?,?,'promotion_product',p.id,'null',${snapshot} FROM products p WHERE p.id=? AND p.account_id=? AND EXISTS(SELECT 1 FROM curate_mutations WHERE id=?)`)
      .bind(write.mutationId,accountId,id,accountId,write.mutationId)];
    try { await db.batch([write.statements[0],...insert,...write.statements.slice(1),...record,write.assertion]); }
    catch(error) {
      if(String(error).includes('malformed JSON')) throw new CompassPromotionError('stale_preview',409);
      throw error;
    }
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(id,accountId).first<Row>();
    if (!product) throw new CompassPromotionError('Inventory record could not be created',500);
    return {id,product,alreadyPromoted:!!selected,status:selected?200:201,mutation_id:write.mutationId};
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO products (${colNames.join(', ')}) VALUES (${placeholders})`).bind(...colNames.map(c=>cols[c])),
    db.prepare(`UPDATE tea_compass_entries SET draft_product_id = (SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND account_id = ?`)
      .bind(accountId,entry.id,entry.id,entry.user_id,accountId),
  ]);

  const canonical = await db.prepare(
    'SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?'
  ).bind(accountId, entry.id).first() as Record<string, any> | null;
  if (!canonical) throw new CompassPromotionError('Inventory record could not be created', 500);

  const created = await db.prepare(
    'SELECT * FROM products WHERE id = ? AND account_id = ?'
  ).bind(canonical.id, accountId).first();
  return {id:canonical.id, product:created, alreadyPromoted:canonical.id !== productId, status:canonical.id === productId ? 201 : 200};
}
