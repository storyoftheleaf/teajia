import { canonicalCurrency } from '../../../lib/currency';
import { estimatePackedVolume, type PackedItemKind } from '../../../lib/logisticsFreight';
import type { LogisticsShipment, LogisticsShipmentLine } from '../../../lib/logisticsTypes';

const usable = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export const formatPlanningNumber = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value);

export interface ItemCostSummary {
  totals: Array<{ currency: string; amount: number }>;
  missingCount: number;
  complete: boolean;
}
/** Amounts are already prorated to the shipment allocation. Never convert currencies here. */
export function summarizeItemCosts(lines: readonly { original_cost_amount: number | null; original_cost_currency: string | null }[]): ItemCostSummary {
  const sums = new Map<string, number>();
  let missingCount = 0;
  for (const line of lines) {
    const currency = canonicalCurrency(line.original_cost_currency);
    if (!usable(line.original_cost_amount) || !currency || currency === 'UNK') { missingCount++; continue; }
    sums.set(currency, (sums.get(currency) ?? 0) + line.original_cost_amount);
  }
  return { totals: [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: rounded(amount) })), missingCount, complete: lines.length > 0 && missingCount === 0 };
}
export function formatCostTotals(summary: ItemCostSummary): string {
  const amounts = summary.totals.map(({ currency, amount }) => `${formatPlanningNumber(amount)} ${currency}`).join(' + ');
  if (!amounts) return 'Not recorded';
  return summary.missingCount ? `${amounts} · ${summary.missingCount} item${summary.missingCount === 1 ? '' : 's'} unpriced` : amounts;
}

export interface PlanningMeasure {
  /** Null when any item is unknown. knownTotal is only a partial subtotal in that case. */
  total: number | null;
  knownTotal: number;
  missingCount: number;
  estimated: boolean;
  suggestedCount: number;
}
export interface PlanningLine {
  id: string;
  kind: PackedItemKind;
  volumeM3: number | null;
  suggestedVolume: boolean;
}
export function planningItemKind(line: Pick<LogisticsShipmentLine, 'product_name' | 'unit'>): PackedItemKind {
  if (line.unit === 'g') return 'loose_tea';
  const name = line.product_name.toLowerCase();
  if (/\bgaiwan\b|盖碗|蓋碗/.test(name)) return 'gaiwan';
  if (/\bteapot\b|茶壶|茶壺/.test(name)) return 'teapot';
  if (/\bcups?\b|茶杯|品茗杯/.test(name)) return 'cup';
  return 'other';
}
function summarizeMeasures(values: Array<{ value: number | null; estimated: boolean; suggested: boolean }>): PlanningMeasure {
  const missingCount = values.filter(item => !usable(item.value)).length;
  const knownTotal = rounded(values.reduce((sum, item) => sum + (usable(item.value) ? item.value : 0), 0));
  return {
    total: values.length && missingCount === 0 ? knownTotal : null, knownTotal, missingCount,
    estimated: values.some(item => item.estimated), suggestedCount: values.filter(item => item.suggested).length,
  };
}
export function formatPlanningMeasure(measure: PlanningMeasure, unit: 'kg' | 'm³'): string {
  if (measure.total == null) {
    const missing = measure.missingCount ? `${measure.missingCount} item${measure.missingCount === 1 ? '' : 's'} unknown` : 'Not recorded';
    return measure.knownTotal > 0 ? `${formatPlanningNumber(measure.knownTotal)} ${unit} known · ${missing}` : missing;
  }
  return `${formatPlanningNumber(measure.total)} ${unit}${measure.suggestedCount ? ' planning' : measure.estimated ? ' est.' : ''}`;
}
export interface PlanningFreight {
  amount: number | null;
  currency: string | null;
  basis: 'kg' | 'm3' | 'fixed' | null;
  rate: number | null;
  quantity: number | null;
  status: 'confirmed' | 'estimate' | 'unknown';
  source: 'bill' | 'recorded' | 'planning' | null;
  issue: string | null;
}
export interface ShipmentPlanningSummary {
  goods: ItemCostSummary;
  weight: PlanningMeasure;
  volume: PlanningMeasure;
  freight: PlanningFreight;
  lines: PlanningLine[];
}

/** Read-only planning. Suggestions never overwrite measured packing or become a confirmed bill. */
export function shipmentPlanningSummary(shipment: LogisticsShipment): ShipmentPlanningSummary {
  const lines: PlanningLine[] = shipment.lines.map(line => {
    const kind = planningItemKind(line);
    // An entered zero is preserved. Invalid recorded data is not replaced by a guess.
    const suggestedVolume = line.volume_m3 == null;
    const volumeM3 = suggestedVolume ? estimatePackedVolume({ kind, quantity: line.quantity, unit: line.unit }).volume_m3 : usable(line.volume_m3) ? line.volume_m3 : null;
    return { id: line.id, kind, volumeM3, suggestedVolume: suggestedVolume && volumeM3 != null };
  });
  const weight = summarizeMeasures(shipment.lines.map(line => ({ value: usable(line.weight_kg) ? line.weight_kg : null, estimated: line.weight_estimated, suggested: false })));
  const volume = summarizeMeasures(lines.map((line, index) => ({ value: line.volumeM3, estimated: line.suggestedVolume || shipment.lines[index].volume_estimated, suggested: line.suggestedVolume })));
  const recorded = shipment.freight;
  // A saved freight choice is authoritative, even when incomplete. Do not fill its gaps from an older quote.
  const quote = recorded ?? shipment.service_quote;
  const basis = quote?.basis ?? null;
  const currency = canonicalCurrency(quote?.currency);
  const rate = usable(quote?.rate) ? quote.rate : null;
  const billed = recorded && usable(recorded.billed_quantity) ? recorded.billed_quantity : null;
  const freight: PlanningFreight = { amount: null, currency: currency === 'UNK' ? null : currency, basis, rate, quantity: billed, status: 'unknown', source: null, issue: null };
  const result = { goods: summarizeItemCosts(shipment.lines), weight, volume, freight, lines };
  if (!freight.currency) { freight.issue = 'Freight currency not recorded.'; return result; }
  const recordedTotal = usable(shipment.freight_total) ? shipment.freight_total : recorded && usable(recorded.total_amount) ? recorded.total_amount : null;
  if (recordedTotal != null) {
    freight.amount = recordedTotal;
    freight.status = recorded?.confirmed ? 'confirmed' : 'estimate';
    freight.source = recorded?.confirmed ? 'bill' : 'recorded';
    return result;
  }
  if (basis == null || rate == null) { freight.issue = 'Freight rate not recorded.'; return result; }
  if (basis === 'fixed') {
    freight.amount = rate;
    freight.status = 'estimate';
    freight.source = 'planning';
    return result;
  }
  const measure = basis === 'm3' ? volume : weight;
  const quantity = billed ?? measure.total;
  freight.quantity = quantity;
  if (quantity == null) { freight.issue = `Packed ${basis === 'm3' ? 'volume' : 'weight'} is missing for ${measure.missingCount || 'some'} item${measure.missingCount === 1 ? '' : 's'}.`; return result; }
  const amount = rate * quantity;
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) { freight.issue = 'Freight estimate is too large.'; return result; }
  freight.amount = Math.round(amount * 100) / 100;
  freight.status = billed != null && recorded?.confirmed ? 'confirmed' : 'estimate';
  freight.source = billed != null ? (recorded?.confirmed ? 'bill' : 'recorded') : 'planning';
  return result;
}
