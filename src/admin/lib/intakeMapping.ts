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
  quantityUnits: number;      // unit count for teaware (vs grams for leaf)
  teawareCategory: string;    // pot | cup | tray | storage | accessory | decorative
  sizeEstimate: number;       // rough size/weight used to prorate shipping
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

// Detect teaware from an item's name (English + Chinese) and classify it.
// Order matters — more specific vessels win over generic accessories so
// "tea tray" → tray, "tea knife" → accessory, "kettle" → pot. Returns a
// teaware_category, or '' when the name isn't teaware (e.g. a jade pendant).
const TEAWARE_RULES: { cat: string; kw: string[] }[] = [
  { cat: 'pot', kw: ['teapot', 'tea pot', 'gaiwan', 'kettle', 'kyusu', 'sand pot', 'clay pot', 'shui ping', '壶', '壺', '急须', '急須', '盖碗', '蓋碗'] },
  { cat: 'cup', kw: ['teacup', 'tea cup', 'mug', 'tumbler', 'pitcher', 'gong dao', 'fairness', '杯', '盏', '盞', '公道', '品茗'] },
  { cat: 'storage', kw: ['caddy', 'canister', 'storage', 'jar', 'tin', 'basket', '罐', '仓', '倉', '储', '儲', '收纳', '收納'] },
  { cat: 'tray', kw: ['tray', 'tea table', 'tea boat', 'saucer', 'pot stand', '茶盘', '茶盤', '茶船', '茶台', '茶臺', '壶承', '壺承'] },
  { cat: 'decorative', kw: ['incense', 'censer', 'ornament', 'statue', 'figurine', '香炉', '香爐', '摆件', '擺件'] },
  // Tool keywords are kept specific so tea names don't collide — e.g. bare
  // "needle"/"pick" would wrongly catch "Silver Needle" or "hand-picked".
  { cat: 'accessory', kw: ['tea knife', 'pu knife', 'tea needle', 'pu needle', 'pry needle', 'tea pick', 'tongs', 'tweezer', 'tea scoop', 'tea cloth', 'tea towel', 'tea filter', 'strainer', 'funnel', 'stove', 'tea brush', 'coaster', 'lid rest', 'tea spoon', '茶刀', '茶夹', '茶夾', '茶针', '茶針', '茶则', '茶則', '滤网', '濾網', '炉', '爐', '杯垫', '杯墊', '盖置', '蓋置'] },
];
export function detectTeaware(...names: string[]): string {
  const hay = names.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return '';
  for (const { cat, kw } of TEAWARE_RULES) {
    if (kw.some((k) => hay.includes(k))) return cat;
  }
  return '';
}

// Guess a tea type from the name when the sheet has no Type column. Order is
// significant: ripe/raw pu'er win before generic, cultivars resolve to oolong,
// etc. Generic "pu'er" with no raw/ripe marker stays unguessed (returns '').
const TEA_TYPE_RULES: { type: string; kw: string[] }[] = [
  { type: 'Shou', kw: ['shou', 'ripe pu', 'cooked pu', 'ripe puer', 'shu pu', '熟普', '熟茶', '熟饼', '熟餅'] },
  { type: 'Sheng', kw: ['sheng', 'raw pu', 'raw puer', 'raw pu-erh', 'uncooked', '生普', '生茶', '生饼', '生餅'] },
  { type: 'Oolong', kw: ['oolong', 'wulong', 'wu long', 'tie guan yin', 'tieguanyin', 'tiekuanyin', 'da hong pao', 'dahongpao', 'rou gui', 'rougui', 'shui xian', 'shuixian', 'dan cong', 'dancong', 'dong ding', 'dongding', 'alishan', 'ali shan', 'jin xuan', 'jinxuan', 'gaba', 'milk oolong', 'high mountain', 'gao shan', '乌龙', '烏龍', '岩茶', '铁观音', '鐵觀音', '凤凰', '鳳凰', '单丛', '單欉'] },
  { type: 'Red', kw: ['black tea', 'red tea', 'hong cha', 'hongcha', 'dian hong', 'dianhong', 'lapsang', 'zheng shan', 'jin jun mei', 'jinjunmei', 'keemun', 'qimen', '红茶', '紅茶', '正山', '金骏眉', '金駿眉'] },
  { type: 'White', kw: ['white tea', 'bai cha', 'silver needle', 'bai hao', 'baihao', 'bai mu dan', 'baimudan', 'shou mei', 'shoumei', 'gong mei', 'gongmei', '白茶', '白毫', '白牡丹', '寿眉', '壽眉'] },
  { type: 'Green', kw: ['green tea', 'lu cha', 'long jing', 'longjing', 'dragon well', 'bi luo chun', 'biluochun', 'mao feng', 'maofeng', 'gunpowder', 'gua pian', 'anji', '绿茶', '綠茶', '龙井', '龍井', '碧螺春', '毛峰'] },
  { type: 'Yellow', kw: ['yellow tea', 'huang cha', 'jun shan', 'junshan', 'huang ya', '黄茶', '黃茶', '君山', '黄芽'] },
  { type: 'Dark', kw: ['dark tea', 'hei cha', 'heicha', 'liu bao', 'liubao', 'fu zhuan', 'fu brick', 'an hua', 'anhua', 'golden flower', '黑茶', '六堡', '茯砖', '茯磚', '安化'] },
];
export function detectTeaType(...names: string[]): string {
  const hay = names.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return '';
  for (const { type, kw } of TEA_TYPE_RULES) {
    if (kw.some((k) => hay.includes(k))) return type;
  }
  return '';
}

