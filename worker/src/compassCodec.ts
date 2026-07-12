export const COMPASS_JSON_COLUMNS = new Set(['tasting', 'photos', 'audio_clips']);
export const COMPASS_DECISIONS = new Set(['considering', 'selected', 'passed_on']);
export const COMPASS_SAMPLE_STATES = new Set(['requested', 'received', 'tasted']);
export const COMPASS_COLUMNS = [
  'name', 'chinese_name', 'type', 'form', 'year', 'season', 'storage',
  'origin_region', 'tea_key', 'price_amount', 'price_currency', 'price_per_unit_grams',
  'category', 'teaware_category', 'material', 'capacity_ml', 'quantity', 'era',
  'vendor_id', 'vendor_name', 'linked_customer_id', 'notes', 'tasting', 'photos', 'audio_clips',
  'status', 'buy_quantity_grams', 'buy_quantity_units', 'buy_total', 'verdict', 'decision', 'sample_state', 'session_id',
  'journey_id', 'visit_id',
  'draft_product_id', 'source_entry_id', 'created_at', 'updated_at',
] as const;
export type CompassColumn = typeof COMPASS_COLUMNS[number];

export function encodeCompassValue(column: CompassColumn, value: unknown): unknown {
  if (!COMPASS_JSON_COLUMNS.has(column) || value == null || typeof value === 'string') return value ?? null;
  return JSON.stringify(value);
}

export function decodeCompassWrite(body: Record<string, unknown>, rejectUnknown: boolean):
  | { values: Partial<Record<CompassColumn, unknown>> }
  | { unknownField: string }
  | { invalidDecision: true }
  | { invalidSampleState: true } {
  const allowed = new Set<string>(COMPASS_COLUMNS);
  const ownership = new Set(['id', 'user_id', 'account_id']);
  const unknown = Object.keys(body).find(key => !allowed.has(key) && !ownership.has(key));
  if (rejectUnknown && unknown) return { unknownField: unknown };
  if (body.decision !== undefined && body.decision !== null && !COMPASS_DECISIONS.has(String(body.decision))) {
    return { invalidDecision: true };
  }
  if (body.sample_state !== undefined && body.sample_state !== null && !COMPASS_SAMPLE_STATES.has(String(body.sample_state))) {
    return { invalidSampleState: true };
  }
  const values: Partial<Record<CompassColumn, unknown>> = {};
  for (const column of COMPASS_COLUMNS) {
    if (body[column] !== undefined) values[column] = encodeCompassValue(column, body[column]);
  }
  return { values };
}

// Import review may carry parser internals and server-owned fields. Select only
// fields that are meaningful evidence on a newly accepted Compass entry.
const IMPORT_COMPASS_COLUMNS = new Set<CompassColumn>([
  'chinese_name', 'type', 'form', 'year', 'season', 'storage', 'origin_region', 'tea_key',
  'price_amount', 'price_currency', 'price_per_unit_grams', 'category', 'teaware_category',
  'material', 'capacity_ml', 'quantity', 'era', 'vendor_id', 'vendor_name', 'tasting',
  'buy_quantity_grams', 'buy_quantity_units', 'buy_total', 'decision',
]);

export function compassValuesFromImport(parsed: Record<string, unknown>): Partial<Record<CompassColumn, unknown>> {
  const candidate = Object.fromEntries(Object.entries(parsed).filter(([key]) => IMPORT_COMPASS_COLUMNS.has(key as CompassColumn)));
  const decoded = decodeCompassWrite(candidate, true);
  return 'values' in decoded ? decoded.values : {};
}
