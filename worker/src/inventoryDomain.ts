export type InventoryPurpose = 'working' | 'sample' | 'personal';
export type ReceiptUnit = 'g' | 'unit';
export type AcquisitionKind = 'purchase' | 'free_sample' | 'gift' | 'transfer' | 'other';

const PURPOSES = new Set<InventoryPurpose>(['working', 'sample', 'personal']);
const ACQUISITION_KINDS = new Set<AcquisitionKind>(['purchase', 'free_sample', 'gift', 'transfer', 'other']);

export function effectiveInventoryPurpose(row: Record<string, unknown>): {
  purpose: InventoryPurpose; conflict: boolean; source: 'canonical' | 'legacy';
} {
  const legacy: InventoryPurpose = row.is_sample ? 'sample' : row.is_personal ? 'personal' : 'working';
  const legacyConflict = !!row.is_sample && !!row.is_personal;
  if (PURPOSES.has(row.inventory_purpose as InventoryPurpose)) {
    const purpose = row.inventory_purpose as InventoryPurpose;
    return { purpose, conflict: legacyConflict || purpose !== legacy, source: 'canonical' };
  }
  return { purpose: legacy, conflict: legacyConflict, source: 'legacy' };
}

export function decodeInventoryPurposeWrite(body: Record<string, unknown>): {
  inventory_purpose: InventoryPurpose; is_sample: 0 | 1; is_personal: 0 | 1;
} {
  let purpose: unknown = body.inventory_purpose;
  if (purpose == null) purpose = body.is_sample ? 'sample' : body.is_personal ? 'personal' : 'working';
  if (!PURPOSES.has(purpose as InventoryPurpose)) throw new Error('inventory_purpose must be working, sample, or personal');
  return {
    inventory_purpose: purpose as InventoryPurpose,
    is_sample: purpose === 'sample' ? 1 : 0,
    is_personal: purpose === 'personal' ? 1 : 0,
  };
}

export interface ReceiptProposalInput {
  purpose: InventoryPurpose;
  quantity: number;
  unit: ReceiptUnit;
  acquisition_kind: AcquisitionKind;
}

export function decodeReceiptProposal(body: Record<string, unknown>): ReceiptProposalInput {
  if (!PURPOSES.has(body.purpose as InventoryPurpose)) throw new Error('purpose must be working, sample, or personal');
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('quantity must be a finite number greater than zero');
  if (body.unit !== 'g' && body.unit !== 'unit') throw new Error('unit must be g or unit');
  if (body.unit === 'unit' && !Number.isInteger(quantity)) throw new Error('unit quantity must be a whole number');
  if (!ACQUISITION_KINDS.has(body.acquisition_kind as AcquisitionKind)) throw new Error('invalid acquisition_kind');
  return { purpose: body.purpose as InventoryPurpose, quantity, unit: body.unit, acquisition_kind: body.acquisition_kind as AcquisitionKind };
}

export function receiptInventoryValues(input: ReceiptProposalInput) {
  const purpose = decodeInventoryPurposeWrite({ inventory_purpose: input.purpose });
  return {
    ...purpose,
    stock_grams: input.unit === 'g' ? input.quantity : null,
    quantity_units: input.unit === 'unit' ? input.quantity : null,
    stock_known: true,
  };
}

export type InventoryReceiptState = 'planned' | 'ordered' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
export interface InventoryReceiptInput { product_id: string; quantity: number; unit: ReceiptUnit; intended_purpose: InventoryPurpose; source_kind: string; source_ref?: string | null }

export function decodeInventoryReceipt(body: Record<string, unknown>): InventoryReceiptInput {
  const product_id = typeof body.product_id === 'string' ? body.product_id.trim() : '';
  if (!product_id) throw new Error('product_id is required');
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('quantity must be greater than zero');
  if (body.unit !== 'g' && body.unit !== 'unit') throw new Error('unit must be g or unit');
  if (body.unit === 'unit' && !Number.isInteger(quantity)) throw new Error('unit quantity must be a whole number');
  if (!PURPOSES.has(body.intended_purpose as InventoryPurpose)) throw new Error('intended_purpose must be working, sample, or personal');
  const source_kind = typeof body.source_kind === 'string' ? body.source_kind.trim() : '';
  if (!source_kind) throw new Error('source_kind is required');
  return { product_id, quantity, unit: body.unit, intended_purpose: body.intended_purpose as InventoryPurpose, source_kind, source_ref: typeof body.source_ref === 'string' ? body.source_ref.trim() : null };
}

export function remainingReceiptQuantity(expected: number, received: number, cancelled: number): number {
  return Math.max(0, expected - received - cancelled);
}

export function deriveReceiptState(base: InventoryReceiptState, expected: number, received: number, cancelled: number): InventoryReceiptState {
  const remaining = remainingReceiptQuantity(expected, received, cancelled);
  if (remaining === 0) return received > 0 ? 'received' : 'cancelled';
  if (received > 0) return 'partially_received';
  return base === 'partially_received' || base === 'received' || base === 'cancelled' ? 'in_transit' : base;
}

export type StockMovementType = 'receipt' | 'sale' | 'sample_use' | 'gift' | 'waste' | 'return' | 'recount' | 'transfer';
export interface StockMovementInput {
  movement_type: StockMovementType;
  unit: ReceiptUnit;
  quantity: number | null;
  balance: number | null;
  expected_balance: number;
  idempotency_key: string;
  destination_product_id: string | null;
  note: string | null;
  batch_id: string | null;
  source_invoice_id: string | null;
  source_invoice_number: string | null;
  source_compass_entry_id: string | null;
}

