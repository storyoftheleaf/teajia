import { describe, expect, it } from 'vitest';
import { manifestCsv, manifestHtml, referenceUrl, type LogisticsManifest } from './logisticsManifest';
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
