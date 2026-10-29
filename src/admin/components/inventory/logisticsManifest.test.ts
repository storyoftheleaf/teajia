import { describe, expect, it } from 'vitest';
import { manifestCsv, manifestHtml, manifestMessage, referenceUrl, type LogisticsManifest } from './logisticsManifest';
const manifest: LogisticsManifest = { title: 'Studio <air>', company: 'Forwarder', items: [{ supplier: '=IMPORT("bad")', purchase: 'PO-1', product: '<script>alert(1)</script>', quantity: 2, unit: 'pc', paidCost: 0, currency: 'CNY', inboundTracking: '@danger', imageUrl: 'javascript:alert(1)', sourceUrl: 'https://example.com/product?a=1&b=2' }] };
describe('logistics contents export', () => {
  it('retains zero paid cost, units, references and tracking while neutralising CSV formulas', () => {
    const csv = manifestCsv(manifest);
    expect(csv).toContain('"\'=IMPORT(""bad"")"');
    expect(csv).toContain('"\'@danger"');
    expect(csv).toContain('"2","pc","0","CNY"');
    expect(csv).toContain('https://example.com/product?a=1&b=2');
    expect(csv).not.toContain('javascript:');
  });
  it('escapes HTML and never fabricates a photo', () => {
    const html = manifestHtml(manifest);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('No image recorded');
    expect(html).toContain('0 CNY');
    expect(html).toContain('a=1&amp;b=2');
  });
  it('labels measured and estimated packed volumes separately in CSV and photo lists', () => {
    const measured = { ...manifest, items: [{ ...manifest.items[0], volumeM3: .02, volumeEstimated: false }] };
    expect(manifestCsv(measured)).toContain('"Packed volume m3","Volume status"');
    expect(manifestCsv(measured)).toContain('"0.02","Measured"');
    expect(manifestHtml(measured)).toContain('0.02 m³ · Measured');
    const estimated = { ...measured, items: [{ ...measured.items[0], volumeEstimated: true }] };
    expect(manifestCsv(estimated)).toContain('"0.02","Estimated"');
    expect(manifestHtml(estimated)).toContain('0.02 m³ · Estimated');
  });
  it('permits only web reference URLs', () => {
    expect(referenceUrl('data:image/png;base64,a')).toBeNull();
    expect(referenceUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
  });
});

describe('landed cost export', () => {
  it('shows recorded purchase cost and allocated freight without adding different currencies', () => {
    const same = { ...manifest, items: [{ ...manifest.items[0], paidCost: 40, freight: 10, freightCurrency: 'CNY', freightEstimated: true }] };
    expect(manifestHtml(same)).toContain('Landed: 50 CNY');
    expect(manifestHtml(same)).toContain('Freight: 10 CNY (estimate)');
    const different = { ...same, items: [{ ...same.items[0], freightCurrency: 'USD' }] };
    expect(manifestHtml(different)).not.toContain('Landed:');
    expect(manifestHtml(different)).toContain('Freight: 10 USD');
  });
});


describe('Chinese and English logistics message', () => {
  it('includes the recorded route, costs, measurements and tracking in both languages', () => {
    const text = manifestMessage({
      ...manifest, title: 'Studio shipment', mode: 'Boat', status: 'in_transit', outboundTracking: 'SEA-123', eta: '2026-11-18',
      freight: { basis: 'm3', rate: 1200, billed_quantity: .12, total_amount: 144, currency: 'CNY', confirmed: true }, freightTotal: 144,
      items: [{ ...manifest.items[0], product: '白瓷盖碗', inboundCourier: 'ZTO', inboundTracking: 'ZT-456', volumeM3: .006, volumeEstimated: true, weightKg: .4, weightEstimated: false, freight: 72, freightCurrency: 'CNY', freightEstimated: true }],
    });
    expect(text).toContain('物流公司 / Logistics company: Forwarder');
    expect(text).toContain('海运 / Sea freight');
    expect(text).toContain('运输中 / On the way');
    expect(text).toContain('SEA-123');
    expect(text).toContain('ZT-456');
    expect(text).toContain('2026-11-18');
    expect(text).toContain('1. 白瓷盖碗');
    expect(text).toContain('0 CNY');
    expect(text).toContain('0.006 m³ (估算 / estimate)');
    expect(text).toContain('0.4 kg (已测量 / measured)');
    expect(text).toContain('1,200 CNY / m³');
    expect(text).toContain('144 CNY (账单已确认 / bill confirmed)');
    expect(text).toContain('kilograms cannot be directly converted into cubic metres');
    expect(text).toContain('Product link: https://example.com/product');
  });
  it('keeps missing facts visibly unknown and does not invent an address or a freight rate', () => {
    const text = manifestMessage({ title: 'Warehouse list', company: 'Company', items: [{ ...manifest.items[0], paidCost: null, currency: null }] });
    expect(text).toContain('address not recorded; confirm before dispatch');
    expect(text).toContain('Expected arrival: 未记录 / Not recorded');
    expect(text).toContain('Freight total: 未记录 / Not recorded');
    expect(text).toContain('1 item(s) lack cost or currency; subtotal is incomplete.');
    expect(text).not.toContain('85');
    expect(text).not.toContain('javascript:');
  });
  it('identifies parcels by supplier and tracking without presenting internal UUIDs as order numbers', () => {
    const text = manifestMessage({ ...manifest, items: [{ ...manifest.items[0], purchase: 'b93e5701-2231-4ff1-9d13-676bbd997e9f', supplier: 'Tea shop', inboundTracking: 'SF123' }] });
    expect(text).toContain('Supplier: Tea shop');
    expect(text).toContain('Tracking: SF123');
    expect(text).not.toContain('b93e5701-2231-4ff1-9d13-676bbd997e9f');
    expect(manifestMessage(manifest)).toContain('Order: PO-1');
  });
  it('groups cost currencies using the shared aliases and never adds freight shares twice', () => {
    const items = [
      { ...manifest.items[0], product: 'Tea', paidCost: 10, currency: 'CNY', freight: 12, freightCurrency: 'CNY' },
      { ...manifest.items[0], product: 'Cup', paidCost: 20, currency: 'Yuan', freight: 12, freightCurrency: 'CNY' },
      { ...manifest.items[0], product: 'Tray', paidCost: 5, currency: 'USD' },
    ];
    const text = manifestMessage({ ...manifest, items, freightTotal: 24, freight: { basis: 'fixed', rate: null, billed_quantity: null, total_amount: 24, currency: 'CNY', confirmed: false } });
    expect(text).toContain('Recorded goods subtotal (by currency): 30 CNY + 5 USD');
    expect(text).toContain('Freight total: 24 CNY (估算 / estimate)');
    expect(text).not.toContain('54 CNY');
  });
});
