import { COMPASS_STRUCTURED_CAMEL, COMPASS_STRUCTURED_COLUMNS } from './curateStructuredFields';
import type { TeaCompassEntry } from '../components/TeaCompass/types';

/**
 * Which fields this device changed since the server last acknowledged a save.
 *
 * The sync still sends each changed tea whole (so a tea the server has never
 * seen can be created, and so an older server keeps working), and beside it
 * says which fields were edited, what each held before the first unsent edit,
 * and when it was last edited here. The worker (`worker/src/compassFieldPatch.ts`)
 * then writes only those fields, so a phone holding yesterday's copy of a tea
 * cannot put yesterday's price back by editing today's note.
 *
 * `unsyncedEdits` on an entry:
 *   - undefined on an entry with unsent changes: nobody recorded which fields,
 *     either because the tea has never reached the server or because the edit
 *     was made by an older bundle. The whole record is sent with no hint, which
 *     is exactly what happened before this existed.
 *   - an object: the edits since the last acknowledged save, keyed by the
 *     entry's own (camelCase) field name.
 * It lives on the entry, so it is persisted with it and survives a reload and
 * any number of failed attempts, and is cleared only by an acknowledgement.
 */
export interface UnsyncedEdit { base: unknown; at: string }
export type UnsyncedEdits = Record<string, UnsyncedEdit>;

export const CAMEL_TO_SNAKE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(COMPASS_STRUCTURED_CAMEL).map(([snake, camel]) => [camel, snake])),
  givenName: 'given_name',
  chineseName: 'chinese_name',
  originRegion: 'origin_region',
  originCountry: 'origin_country',
  clayType: 'clay_type',
  materialNote: 'material_note',
  sellPrice: 'sell_price',
  tastingHistory: 'tasting_history',
  priceAmount: 'price_amount',
  priceCurrency: 'price_currency',
  pricePerUnitGrams: 'price_per_unit_grams',
  teawareCategory: 'teaware_category',
  capacityMl: 'capacity_ml',
  vendorId: 'vendor_id',
  vendorName: 'vendor_name',
  shopName: 'shop_name',
  transportMode: 'transport_mode',
  linkedCustomerId: 'linked_customer_id',
  audioClips: 'audio_clips',
  buyQuantityGrams: 'buy_quantity_grams',
  buyQuantityUnits: 'buy_quantity_units',
  buyTotal: 'buy_total',
  draftProductId: 'draft_product_id',
  sourceEntryId: 'source_entry_id',
  sessionId: 'session_id',
  journeyId: 'journey_id',
  visitId: 'visit_id',
  sampleState: 'sample_state',
  sampleSetId: 'sample_set_id',
  teaKey: 'tea_key',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
);

// Only writable Compass columns cross the sync boundary. Hydrated rows retain
// provenance/lifecycle metadata for reading, and local state keeps its own fields.
// The strict worker codec remains the authority; the sync test pins this list to it.
export const COMPASS_SYNC_COLUMNS = new Set<string>([
  'id', ...COMPASS_STRUCTURED_COLUMNS,
  'name', 'given_name', 'chinese_name', 'type', 'form', 'year', 'season', 'storage',
  'origin_country', 'origin_region', 'classification', 'cultivar', 'producer', 'description',
  'tea_key', 'price_amount', 'price_currency', 'price_per_unit_grams',
  'category', 'teaware_category', 'material', 'clay_type', 'material_note', 'sell_price', 'tasting_history', 'capacity_ml', 'quantity', 'era',
  'vendor_id', 'vendor_name', 'shop_name', 'transport_mode', 'linked_customer_id', 'notes',
  'tasting', 'photos', 'audio_clips', 'status', 'buy_quantity_grams', 'buy_quantity_units',
  'buy_total', 'verdict', 'decision', 'sample_state', 'sample_set_id', 'session_id',
  'journey_id', 'visit_id', 'draft_product_id', 'source_entry_id', 'created_at', 'updated_at',
]);

