/** Private sourcing evidence. None of these values apply a price or move stock. */
import { canonicalCurrency } from './currency';

export interface RouteQuote {
  id: string;
  mode: 'air' | 'sea' | 'land' | 'courier';
  label?: string;
  amount: number;
  currency: string;
  basis: 'g' | 'kg' | 'piece' | 'total';
  basis_quantity: number;
  price_kind: 'tea_only' | 'landed';
  destination?: string;
}
export interface VendorContactPerson { id: string; name: string; title?: string }
export interface VendorAddress { id: string; label: string; address: string; city?: string; region?: string; postal_code?: string; country?: string }
export interface VendorContactEndpoint { id?: string; channel: string; handle: string; label?: string; person_id?: string }
export interface CompassStructuredFields {
  age_quoted?: string | null;
  grade?: string | null;
  pack_size_grams?: number | null;
  pack_size_label?: string | null;
  vendor_item_number?: string | null;
  discount_percent?: number | null;
  quote_id?: string | null;
  route_quotes?: RouteQuote[];
}
export interface VendorStructuredFields {
  contacts_mode?: 'merge' | 'replace';
  vendor_code?: string | null;
  contact_people?: VendorContactPerson[];
  addresses?: VendorAddress[];
  contacts?: VendorContactEndpoint[];
}
export const COMPASS_STRUCTURED_COLUMNS = ['age_quoted', 'grade', 'pack_size_grams', 'pack_size_label', 'vendor_item_number', 'discount_percent', 'quote_id', 'route_quotes'] as const;
export const COMPASS_STRUCTURED_CAMEL = {
  age_quoted: 'ageQuoted', grade: 'grade', pack_size_grams: 'packSizeGrams', pack_size_label: 'packSizeLabel',
  vendor_item_number: 'vendorItemNumber', discount_percent: 'discountPercent', quote_id: 'quoteId', route_quotes: 'routeQuotes',
} as const;
export const VENDOR_STRUCTURED_COLUMNS = ['vendor_code', 'contact_people', 'addresses', 'contacts', 'contacts_mode'] as const;
export const CONTACT_CHANNELS = ['phone', 'email', 'whatsapp', 'wechat', 'instagram', 'fax', 'facebook', 'website', 'telegram', 'signal', 'line', 'other'] as const;
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function known(value: Record<string, unknown>, keys: readonly string[], label: string) {
  const unsupported = Object.keys(value).find(key => !keys.includes(key));
  if (unsupported) throw new Error(`${label}.${unsupported} has no structured field`);
}
function text(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be nonempty text under ${max} characters`);
  return value.trim();
}
function amount(value: unknown, label: string, minimum = 0, maximum = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} must be a finite number from ${minimum} to ${maximum}`);
  return value;
}
function list<T>(raw: unknown, label: string, read: (item: Record<string, unknown>, i: number) => T): T[] {
  if (!Array.isArray(raw) || raw.length > 100) throw new Error(`${label} must be an array of at most 100 entries`);
  const result = raw.map((value, i) => read(object(value, `${label}[${i}]`), i));
  const ids = result.map(item => (item as { id?: string }).id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate IDs`);
  return result;
}
export function readRouteQuotes(raw: unknown, currencyName: (value: string) => string | null = canonicalCurrency): RouteQuote[] {
  return list(raw, 'route_quotes', item => {
    known(item, ['id','mode','label','amount','currency','basis','basis_quantity','price_kind','destination'], 'route_quotes');
    if (!['air','sea','land','courier'].includes(String(item.mode))) throw new Error('route_quotes.mode is invalid');
    if (!['g','kg','piece','total'].includes(String(item.basis))) throw new Error('route_quotes.basis is invalid');
    if (!['tea_only','landed'].includes(String(item.price_kind))) throw new Error('route_quotes.price_kind is invalid');
    const currency = currencyName(text(item.currency, 'route_quotes.currency', 20));
    if (!currency) throw new Error('route_quotes.currency must be a supported stated currency');
    const quantity = amount(item.basis_quantity, 'route_quotes.basis_quantity');
    if (quantity <= 0) throw new Error('route_quotes.basis_quantity must be positive');
    if (item.basis === 'piece' && !Number.isInteger(quantity)) throw new Error('Piece basis quantity must be a whole number');
    return {
      id: text(item.id, 'route_quotes.id', 100), mode: item.mode as RouteQuote['mode'],
      amount: amount(item.amount, 'route_quotes.amount'), currency, basis: item.basis as RouteQuote['basis'],
      basis_quantity: quantity, price_kind: item.price_kind as RouteQuote['price_kind'],
      ...(item.label === undefined ? {} : { label: text(item.label, 'route_quotes.label') }),
      ...(item.destination === undefined ? {} : { destination: text(item.destination, 'route_quotes.destination') }),
    };
  });
}
export function readCompassStructuredPatch(raw: Record<string, unknown>, currencyName?: (value: string) => string | null): CompassStructuredFields {
  const patch: CompassStructuredFields = {};
  for (const key of COMPASS_STRUCTURED_COLUMNS) {
    if (raw[key] === undefined) continue;
    if (key === 'route_quotes') { patch.route_quotes = readRouteQuotes(raw[key], currencyName); continue; }
    if (raw[key] === null) { (patch as Record<string, unknown>)[key] = null; continue; }
    if (key === 'pack_size_grams') {
      const grams = amount(raw[key], key); if (grams <= 0) throw new Error('pack_size_grams must be positive'); patch[key] = grams;
    } else if (key === 'discount_percent') patch[key] = amount(raw[key], key, 0, 100);
    else (patch as Record<string, unknown>)[key] = text(raw[key], key);
  }
  return patch;
}
export function readVendorStructuredPatch(raw: Record<string, unknown>): VendorStructuredFields {
  const patch: VendorStructuredFields = {};
  if (raw.contacts_mode !== undefined) {
    if (raw.contacts_mode !== 'merge' && raw.contacts_mode !== 'replace') throw new Error('contacts_mode must be merge or replace');
    if (raw.contacts === undefined) throw new Error('contacts_mode requires an explicit contacts list');
    patch.contacts_mode = raw.contacts_mode;
  }
  if (raw.vendor_code !== undefined) patch.vendor_code = raw.vendor_code === null ? null : text(raw.vendor_code, 'vendor_code', 40);
  if (raw.contact_people !== undefined) patch.contact_people = list(raw.contact_people, 'contact_people', item => {
    known(item, ['id','name','title'], 'contact_people');
    return { id: text(item.id, 'contact_people.id', 100), name: text(item.name, 'contact_people.name'), ...(item.title === undefined ? {} : { title: text(item.title, 'contact_people.title') }) };
  });
  if (raw.addresses !== undefined) patch.addresses = list(raw.addresses, 'addresses', item => {
    known(item, ['id','label','address','city','region','postal_code','country'], 'addresses');
    const address: VendorAddress = { id: text(item.id, 'addresses.id', 100), label: text(item.label, 'addresses.label'), address: text(item.address, 'addresses.address', 2000) };
    for (const key of ['city','region','postal_code','country'] as const) if (item[key] !== undefined) address[key] = text(item[key], `addresses.${key}`);
    return address;
  });
  if (raw.contacts !== undefined) patch.contacts = list(raw.contacts, 'contacts', item => {
    known(item, ['id','channel','handle','label','person_id'], 'contacts');
    if (!CONTACT_CHANNELS.includes(item.channel as typeof CONTACT_CHANNELS[number])) throw new Error('contacts.channel is invalid');
    const endpoint: VendorContactEndpoint = { channel: String(item.channel), handle: text(item.handle, 'contacts.handle', 2000) };
    for (const key of ['id','label','person_id'] as const) if (item[key] !== undefined) endpoint[key] = text(item[key], `contacts.${key}`, 500);
    return endpoint;
  });
  return patch;
}
/** Incoming IDs edit one endpoint; ID-less entries append unless exactly identical. */
export function mergeVendorContacts(existing: VendorContactEndpoint[], incoming: VendorContactEndpoint[]): VendorContactEndpoint[] {
  if (!incoming.length) return [];
  const result = [...existing];
  for (const endpoint of incoming) {
    const index = endpoint.id ? result.findIndex(row => row.id === endpoint.id) : -1;
    if (index >= 0) result[index] = endpoint;
    else if (!result.some(row => row.channel === endpoint.channel && row.handle === endpoint.handle && (row.person_id ?? '') === (endpoint.person_id ?? '') && (row.label ?? '') === (endpoint.label ?? ''))) result.push(endpoint);
  }
  return result;
}

export interface CurateQuoteLine extends Omit<CompassStructuredFields, 'quote_id' | 'age_quoted' | 'grade' | 'pack_size_grams' | 'pack_size_label'> {
  id: string;
  compass_entry_id: string;
  price_amount?: number | null;
  price_currency?: string | null;
  price_per_unit_grams?: number | null;
}
export const DISCOUNT_CONDITION_TYPES = ['none', 'min_order_amount', 'min_order_weight', 'min_quantity', 'unknown'] as const;
export interface CurateQuoteFields {
  discount_percent?: number | null;
  discount_condition_type?: typeof DISCOUNT_CONDITION_TYPES[number] | null;
  discount_min_amount?: number | null;
  discount_min_currency?: string | null;
  discount_min_weight_grams?: number | null;
  discount_min_quantity?: number | null;
  vendor_id?: string;
  reference?: string | null;
  issued_to?: string | null;
  quote_date?: string | null;
  validity_days?: number | null;
  valid_until?: string | null;
  minimum_order_amount?: number | null;
  currency?: string | null;
  payment_terms?: string | null;
  lines?: CurateQuoteLine[];
}
export const QUOTE_HEADER_COLUMNS = ['vendor_id','reference','issued_to','quote_date','validity_days','valid_until','minimum_order_amount','currency','payment_terms','discount_percent','discount_condition_type','discount_min_amount','discount_min_currency','discount_min_weight_grams','discount_min_quantity'] as const;
export function readQuoteFields(raw: Record<string, unknown>, existing: Record<string, unknown> = {}, currencyName: (value: string) => string | null = canonicalCurrency): CurateQuoteFields {
  known(raw, [...QUOTE_HEADER_COLUMNS, 'lines'], 'quote');
  const patch: CurateQuoteFields = {};
  for (const key of QUOTE_HEADER_COLUMNS) {
    if (raw[key] === undefined) continue;
    if (raw[key] === null) { if (key === 'vendor_id') throw new Error('quote.vendor_id cannot be cleared'); (patch as Record<string, unknown>)[key] = null; continue; }
    if (key === 'discount_condition_type') {
      if (!DISCOUNT_CONDITION_TYPES.includes(raw[key] as typeof DISCOUNT_CONDITION_TYPES[number])) throw new Error('discount_condition_type is invalid');
      patch[key] = raw[key] as typeof DISCOUNT_CONDITION_TYPES[number];
    } else if (key === 'discount_percent') patch[key] = amount(raw[key], key, 0, 100);
    else if (key === 'minimum_order_amount' || key === 'discount_min_amount' || key === 'discount_min_weight_grams') patch[key] = amount(raw[key], key);
    else if (key === 'discount_min_quantity') {
      const quantity = amount(raw[key], key); if (!Number.isInteger(quantity)) throw new Error('discount_min_quantity must be a whole quantity'); patch[key] = quantity;
    }
    else if (key === 'validity_days') {
      const days = amount(raw[key], key); if (!Number.isInteger(days)) throw new Error('validity_days must be whole days'); patch[key] = days;
    } else if (key === 'currency' || key === 'discount_min_currency') {
      const currency = currencyName(text(raw[key], key, 20)); if (!currency) throw new Error('Quote needs a supported stated currency'); patch[key] = currency;
    } else {
      const value = text(raw[key], key, key === 'payment_terms' ? 2000 : 500);
      if (key === 'quote_date' || key === 'valid_until') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) throw new Error(`${key} must be an ISO calendar date`);
      }
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  const merged = { ...existing, ...patch };
  if ((merged.minimum_order_amount == null) !== (merged.currency == null)) throw new Error('Minimum order amount and currency must be supplied or cleared together');
  if ((merged.discount_min_amount == null) !== (merged.discount_min_currency == null)) throw new Error('Discount minimum amount and currency must be supplied or cleared together');
  const condition = merged.discount_condition_type;
  const thresholds = [merged.discount_min_amount, merged.discount_min_weight_grams, merged.discount_min_quantity];
  const selected = condition === 'min_order_amount' ? 0 : condition === 'min_order_weight' ? 1 : condition === 'min_quantity' ? 2 : -1;
  if (selected >= 0 && (thresholds[selected] == null || Number(thresholds[selected]) <= 0)) throw new Error(`${condition} requires a positive discount minimum threshold`);
  if (thresholds.some((value, index) => value != null && index !== selected)) throw new Error('Discount minimum threshold must match discount_condition_type');
  if (raw.lines !== undefined) patch.lines = list(raw.lines, 'lines', item => {
    known(item, ['id','compass_entry_id','vendor_item_number','price_amount','price_currency','price_per_unit_grams','discount_percent','route_quotes'], 'lines');
    const line: CurateQuoteLine = { id: text(item.id, 'lines.id', 100), compass_entry_id: text(item.compass_entry_id, 'lines.compass_entry_id', 100) };
    for (const key of ['vendor_item_number','discount_percent','route_quotes'] as const) if (item[key] !== undefined) Object.assign(line, readCompassStructuredPatch({ [key]: item[key] }, currencyName));
    if (item.price_amount !== undefined) line.price_amount = item.price_amount === null ? null : amount(item.price_amount, 'lines.price_amount');
    if (item.price_currency !== undefined) {
      line.price_currency = item.price_currency === null ? null : currencyName(text(item.price_currency, 'lines.price_currency', 20));
      if (item.price_currency !== null && !line.price_currency) throw new Error('Quote line needs a supported stated currency');
    }
    if (item.price_per_unit_grams !== undefined) {
      line.price_per_unit_grams = item.price_per_unit_grams === null ? null : amount(item.price_per_unit_grams, 'lines.price_per_unit_grams');
      if (line.price_per_unit_grams !== null && line.price_per_unit_grams <= 0) throw new Error('Quote price unit grams must be positive');
    }
    return line;
  });
  const existingLines = Array.isArray(existing.lines) ? existing.lines as CurateQuoteLine[] : [];
  const effectiveLines = patch.lines?.map(line => ({ ...existingLines.find(old => old.id === line.id), ...line })) ?? existingLines;
  if (condition != null && condition !== 'none' && merged.discount_percent == null && !effectiveLines.some(line => line.discount_percent != null)) throw new Error('Discount condition requires an explicit header or line discount_percent');
  return patch;
}
