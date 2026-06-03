// Intake column mapping — the primitive that lets ANY spreadsheet shape load
// into Teajia. A loaded file's columns are matched (best-effort) to a set of
// target fields; the user can correct the mapping; the corrected mapping is
// remembered per header-signature so the same file shape auto-maps next time.
//
// Item fields feed the product object accepted by api.products.bulkCreate.
// Order/logistics fields feed a purchase_orders record (money + shipment trail)
// and are intentionally kept OUT of the product object.

export type TargetGroup = 'item' | 'order' | 'ignore';

export interface TargetField {
  key: string;
  label: string;
  group: TargetGroup;
  aliases: string[];
  hint?: string; // shown under the dropdown
}

// Canonical destinations a spreadsheet column can map to.
export const TARGET_FIELDS: TargetField[] = [
  // ── Item identity → product ──────────────────────────────────────────────
  { key: 'given_name', label: 'Name (English)', group: 'item', aliases: ['given name', 'givenname', 'title', 'item', 'item english', 'item (english)', 'product', 'name', 'english'] },
  { key: 'chinese_name', label: 'Chinese name', group: 'item', aliases: ['chinese name', 'chinesename', 'chinese', 'item chinese', 'item (chinese)', '中文', '名称'] },
  { key: 'product_name', label: 'Cultivar / product name', group: 'item', aliases: ['product name', 'productname', 'cultivar', 'botanical'] },
  { key: 'type', label: 'Type', group: 'item', aliases: ['type', 'category', 'tea type'], hint: 'Green, Oolong, Sheng, Teaware…' },
  { key: 'form', label: 'Form', group: 'item', aliases: ['form', 'leaf form', 'tea form', 'shape', 'style'] },
  { key: 'year', label: 'Year', group: 'item', aliases: ['year', 'age', 'harvest year', 'vintage'] },
  { key: 'origin_country', label: 'Origin country', group: 'item', aliases: ['origin country', 'country', 'origin'] },
  { key: 'origin_region', label: 'Origin region', group: 'item', aliases: ['origin region', 'region', 'area'] },
  // ── Stock + cost → product ───────────────────────────────────────────────
  { key: 'stock_grams', label: 'Stock (grams/units)', group: 'item', aliases: ['stock', 'stock amount', 'current stock', 'qty', 'quantity', 'on hand'] },
  { key: 'quantity_purchased', label: 'Quantity purchased', group: 'item', aliases: ['quantity purchased', 'grams', 'bag size', 'weight', 'purchased'] },
  { key: 'cost_amount', label: 'Cost / unit price', group: 'item', aliases: ['cost amount', 'cost', 'bag cost', 'price', 'unit price', 'unit price (hk$)', 'unit price (hkd)', 'unit price (rmb)', 'unit price (nt$)'] },
  { key: 'cost_currency', label: 'Currency', group: 'item', aliases: ['cost currency', 'currency', 'ccy'] },
  { key: 'vendor', label: 'Vendor / store', group: 'item', aliases: ['vendor', 'store', 'source', 'supplier', 'shop', 'seller'] },
  { key: 'description', label: 'Description', group: 'item', aliases: ['description', 'desc', 'notes', 'note'] },
  { key: 'is_personal', label: 'Personal? (Yes/No)', group: 'item', aliases: ['personal collection', 'personal', 'is personal', 'private'], hint: 'Yes → kept as your own record' },
  // ── Order / logistics → purchase record (NOT the product) ────────────────
  { key: 'po_qty', label: 'Order quantity', group: 'order', aliases: ['qty', 'quantity', 'count', 'pieces'] },
  { key: 'po_subtotal', label: 'Subtotal', group: 'order', aliases: ['subtotal', 'sub total', 'line total'] },
  { key: 'po_shipping', label: 'Shipping', group: 'order', aliases: ['shipping', 'freight', 'postage'] },
  { key: 'po_discount', label: 'Discount', group: 'order', aliases: ['discount', 'discounts', 'rebate'] },
  { key: 'po_fee', label: 'Transaction fee', group: 'order', aliases: ['fee', 'fees', 'transaction fee', 'tx fee'] },
  { key: 'po_total', label: 'Total paid', group: 'order', aliases: ['total', 'grand total', 'amount paid', 'paid'] },
  { key: 'po_tracking', label: 'Tracking number', group: 'order', aliases: ['tracking', 'tracking number', 'tracking no', 'awb'] },
  { key: 'po_carrier', label: 'Carrier', group: 'order', aliases: ['carrier', 'courier', 'shipper', 'logistics'] },
  { key: 'po_delivered', label: 'Delivery status', group: 'order', aliases: ['delivered', 'delivery', 'status', 'arrival', 'received'] },
];

