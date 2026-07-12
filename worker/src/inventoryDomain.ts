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