// Guess a physical form from the name (cake, tuo, brick, ball…) when absent.
const FORM_RULES: { form: string; kw: string[] }[] = [
  { form: 'Cake', kw: ['cake', 'bing', 'disc', 'beeng', '饼', '餅'] },
  { form: 'Tuo', kw: ['tuo', 'tuocha', 'nest', 'bowl-shaped', '沱'] },
  { form: 'Brick', kw: ['brick', 'zhuan', '砖', '磚'] },
  { form: 'Ball', kw: ['dragon ball', 'ball', 'long zhu', 'pearl', '龙珠', '龍珠'] },
  { form: 'Rolled', kw: ['rolled', 'curled'] },
  { form: 'Powder', kw: ['powder', 'matcha', 'ground'] },
  { form: 'Bag', kw: ['tea bag', 'teabag', 'sachet'] },
  { form: 'Loose Leaf', kw: ['loose leaf', 'loose-leaf', 'maocha', 'mao cha'] },
];
export function detectForm(...names: string[]): string {
  const hay = names.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return '';
  for (const { form, kw } of FORM_RULES) {
    if (kw.some((k) => hay.includes(k))) return form;
  }
  return '';
}

// A rough default *size* (relative bulk — how much shipping space an item takes,
// NOT weight) used to prorate shipping. Teaware uses a per-piece size by category
// × unit count; tea uses a per-form size × piece count. Starting points only —
// the user edits each one.
const TEAWARE_SIZE: Record<string, number> = { pot: 100, cup: 15, tray: 120, storage: 60, accessory: 8, decorative: 40 };
const FORM_SIZE: Record<string, number> = { Cake: 30, Brick: 28, Tuo: 12, Ball: 5, Bag: 2, Rolled: 12, 'Loose Leaf': 15, Powder: 8 };
export function defaultSize(it: { type: string; teawareCategory: string; form?: string | null; quantityPurchased: number; stockGrams: number; quantityUnits: number }): number {
  if (it.type === 'Teaware') return (TEAWARE_SIZE[it.teawareCategory] || 40) * (it.quantityUnits || 1);
  const base = (it.form && FORM_SIZE[it.form]) || 15;
  // when stock reads as a small piece count (not grams), treat it as # of pieces
  const count = it.stockGrams > 0 && it.stockGrams <= 100 ? it.stockGrams : 1;
  return base * count;
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
  const givenName = String(mappedValue(row, mapping, 'given_name') || '').trim();
  const chineseName = String(mappedValue(row, mapping, 'chinese_name') || '').trim();
  const productName = String(mappedValue(row, mapping, 'product_name') || '').trim();
  let type = normalizeType(mappedValue(row, mapping, 'type'));
  let form = normalizeForm(mappedValue(row, mapping, 'form'));
  let stockGrams = parseNum(mappedValue(row, mapping, 'stock_grams'));
  let quantityUnits = 0;
  let teawareCategory = '';

  // When no tea type was given, infer it: teaware (kettle, cup…) → counted in
  // units; otherwise guess the tea type from the name (sheng/shou/oolong…).
  if (type === 'Misc') {
    const cat = detectTeaware(givenName, chineseName, productName);
    if (cat) {
      type = 'Teaware';
      teawareCategory = cat;
      quantityUnits = stockGrams;
      stockGrams = 0;
    } else {
      const guessed = detectTeaType(givenName, chineseName, productName);
      if (guessed) type = guessed;
    }
  }
  if (!form && type !== 'Teaware') {
    const f = detectForm(givenName, chineseName, productName);
    if (f) form = f as any;
  }
  const quantityPurchased = parseNum(mappedValue(row, mapping, 'quantity_purchased'));

  return {
    id: `${sourceId}-${index}`,
    sourceId,
    givenName,
    chineseName,
    productName,
    type,
    form,
    year: String(mappedValue(row, mapping, 'year') || '').trim(),
    originCountry: String(mappedValue(row, mapping, 'origin_country') || '').trim(),
    originRegion: String(mappedValue(row, mapping, 'origin_region') || '').trim(),
    vendor: String(mappedValue(row, mapping, 'vendor') || '').trim(),
    costAmount: parseNum(mappedValue(row, mapping, 'cost_amount')),
    costCurrency: resolveCurrency(row, mapping, mappedValue(row, mapping, 'cost_amount')),
    stockGrams,
    quantityPurchased,
    quantityUnits,
    teawareCategory,
    sizeEstimate: defaultSize({ type, teawareCategory, form, quantityPurchased, stockGrams, quantityUnits }),
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
  const hasStock = it.stockGrams > 0 || it.quantityPurchased > 0 || it.quantityUnits > 0;
  return hasName && hasType && hasCost && hasStock && !it.needsReview;
}

// Build the product object the bulkCreate endpoint expects.
// Everything from intake lands as Draft — a deliberate safety choice so nothing
// reaches the public storefront without an explicit activation step. isReadyItem
// drives the UI badge (ready-to-activate vs needs-info), not the import status.
// extraCost (in the item's own currency) is the prorated shipping share folded
// into the recorded cost so cost_amount reflects landed cost.
export function stagedToProduct(it: StagedItem, extraCost = 0): Record<string, any> {
  const out: Record<string, any> = {
    type: it.type,
    given_name: it.givenName || null,
    chinese_name: it.chineseName || null,
    product_name: it.productName || it.givenName || 'Unnamed Item',
    form: it.form,
    year: it.year && !isMissing(it.year) ? it.year : null,
    origin_country: it.originCountry || 'Unknown',
    origin_region: it.originRegion || null,
    cost_amount: Math.round((it.costAmount + (extraCost || 0)) * 100) / 100,
    cost_currency: it.costCurrency,
    vendor: it.vendor || null,
    description: it.description || null,
    image_url: it.imageUrl || null,
    status: 'Draft',
    is_personal: it.isPersonal,
    is_public: !it.isPersonal,
  };
  if (it.type === 'Teaware') {
    // Teaware is counted in units, not grams. Leave stock_grams unset so the
    // worker opens stock from quantity_units. Clay/material is intentionally
    // not captured here.
    out.quantity_units = it.quantityUnits || it.stockGrams || 0;
    if (it.teawareCategory) out.teaware_category = it.teawareCategory;
  } else {
    out.stock_grams = it.stockGrams;
    out.quantity_purchased = it.quantityPurchased;
  }
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
  const givenName = String(data.givenName || '').trim();
  const chineseName = String(data.chineseName || '').trim();
  const productName = String(data.productName || '').trim();
  let type = normalizeType(data.type);
  let teawareCategory = type === 'Teaware' ? detectTeaware(givenName, chineseName, productName) : '';
  if (type === 'Misc') {
    const cat = detectTeaware(givenName, chineseName, productName);
    if (cat) { type = 'Teaware'; teawareCategory = cat; }
    else { const guessed = detectTeaType(givenName, chineseName, productName); if (guessed) type = guessed; }
  }
  const form = normalizeForm(data.form) || (type !== 'Teaware' ? (detectForm(givenName, chineseName, productName) as any || null) : null);
  const qty = parseNum(data.quantityPurchased);
  return {
    id: `${sourceId}-img`,
    sourceId,
    givenName,
    chineseName,
    productName,
    type,
    form,
    year: data.year ? String(data.year) : '',
    originCountry: String(data.originCountry || '').trim(),
    originRegion: String(data.originRegion || '').trim(),
    vendor: String(data.vendor || '').trim(),
    costAmount: parseNum(data.costAmount),
    costCurrency: normalizeCurrency(data.costCurrency),
    stockGrams: type === 'Teaware' ? 0 : qty,
    quantityPurchased: qty,
    quantityUnits: type === 'Teaware' ? qty : 0,
    teawareCategory,
    sizeEstimate: defaultSize({ type, teawareCategory, form, quantityPurchased: qty, stockGrams: type === 'Teaware' ? 0 : qty, quantityUnits: type === 'Teaware' ? qty : 0 }),
    description: String(data.description || data.notes || '').trim(),
    imageUrl,
    isPersonal: defaultPersonal,
    needsReview: true, // vision output always reviewed before going live
    include: true,
    order: {},
  };
}