export const TARGET_BY_KEY: Record<string, TargetField> = Object.fromEntries(
  TARGET_FIELDS.map((f) => [f.key, f]),
);

// Column → target key (or '' for ignore).
export type ColumnMapping = Record<string, string>;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Best-effort suggestion for a single header. Returns a target key or '' (ignore).
// Ranks candidates so the LONGEST matching alias wins — this avoids substring
// false-positives like "Discounts" matching "count" (qty) before "discounts".
export function suggestTarget(header: string, alreadyUsed: Set<string>): string {
  const n = normalize(header);
  if (!n) return '';
  let best = '';
  let bestScore = 0;
  for (const f of TARGET_FIELDS) {
    if (alreadyUsed.has(f.key)) continue;
    for (const a of f.aliases) {
      const na = normalize(a);
      if (!na) continue;
      let score = 0;
      if (na === n) score = 1000 + na.length;        // exact alias match
      else if (n.includes(na)) score = 100 + na.length; // header contains alias
      else if (na.includes(n)) score = 50 + n.length;   // alias contains header
      if (score > bestScore) { bestScore = score; best = f.key; }
    }
  }
  return best;
}

// Auto-map a full header list. Each matched target is reserved so columns map 1:1.
export function autoMap(headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const key = suggestTarget(h, used);
    mapping[h] = key;
    if (key) used.add(key);
  }
  return mapping;
}

// A stable signature for a set of headers, so we can remember a mapping per shape.
export function headerSignature(headers: string[]): string {
  return headers.map(normalize).filter(Boolean).sort().join('|');
}

const LS_KEY = 'teajia_intake_mappings_v1';

export function loadRememberedMapping(headers: string[]): ColumnMapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return all[headerSignature(headers)] || null;
  } catch {
    return null;
  }
}

export function rememberMapping(headers: string[], mapping: ColumnMapping): void {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[headerSignature(headers)] = mapping;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}

// ── Value helpers ───────────────────────────────────────────────────────────

const MISSING = new Set(['', 'unknown', 'nan', 'null', 'undefined', 'n/a', '-']);
export const isMissing = (v: unknown): boolean =>
  v == null || MISSING.has(String(v).toLowerCase().trim());