const MOVEMENT_TYPES = new Set<StockMovementType>(['receipt', 'sale', 'sample_use', 'gift', 'waste', 'return', 'recount', 'transfer']);
const optionalText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;

export function decodeStockMovement(body: Record<string, unknown>): StockMovementInput {
  const movement_type = body.movement_type as StockMovementType;
  if (!MOVEMENT_TYPES.has(movement_type)) throw new Error('invalid movement_type');
  if (body.unit !== 'g' && body.unit !== 'unit') throw new Error('unit must be g or unit');
  const expected_balance = Number(body.expected_balance);
  if (!Number.isFinite(expected_balance) || expected_balance < 0) throw new Error('expected_balance must be a non-negative finite number');
  if (body.unit === 'unit' && !Number.isInteger(expected_balance)) throw new Error('unit expected_balance must be a whole number');
  const idempotency_key = optionalText(body.idempotency_key);
  if (!idempotency_key || idempotency_key.length > 200) throw new Error('idempotency_key is required and must be at most 200 characters');
  const balance = movement_type === 'recount' ? Number(body.balance) : null;
  const quantity = movement_type === 'recount' ? null : Number(body.quantity);
  if (movement_type === 'recount') {
    if (!Number.isFinite(balance) || balance! < 0) throw new Error('balance must be a non-negative finite number');
    if (body.unit === 'unit' && !Number.isInteger(balance)) throw new Error('unit balance must be a whole number');
  } else {
    if (!Number.isFinite(quantity) || quantity! <= 0) throw new Error('quantity must be a finite number greater than zero');
    if (body.unit === 'unit' && !Number.isInteger(quantity)) throw new Error('unit quantity must be a whole number');
  }
  const destination_product_id = optionalText(body.destination_product_id);
  if (movement_type === 'transfer' && !destination_product_id) throw new Error('destination_product_id is required for transfer');
  return {
    movement_type, unit: body.unit, quantity, balance, expected_balance, idempotency_key,
    destination_product_id, note: optionalText(body.note), batch_id: optionalText(body.batch_id),
    source_invoice_id: optionalText(body.source_invoice_id), source_invoice_number: optionalText(body.source_invoice_number),
    source_compass_entry_id: optionalText(body.source_compass_entry_id),
  };
}

export function movementDelta(input: StockMovementInput, currentBalance: number): number {
  if (input.movement_type === 'recount') return input.balance! - currentBalance;
  return (input.movement_type === 'receipt' || input.movement_type === 'return' ? 1 : -1) * input.quantity!;
}

export function stockMovementFingerprint(input: StockMovementInput): string {
  return JSON.stringify({
    movement_type: input.movement_type, unit: input.unit, quantity: input.quantity, balance: input.balance,
    expected_balance: input.expected_balance, destination_product_id: input.destination_product_id,
    note: input.note, batch_id: input.batch_id, source_invoice_id: input.source_invoice_id,
    source_invoice_number: input.source_invoice_number, source_compass_entry_id: input.source_compass_entry_id,
  });
}

export interface DecodedInventoryImportRow {
  rowIndex: number;
  purpose: InventoryPurpose;
  issues: string[];
  canImport: boolean;
  openingBalance: { quantity: number; unit: ReceiptUnit; before: 0; after: number } | null;
  movements: Array<{ movement_type: 'receipt'; quantity: number; unit: ReceiptUnit }>;
}

const missingImportValue = (value: unknown) => value == null || String(value).trim() === '' || ['unknown', 'null', 'undefined', 'nan'].includes(String(value).trim().toLowerCase());

export function decodeInventoryImportRow(
  row: Record<string, unknown>,
  rowIndex: number,
  defaults: { purpose?: InventoryPurpose } = {},
): DecodedInventoryImportRow {
  const purpose = row.inventory_purpose == null && row.is_sample == null && row.is_personal == null
    ? (defaults.purpose || 'working')
    : decodeInventoryPurposeWrite(row).inventory_purpose;
  const issues: string[] = [];
  if (missingImportValue(row.type)) issues.push('Missing Type');
  if (missingImportValue(row.product_name) && missingImportValue(row.given_name)) issues.push('Missing Name');
  const isUnit = String(row.type || '').toLowerCase() === 'teaware' || row.quantity_units != null;
  const rawQuantity = isUnit ? row.quantity_units : row.stock_grams;
  const quantity = missingImportValue(rawQuantity) ? 0 : Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity < 0 || (isUnit && !Number.isInteger(quantity))) issues.push('Invalid Stock');
  const openingBalance = quantity > 0 && Number.isFinite(quantity)
    ? { quantity, unit: (isUnit ? 'unit' : 'g') as ReceiptUnit, before: 0 as const, after: quantity }
    : null;
  return {
    rowIndex, purpose, issues, canImport: issues.length === 0, openingBalance,
    movements: openingBalance ? [{ movement_type: 'receipt', quantity, unit: openingBalance.unit }] : [],
  };
}

export function inventoryImportIdempotencyKey(receiptLabel: string, row: Record<string, unknown>, rowIndex: number): string {
  const canonical = JSON.stringify({ receiptLabel: receiptLabel.trim(), rowIndex, row: Object.keys(row).sort().map(key => [key, row[key]]) });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) hash = Math.imul(hash ^ canonical.charCodeAt(i), 16777619);
  return `inventory-import:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function summarizeInventoryImport(rows: DecodedInventoryImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter(row => row.canImport).length,
    issues: rows.filter(row => !row.canImport).length,
    physical: rows.filter(row => row.openingBalance !== null).length,
  };
}
