import { describe, expect, it } from 'vitest';
import type { LogisticsShipment, LogisticsShipmentLine } from '../../../lib/logisticsTypes';
import { formatCostTotals, formatPlanningMeasure, shipmentPlanningSummary, summarizeItemCosts } from './logisticsPlanning';

const line = (patch: Partial<LogisticsShipmentLine> = {}): LogisticsShipmentLine => ({
  id: 'tea', shipment_id: 's', purchase_id: 'p', receipt_line_id: 'r', product_id: 't', product_name: 'Golden Tips',
  unit: 'g', quantity: 1000, received_quantity: 0, weight_kg: null, weight_estimated: false,
  volume_m3: null, volume_estimated: false, image_url: null, source_url: null,
  original_cost_amount: 100, original_cost_currency: 'CNY', allocated_freight: null, ...patch,
});
const shipment = (patch: Partial<LogisticsShipment> = {}): LogisticsShipment => ({
  id: 's', logistics_company_id: 'c', logistics_company_name: 'Logistics', mode: 'sea', state: 'draft',
  outbound_courier: null, tracking_number: null, eta: null, created_at: '', dispatched_at: null,
  freight: null, freight_total: null, freight_estimated: true, freight_issue: null, lines: [line()],
  service_quote: { id: 'quote', logistics_company_id: 'c', logistics_company_name: 'Logistics', name: 'Boat', mode: 'sea', basis: 'm3', rate: 1800, currency: 'CNY', active: true }, ...patch,
});

describe('shipment planning', () => {
  it('groups original costs by shared currency aliases, preserves zero, and flags missing costs', () => {
    const goods = summarizeItemCosts([
      line(), line({ original_cost_amount: 0, original_cost_currency: 'Yuan' }),
      line({ original_cost_amount: 20, original_cost_currency: 'USD' }),
      line({ original_cost_amount: null }), line({ original_cost_currency: null }),
    ]);
    expect(goods).toEqual({ totals: [{ currency: 'USD', amount: 20 }, { currency: 'Yuan', amount: 100 }], missingCount: 2, complete: false });
    expect(formatCostTotals(goods)).toBe('20 USD + 100 Yuan · 2 items unpriced');
    expect(formatCostTotals(summarizeItemCosts([line({ original_cost_amount: 0 })]))).toBe('0 Yuan');
  });

  it('plans cubic metres for mixed items and prices the volume, never converting tea grams into packed kg', () => {
    const result = shipmentPlanningSummary(shipment({ lines: [line(), line({ id: 'cup', product_name: 'Porcelain cups', unit: 'unit', quantity: 4 })] }));
    expect(result.volume).toMatchObject({ total: 0.01, estimated: true, suggestedCount: 2, missingCount: 0 });
    expect(result.weight).toMatchObject({ total: null, missingCount: 2 });
    expect(result.freight).toMatchObject({ amount: 18, quantity: 0.01, basis: 'm3', rate: 1800, status: 'estimate', source: 'planning' });
    expect(formatPlanningMeasure(result.volume, 'm³')).toBe('0.01 m³ planning');
  });

  it('keeps a partial measurement out of the total and refuses a partial freight estimate', () => {
    const result = shipmentPlanningSummary(shipment({ lines: [line({ volume_m3: 0.01, weight_kg: 1.2 }), line({ id: 'unknown', product_name: 'Wooden tray', unit: 'unit', quantity: 1 })] }));
    expect(result.volume).toMatchObject({ total: null, knownTotal: 0.01, missingCount: 1 });
    expect(result.freight.amount).toBeNull();
    expect(formatPlanningMeasure(result.weight, 'kg')).toBe('1.2 kg known · 1 item unknown');
    expect(result.freight.issue).toContain('volume');
  });

  it('keeps measured packing and confirmed billed volume separate from suggested packing', () => {
    const result = shipmentPlanningSummary(shipment({
      lines: [line({ volume_m3: 0.01, volume_estimated: true })],
      freight: { basis: 'm3', rate: 1800, currency: 'CNY', billed_quantity: 0.08, total_amount: null, confirmed: true },
      freight_total: 144,
    }));
    expect(result.volume).toMatchObject({ total: 0.01, suggestedCount: 0, estimated: true });
    expect(result.freight).toMatchObject({ amount: 144, quantity: 0.08, status: 'confirmed', source: 'bill' });
    expect(formatPlanningMeasure(result.volume, 'm³')).toBe('0.01 m³ est.');
  });

  it('uses saved costs over a service quote and does not treat zero as missing', () => {
    const result = shipmentPlanningSummary(shipment({
      lines: [line({ volume_m3: 0 })], freight: { basis: 'm3', rate: 0, currency: 'CNY', billed_quantity: 0, total_amount: 0, confirmed: true },
      freight_total: 0,
    }));
    expect(result.volume.total).toBe(0);
    expect(result.lines[0].suggestedVolume).toBe(false);
    expect(result.freight).toMatchObject({ amount: 0, quantity: 0, rate: 0, status: 'confirmed' });
  });

  it('does not fill incomplete saved freight from an older service quote', () => {
    const result = shipmentPlanningSummary(shipment({ freight: { basis: 'kg', rate: null, currency: 'USD', billed_quantity: null, total_amount: null, confirmed: false } }));
    expect(result.freight).toMatchObject({ amount: null, currency: 'USD', basis: 'kg', rate: null, status: 'unknown' });
  });

  it('uses a fixed quote without inventing measurement, and requires a currency', () => {
    const base = shipment();
    const fixed = shipmentPlanningSummary({ ...base, service_quote: { ...base.service_quote!, basis: 'fixed', rate: 200 } });
    expect(fixed.freight).toMatchObject({ amount: 200, quantity: null, basis: 'fixed', status: 'estimate' });
    expect(shipmentPlanningSummary(shipment({ service_quote: null })).freight.amount).toBeNull();
    expect(shipmentPlanningSummary(shipment({ freight_total: 200, freight: { basis: 'fixed', rate: null, total_amount: 200, currency: null, billed_quantity: null, confirmed: true } })).freight.amount).toBeNull();
  });

  it('air freight needs packed weight and never derives kg from m³', () => {
    const base = shipment();
    const air = { ...base, mode: 'air' as const, service_quote: { ...base.service_quote!, mode: 'air' as const, basis: 'kg' as const, rate: 85 } };
    expect(shipmentPlanningSummary(air).freight.amount).toBeNull();
    const result = shipmentPlanningSummary({ ...air, lines: [line({ weight_kg: 1.2, weight_estimated: true })] });
    expect(result.freight).toMatchObject({ amount: 102, quantity: 1.2, basis: 'kg', status: 'estimate' });
  });
});