export function parseNum(v: unknown): number {
  if (isMissing(v)) return 0;
  // handle "4+8", "3+3+3+3", "~235", "2,100", "NT$300"
  const str = String(v).replace(/[~≈]/g, '');
  if (/\+/.test(str)) {
    return str.split('+').reduce((sum, part) => {
      const n = parseFloat(part.replace(/[^0-9.-]/g, ''));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }
  const n = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Sniff a currency token out of free text (a price cell like "700 NT$" or a
// header like "Unit Price (HK$)"). Bare "$" is intentionally ignored as too
// ambiguous. Returns a known currency code or '' if none found.
export function detectCurrencyToken(s: unknown): string {
  if (!s) return '';
  const u = String(s).toUpperCase();
  if (u.includes('NT$') || /\bNTD?\b/.test(u) || /\bTWD\b/.test(u)) return 'NT';
  if (u.includes('RMB') || u.includes('CNY') || u.includes('YUAN') || u.includes('¥')) return 'Yuan';
  if (u.includes('HK$') || /\bHKD\b/.test(u)) return 'HKD';
  if (/\bJPY\b/.test(u) || u.includes('YEN')) return 'JPY';
  if (/\bMYR\b/.test(u) || /\bRM\b/.test(u)) return 'MYR';
  if (/\bIDR\b/.test(u) || /\bRP\b/.test(u)) return 'IDR';
  if (/\bAUD\b/.test(u) || u.includes('A$')) return 'AUD';
  if (u.includes('US$') || /\bUSD\b/.test(u)) return 'USD';
  return '';
}

export function normalizeCurrency(raw: unknown): string {
  if (isMissing(raw)) return 'UNK';
  const c = String(raw).toUpperCase().trim();
  if (['NT', 'NT$', 'TWD', 'NTD'].includes(c)) return 'NT';
  if (['RMB', 'CNY', 'YUAN', '¥'].includes(c)) return 'Yuan';
  if (['USD', '$', 'US$'].includes(c)) return 'USD';
  if (['HKD', 'HK$', 'HK'].includes(c)) return 'HKD';
  if (['IDR', 'RP'].includes(c)) return 'IDR';
  if (['JPY', 'YEN', 'EN'].includes(c)) return 'JPY';
  if (['MYR', 'RM'].includes(c)) return 'MYR';
  if (['AUD', 'A$'].includes(c)) return 'AUD';
  return 'UNK';
}

const VALID_TYPES = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware', 'Misc'];
export function normalizeType(raw: unknown): string {
  const v = String(raw ?? '').toLowerCase().trim();
  if (!v) return 'Misc';
  if (['matcha', 'flower'].includes(v)) return 'Herbal';
  const m = VALID_TYPES.find((t) => t.toLowerCase() === v);
  return m || 'Misc';
}

const VALID_FORMS = ['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other'];
export function normalizeForm(raw: unknown): string | null {
  const v = String(raw ?? '').toLowerCase().trim();
  return VALID_FORMS.find((f) => f.toLowerCase() === v) || null;
}

const isYes = (v: unknown) => ['yes', 'true', '1', 'y'].includes(String(v ?? '').toLowerCase().trim());

// A staged row carries both the product payload AND the order/logistics slice.
export interface StagedItem {
  id: string;
  sourceId: string;
  // editable item fields
  givenName: string;
  chineseName: string;
  productName: string;
  type: string;
  form: string | null;
  year: string;
  originCountry: string;
  originRegion: string;
  vendor: string;
  costAmount: number;
  costCurrency: string;
  stockGrams: number;
  quantityPurchased: number;
  description: string;
  imageUrl: string;
  // triage
  isPersonal: boolean;
  needsReview: boolean;
  include: boolean;
  // order/logistics slice (kept for the purchase record)
  order: Record<string, string>;
}

// Pull a mapped value out of a raw row for a given target key (first column that maps to it).
function mappedValue(row: Record<string, any>, mapping: ColumnMapping, key: string): any {
  for (const [col, target] of Object.entries(mapping)) {
    if (target === key && !isMissing(row[col])) return row[col];
  }
  return '';
}

// The spreadsheet header mapped to a given target key (for header-derived hints).
function headerForTarget(mapping: ColumnMapping, key: string): string {
  for (const [col, target] of Object.entries(mapping)) {
    if (target === key) return col;
  }
  return '';
}

// Resolve the currency for a cost cell: explicit Currency column, else a token
// inside the price cell ("700 NT$"), else the cost column header ("… (HK$)").
function resolveCurrency(row: Record<string, any>, mapping: ColumnMapping, costRaw: unknown): string {
  const explicit = normalizeCurrency(mappedValue(row, mapping, 'cost_currency'));
  if (explicit !== 'UNK') return explicit;
  return detectCurrencyToken(costRaw)
    || detectCurrencyToken(headerForTarget(mapping, 'cost_amount'))
    || 'UNK';
}

// Transform one raw spreadsheet row → a StagedItem using the column mapping.
export function rowToStaged(
  row: Record<string, any>,
  mapping: ColumnMapping,
  sourceId: string,
  index: number,
  defaultPersonal: boolean,
): StagedItem {
  const order: Record<string, string> = {};
  for (const [col, target] of Object.entries(mapping)) {
    if (target && TARGET_BY_KEY[target]?.group === 'order' && !isMissing(row[col])) {
      order[target] = String(row[col]).trim();
    }
  }
  const personalCell = mappedValue(row, mapping, 'is_personal');
  return {
    id: `${sourceId}-${index}`,
    sourceId,
    givenName: String(mappedValue(row, mapping, 'given_name') || '').trim(),
    chineseName: String(mappedValue(row, mapping, 'chinese_name') || '').trim(),
    productName: String(mappedValue(row, mapping, 'product_name') || '').trim(),
    type: normalizeType(mappedValue(row, mapping, 'type')),
    form: normalizeForm(mappedValue(row, mapping, 'form')),
    year: String(mappedValue(row, mapping, 'year') || '').trim(),
    originCountry: String(mappedValue(row, mapping, 'origin_country') || '').trim(),
    originRegion: String(mappedValue(row, mapping, 'origin_region') || '').trim(),
    vendor: String(mappedValue(row, mapping, 'vendor') || '').trim(),
    costAmount: parseNum(mappedValue(row, mapping, 'cost_amount')),
    costCurrency: resolveCurrency(row, mapping, mappedValue(row, mapping, 'cost_amount')),
    stockGrams: parseNum(mappedValue(row, mapping, 'stock_grams')),
    quantityPurchased: parseNum(mappedValue(row, mapping, 'quantity_purchased')),
    description: String(mappedValue(row, mapping, 'description') || '').trim(),
    imageUrl: '',
    isPersonal: personalCell ? isYes(personalCell) : defaultPersonal,
    needsReview: false,
    include: true,
    order,
  };
}

// Does a staged item have enough to be an Active product, or should it be Draft?
export function isReadyItem(it: StagedItem): boolean {
  const hasName = !!(it.givenName || it.productName);
  const hasType = it.type !== 'Misc';
  const hasCost = it.costAmount > 0;
  const hasStock = it.stockGrams > 0 || it.quantityPurchased > 0;
  return hasName && hasType && hasCost && hasStock && !it.needsReview;
}

// Build the product object the bulkCreate endpoint expects.
// Everything from intake lands as Draft — a deliberate safety choice so nothing
// reaches the public storefront without an explicit activation step. isReadyItem
// drives the UI badge (ready-to-activate vs needs-info), not the import status.
export function stagedToProduct(it: StagedItem): Record<string, any> {
  const out: Record<string, any> = {
    type: it.type,
    given_name: it.givenName || null,
    chinese_name: it.chineseName || null,
    product_name: it.productName || it.givenName || 'Unnamed Item',
    form: it.form,
    year: it.year && !isMissing(it.year) ? it.year : null,
    origin_country: it.originCountry || 'Unknown',
    origin_region: it.originRegion || null,
    stock_grams: it.stockGrams,
    quantity_purchased: it.quantityPurchased,
    cost_amount: it.costAmount,
    cost_currency: it.costCurrency,
    vendor: it.vendor || null,
    description: it.description || null,
    image_url: it.imageUrl || null,
    status: 'Draft',
    is_personal: it.isPersonal,
    is_public: !it.isPersonal,
  };
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(out)) {
    if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
  }
  return cleaned;
}

// Extraction result (from /api/extract-from-image) → a StagedItem.
export function extractedToStaged(
  data: Record<string, any>,
  imageUrl: string,
  sourceId: string,
  defaultPersonal: boolean,
): StagedItem {
  return {
    id: `${sourceId}-img`,
    sourceId,
    givenName: String(data.givenName || '').trim(),
    chineseName: String(data.chineseName || '').trim(),
    productName: String(data.productName || '').trim(),
    type: normalizeType(data.type),
    form: normalizeForm(data.form),
    year: data.year ? String(data.year) : '',
    originCountry: String(data.originCountry || '').trim(),
    originRegion: String(data.originRegion || '').trim(),
    vendor: String(data.vendor || '').trim(),
    costAmount: parseNum(data.costAmount),
    costCurrency: normalizeCurrency(data.costCurrency),
    stockGrams: parseNum(data.quantityPurchased),
    quantityPurchased: parseNum(data.quantityPurchased),
    description: String(data.description || data.notes || '').trim(),
    imageUrl,
    isPersonal: defaultPersonal,
    needsReview: true, // vision output always reviewed before going live
    include: true,
    order: {},
  };
}
