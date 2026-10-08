import { canonicalizeCostCurrency, stampCostCurrencySource } from './costCurrency';
import { refreshedCurrencyName } from './exchangeRateFeed';
import { tastingForShop, tastingHasTerms } from './curateImportTasting';
import { customerTagList } from './customerContactHandles';

type Row = Record<string, any>;

export async function compassVendorId(db: D1Database, accountId: string, entry: Row | null): Promise<string | null> {
  if (entry?.vendor_id) {
    const vendor = await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(entry.vendor_id, accountId).first();
    if (!vendor) throw new Error('Linked vendor not found in this account');
    return entry.vendor_id;
  }
  if (!entry?.vendor_name?.trim()) return null;
  const matches = await db.prepare('SELECT id, tags, type FROM customers WHERE account_id = ? AND lower(trim(name)) = lower(trim(?))')
    .bind(accountId, entry.vendor_name).all<Row>();
  const vendors = matches.results.filter(row => customerTagList(row.tags).includes('vendor') || row.type === 'vendor' || row.type === 'supplier');
  // A legacy name can resolve only to one already identified vendor. Promotion
  // must never turn a same-named customer into a supplier behind the operator.
  return vendors.length === 1 ? vendors[0].id : null;
}

/** A quoted unit price is not a paid batch cost. Only an exact order line can
 * supply the latter; free samples and unknown costs remain explicit. */
export async function receiptProductDetails(db: D1Database, accountId: string, proposal: Row): Promise<Row> {
  const entry = proposal.compass_entry_id
    ? await db.prepare('SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(proposal.compass_entry_id, accountId).first<Row>()
    : null;
  if (proposal.compass_entry_id && !entry) throw new Error('Linked Curate tea not found in this account');
  let vendorId = await compassVendorId(db, accountId, entry);
  let cost: number | null = proposal.acquisition_kind === 'free_sample' ? 0 : null;
  let currency: string | null = null;
  let purchased: number | null = null;
  const key = String(proposal.idempotency_key ?? '');
  if (key.startsWith('order:')) {
    const suffix = `:${proposal.compass_entry_id}`;
    if (!proposal.compass_entry_id || !key.endsWith(suffix)) throw new Error('Arrival does not match its order tea');
    const orderId = key.slice('order:'.length, -suffix.length);
    const order = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND account_id = ?').bind(orderId, accountId).first<Row>();
    if (!order) throw new Error('Arrival order not found in this account');
    let items: Row[];
    try { items = JSON.parse(order.items_json); } catch { throw new Error('Arrival order has invalid line items'); }
    if (!Array.isArray(items)) throw new Error('Arrival order has invalid line items');
    const lines = items.filter(line => line.compass_entry_id === proposal.compass_entry_id);
    if (lines.length !== 1) throw new Error('Arrival must match exactly one order line');
    const line = lines[0];
    if (proposal.unit !== 'g' || Number(line.quantity_grams) !== Number(proposal.quantity)) {
      throw new Error('Arrival quantity differs from the order; review the quantity and cost before accepting');
    }
    if (line.line_total == null || line.line_total === '' || !Number.isFinite(Number(line.line_total)) || Number(line.line_total) < 0) {
      throw new Error('Order line has no valid batch cost');
    }
    currency = refreshedCurrencyName(line.currency);
    if (!currency) throw new Error('Order line needs a stated supported currency');
    cost = Number(line.line_total);
    purchased = Number(proposal.quantity);
    if (order.vendor_id) {
      if (!await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(order.vendor_id, accountId).first()) throw new Error('Order vendor not found in this account');
      vendorId = order.vendor_id;
    }
  }
  let photos: string[] = [];
  try {
    const value = typeof entry?.photos === 'string' ? JSON.parse(entry.photos) : entry?.photos;
    if (Array.isArray(value)) photos = value.filter((photo): photo is string => typeof photo === 'string' && /^https:\/\//i.test(photo));
  } catch { /* Invalid legacy media is not propagated. */ }
  const tasting = tastingForShop(entry?.tasting);
  const details: Row = {
    chinese_name: entry?.chinese_name ?? null, form: entry?.form ?? null,
    year: entry?.year == null ? null : String(entry.year), origin_region: entry?.origin_region ?? null,
    vendor: entry?.vendor_name ?? null, vendor_id: vendorId,
    image_url: photos[0] ?? null, bag_photo_url: photos[0] ?? null, additional_images: JSON.stringify(photos.slice(1)),
    tasting: JSON.stringify(tasting), tasting_source: tastingHasTerms(tasting) ? 'owner' : null,
    tea_key: entry?.tea_key ?? null, material: entry?.material ?? null,
    capacity_ml: entry?.capacity_ml ?? null, teaware_category: entry?.teaware_category ?? null,
    cost_amount: cost, cost_currency: currency, quantity_purchased: purchased,
    shipping_rate_per_kg: null, markup_multiplier: null,
  };
  canonicalizeCostCurrency(details);
  // The order line STATED this currency (it is refused above when it is not
  // supported, never defaulted), so the product is marked as an answer rather
  // than left in the unstated backlog a vendor-wide currency fix would rewrite.
  // Through the shared helper, which marks only a currency that was really given.
  stampCostCurrencySource(details);
  return details;
}
