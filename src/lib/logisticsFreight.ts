/** Shipment accounting only. These estimates never change the shop's retail freight rate. */
export type PackedItemKind = 'loose_tea' | 'pressed_tea' | 'gaiwan' | 'cup' | 'teapot' | 'other';
export interface LogisticsFreightInput {
  basis: 'kg' | 'm3' | 'fixed';
  rate: number | null;
  billed_quantity: number | null;
  total_amount: number | null;
  currency: string | null;
  confirmed: boolean;
  allocation_basis?: 'kg' | 'm3';
}
export interface FreightAllocationLine {
  id: string;
  weight_kg: number | null;
  volume_m3: number | null;
  volume_estimated: boolean;
  weight_estimated?: boolean;
}
export interface ShipmentFreightResult {
  total_amount: number | null;
  allocation_basis: 'kg' | 'm3';
  allocations: Array<{ id: string; amount: number | null }>;
  estimated: boolean;
  issue: string | null;
}

/** Editable planning allowances, including ordinary packaging. Not measured product dimensions. */
const PLANNING_VOLUME = {
  loose_tea: { unit: 'g', cubicMetresPerUnit: 0.000008 },
  pressed_tea: { unit: 'g', cubicMetresPerUnit: 0.000003 },
  gaiwan: { unit: 'unit', cubicMetresPerUnit: 0.003 },
  cup: { unit: 'unit', cubicMetresPerUnit: 0.0005 },
  teapot: { unit: 'unit', cubicMetresPerUnit: 0.004 },
} as const;
export function estimatePackedVolume(input: { kind: PackedItemKind; quantity: number; unit: 'g' | 'unit' }) {
  const rule = input.kind === 'other' ? null : PLANNING_VOLUME[input.kind];
  if (!rule || rule.unit !== input.unit || !Number.isFinite(input.quantity) || input.quantity < 0 || (input.unit === 'unit' && !Number.isInteger(input.quantity))) {
    return { volume_m3: null, estimated: true as const, note: 'Enter an approximate packed volume for this item.' };
  }
  return {
    volume_m3: Math.round(input.quantity * rule.cubicMetresPerUnit * 1_000_000) / 1_000_000,
    estimated: true as const,
    note: 'Planning estimate including packaging. Replace with packed dimensions or the logistics company’s measurement when available.',
  };
}
const validNumber = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Allocate the entire bill once. Missing measures stay unknown; deliberate zero freight stays zero. */
export function calculateShipmentFreight(freight: LogisticsFreightInput, lines: readonly FreightAllocationLine[]): ShipmentFreightResult {
  const allocation_basis = freight.basis === 'fixed' ? freight.allocation_basis ?? 'm3' : freight.basis;
  const result: ShipmentFreightResult = {
    total_amount: null, allocation_basis,
    allocations: lines.map(line => ({ id: line.id, amount: null })),
    estimated: !freight.confirmed || lines.some(line => allocation_basis === 'kg' ? !!line.weight_estimated : line.volume_estimated),
    issue: null,
  };
  if (!['kg', 'm3', 'fixed'].includes(freight.basis) || !['kg', 'm3'].includes(allocation_basis)) return { ...result, issue: 'Choose weight or volume for freight.' };
  if (!freight.currency?.trim()) return { ...result, issue: 'Record the freight currency.' };
  for (const [label, value] of [['rate', freight.rate], ['billed quantity', freight.billed_quantity], ['total', freight.total_amount]] as const) {
    if (value != null && !validNumber(value)) return { ...result, issue: `Freight ${label} must be zero or a positive number.` };
  }
  const total = freight.total_amount != null ? freight.total_amount
    : freight.basis !== 'fixed' && validNumber(freight.rate) && validNumber(freight.billed_quantity) ? freight.rate * freight.billed_quantity : null;
  if (total == null) return { ...result, issue: 'Record the bill total, or the rate and billed quantity.' };
  if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER / 100) return { ...result, issue: 'Freight total is too large.' };
  // Integer minor units make the line shares add back to the recorded total exactly.
  const cents = Math.round(total * 100);
  result.total_amount = cents / 100;
  if (!lines.length) return { ...result, issue: 'Add shipment items before dividing freight.' };
  if (new Set(lines.map(line => line.id)).size !== lines.length) return { ...result, issue: 'Each shipment item must appear once.' };
  if (cents === 0) return { ...result, allocations: lines.map(line => ({ id: line.id, amount: 0 })) };
  const measures = lines.map(line => allocation_basis === 'kg' ? line.weight_kg : line.volume_m3);
  if (measures.some(value => !validNumber(value) || value <= 0)) return { ...result, issue: `Record a positive ${allocation_basis === 'kg' ? 'weight' : 'packed volume'} for every item. Estimates are allowed.` };
  const sum = (measures as number[]).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum)) return { ...result, issue: 'Shipment measurements are too large.' };
  const shares = (measures as number[]).map((measure, index) => {
    const exact = cents * (measure / sum);
    return { index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = cents - shares.reduce((amount, share) => amount + share.cents, 0);
  const ranked = [...shares].sort((a, b) => b.remainder - a.remainder || lines[a.index].id.localeCompare(lines[b.index].id));
  for (let i = 0; remaining > 0; i++, remaining--) ranked[i % ranked.length].cents++;
  result.allocations = shares.map(share => ({ id: lines[share.index].id, amount: share.cents / 100 }));
  return result;
}