/** Columns the server owns: sent with the record for older servers, never
 * counted as an edit this device made. The product link is not one of them:
 * a device that links a tea to a product (a graduated sample) says so, and the
 * server's own link rule decides whether it stands. */
const SERVER_OWNED_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

/** The column a local field is synced to, or null when it is not one this
 * device can change on the server. */
export function editableSyncColumn(field: string): string | null {
  const column = CAMEL_TO_SNAKE[field] || field;
  return COMPASS_SYNC_COLUMNS.has(column) && !SERVER_OWNED_COLUMNS.has(column) ? column : null;
}

/** A local value as the sync sends it. */
export function syncValue(column: string, value: unknown): unknown {
  // Route quotes remain arrays for strict worker validation.
  if (column === 'route_quotes') return value ?? [];
  if (column === 'photos' || column === 'audio_clips' || column === 'tasting' || column === 'tasting_history') {
    return value != null ? JSON.stringify(value) : null;
  }
  return value ?? null;
}

const sameLocal = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The edits an entry carries after `updates` is applied at `at`. An entry that
 * was in step with the server starts recording; one with unsent changes nobody
 * recorded stays unrecorded, because its earlier edits are unknown and only the
 * whole record is safe to send.
 */
export function editsAfterUpdate(
  entry: TeaCompassEntry,
  updates: Partial<TeaCompassEntry>,
  at: string,
): UnsyncedEdits | undefined {
  if (entry.unsyncedEdits === undefined && entry.synced !== true) return undefined;
  const edits: UnsyncedEdits = { ...(entry.unsyncedEdits ?? {}) };
  for (const [field, value] of Object.entries(updates)) {
    if (!editableSyncColumn(field)) continue;
    const previous = (entry as unknown as Record<string, unknown>)[field];
    const earlier = edits[field];
    if (!earlier && sameLocal(previous, value)) continue;
    edits[field] = { base: earlier ? earlier.base : previous, at };
  }
  return edits;
}

/** What the server is told about an entry's edits, or undefined to send the
 * whole record with no hint. */
export function changeHint(entry: TeaCompassEntry):
  | { fields: string[]; base: Record<string, unknown>; edited_at: Record<string, string> }
  | undefined {
  if (!entry.unsyncedEdits) return undefined;
  const fields: string[] = [];
  const base: Record<string, unknown> = {};
  const editedAt: Record<string, string> = {};
  for (const [field, edit] of Object.entries(entry.unsyncedEdits)) {
    const column = editableSyncColumn(field);
    if (!column) continue;
    fields.push(column);
    base[column] = syncValue(column, edit.base);
    editedAt[column] = edit.at;
  }
  return { fields, base, edited_at: editedAt };
}

/**
 * The server acknowledged `sent`, but the entry was edited again while the
 * request was in the air (`current`). What the server now holds is `sent`, so
 * an edit it already has is forgotten, and anything still different is an
 * edit against `sent`.
 */
export function editsAfterAcknowledgement(sent: TeaCompassEntry, current: TeaCompassEntry): UnsyncedEdits {
  const edits: UnsyncedEdits = {};
  const sentValues = sent as unknown as Record<string, unknown>;
  const currentValues = current as unknown as Record<string, unknown>;
  // A whole-record send told the server every field, so any field may differ.
  const fields = new Set([
    ...Object.keys(current.unsyncedEdits ?? {}),
    ...(sent.unsyncedEdits ? Object.keys(sent.unsyncedEdits) : Object.keys(currentValues)),
  ]);
  for (const field of fields) {
    if (!editableSyncColumn(field)) continue;
    const later = current.unsyncedEdits?.[field];
    const editedInFlight = !!later && later.at !== sent.unsyncedEdits?.[field]?.at;
    if (sameLocal(currentValues[field], sentValues[field]) && !editedInFlight) continue;
    edits[field] = { base: sentValues[field], at: later?.at ?? current.updatedAt };
  }
  return edits;
}
