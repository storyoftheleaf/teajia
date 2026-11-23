/**
 * Everything the package scanner read that has no field of its own on the
 * Curate form goes into the tea's notes, so no descriptive word from the
 * package is lost (Adrian, 2026-11-23: "every descriptive word it pulls out
 * needs to be in it"). The worker's field list is in worker/src/labelScan.ts.
 */

/** Fields the form fills directly, or that are not words from the package. */
const FORM_FIELDS = new Set([
  'name', 'givenName', 'given_name', 'chineseName', 'chinese_name', 'type', 'productType', 'product_type',
  'form', 'year', 'season', 'region', 'originRegion', 'origin_region',
  'price', 'priceAmount', 'price_amount', 'costAmount', 'cost_amount',
  'costCurrency', 'cost_currency', 'currency', 'priceCurrency',
  'grams', 'weight', 'quantityPurchased', 'quantity_purchased',
  'imageUrl', 'scannedBy',
]);

/** Labelled in this order; anything else the reader sends follows, by its own name. */
const LABELLED: ReadonlyArray<readonly [string[], string | null]> = [
  [['description'], null],
  [['descriptors'], 'Described as'],
  [['productName', 'product_name'], 'Cultivar'],
  [['vendor'], 'Producer'],
  [['originCountry', 'origin_country'], 'Country'],
  [['productionDate', 'production_date'], 'Production date'],
  [['harvestDate', 'harvest_date'], 'Harvest date'],
  [['elevation', 'altitude'], 'Elevation'],
  [['farm', 'garden'], 'Farm'],
  [['grade'], 'Grade'],
  [['processing'], 'Processing'],
  [['flavor', 'flavour', 'tastingNotes', 'tasting_notes'], 'Taste'],
  [['aroma'], 'Aroma'],
  [['brewing'], 'Brewing'],
  [['shelfLife', 'shelf_life'], 'Shelf life'],
  [['storage'], 'Storage'],
  [['awards'], 'Awards'],
  [['standard'], 'Standard'],
  [['notes'], null],
  [['labelTranslation', 'label_translation'], 'Label'],
];

function asText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => { const t = asText(v); return t ? `${k}: ${t}` : ''; })
      .filter(Boolean).join(', ');
  }
  return String(value).trim();
}

function labelFor(key: string): string {
  const words = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function labelScanNotes(r: Record<string, unknown>): string {
  const parts: string[] = [];
  const used = new Set<string>();
  for (const [keys, label] of LABELLED) {
    keys.forEach((k) => used.add(k));
    const key = keys.find((k) => asText(r[k]));
    if (!key) continue;
    const text = asText(r[key]);
    parts.push(label ? `${label}: ${text}` : text);
  }
  for (const [key, value] of Object.entries(r)) {
    if (used.has(key) || FORM_FIELDS.has(key)) continue;
    const text = asText(value);
    if (text) parts.push(`${labelFor(key)}: ${text}`);
  }
  return parts.join(' · ');
}
