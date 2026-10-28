/** @color-literals: the printable contents list leaves the app on white paper. */
export interface ManifestItem {
  supplier: string;
  purchase: string;
  product: string;
  quantity: number | null;
  unit: string;
  paidCost: number | null;
  currency: string | null;
  freight?: number | null;
  freightCurrency?: string | null;
  freightEstimated?: boolean;
  stage?: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  inboundTracking?: string | null;
  volumeM3?: number | null;
  volumeEstimated?: boolean;
}
export interface LogisticsManifest {
  title: string;
  company: string;
  mode?: string | null;
  outboundTracking?: string | null;
  items: ManifestItem[];
}
export function referenceUrl(value?: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]!);
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  // Spreadsheet programs may execute formula-like cells even when CSV quoted.
  const safe = /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function manifestCsv(manifest: LogisticsManifest): string {
  const headers = ['Logistics company', 'Shipment', 'Mode', 'Outbound tracking', 'Supplier', 'Purchase', 'Product', 'Quantity', 'Unit', 'Paid cost', 'Currency', 'Inbound tracking', 'Stage', 'Freight share', 'Freight currency', 'Freight status', 'Landed total (same currency)', 'Packed volume m3', 'Volume status', 'Reference image URL', 'Source URL'];
  return '\uFEFF' + [headers, ...manifest.items.map(item => [manifest.company, manifest.title, manifest.mode, manifest.outboundTracking, item.supplier, item.purchase, item.product, item.quantity, item.unit, item.paidCost, item.currency, item.inboundTracking, item.stage, item.freight, item.freightCurrency, item.freight == null ? '' : item.freightEstimated ? 'Estimate' : 'Confirmed', item.freight != null && item.paidCost != null && item.currency === item.freightCurrency ? item.paidCost + item.freight : null, item.volumeM3, item.volumeM3 == null ? '' : item.volumeEstimated ? 'Estimated' : 'Measured', referenceUrl(item.imageUrl), referenceUrl(item.sourceUrl)])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function manifestHtml(manifest: LogisticsManifest): string {
  const rows = manifest.items.map(item => {
    const image = referenceUrl(item.imageUrl);
    const source = referenceUrl(item.sourceUrl);
    return `<tr><td>${image ? `<img src="${escapeHtml(image)}" alt="Reference image for ${escapeHtml(item.product)}" referrerpolicy="no-referrer"><small>Reference image</small>` : '<small>No image recorded</small>'}</td><td><strong>${escapeHtml(item.product)}</strong><small>${escapeHtml(item.supplier)} · ${escapeHtml(item.purchase)}</small>${item.stage ? `<small>${escapeHtml(item.stage.replace(/_/g, ' '))}</small>` : ''}${source ? `<a href="${escapeHtml(source)}" rel="noreferrer">Source</a>` : ''}</td><td>${item.quantity == null ? 'Not recorded' : escapeHtml(item.quantity)} ${escapeHtml(item.unit)}${item.volumeM3 == null ? '' : `<small>${escapeHtml(item.volumeM3)} m³ · ${item.volumeEstimated ? 'Estimated' : 'Measured'}</small>`}</td><td>${item.paidCost == null ? 'Not recorded' : `${escapeHtml(item.paidCost)} ${escapeHtml(item.currency || 'Currency not recorded')}`}${item.freight != null ? `<small>Freight: ${escapeHtml(item.freight)} ${escapeHtml(item.freightCurrency)}${item.freightEstimated ? ' (estimate)' : ''}</small>${item.paidCost != null && item.currency === item.freightCurrency ? `<small>Landed: ${escapeHtml(item.paidCost + item.freight)} ${escapeHtml(item.currency)}</small>` : ''}` : ''}</td><td>${escapeHtml(item.inboundTracking || 'Not recorded')}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.title)}</title><style>body{font:14px/1.4 Arial,sans-serif;color:#222;background:#fff;margin:24px}h1{font-size:20px;margin-bottom:4px}p{margin:4px 0 16px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ccc;padding:8px;overflow-wrap:anywhere}th{font-size:12px}small{display:block;color:#555;margin-top:4px}img{width:70px;height:70px;object-fit:contain}a{color:#222}tr{break-inside:avoid}@media print{body{margin:0}}</style></head><body><h1>${escapeHtml(manifest.title)}</h1><p>${escapeHtml(manifest.company)}${manifest.mode ? ` · ${escapeHtml(manifest.mode)}` : ''}${manifest.outboundTracking ? ` · Tracking ${escapeHtml(manifest.outboundTracking)}` : ''}</p><table><thead><tr><th style="width:80px">Reference</th><th>Contents</th><th>Quantity</th><th>Paid cost</th><th>Inbound tracking</th></tr></thead><tbody>${rows}</tbody></table><p><small>Reference images identify the products; they are not evidence of packed contents. Paid cost is the recorded purchase cost and excludes onward freight; the freight share is shown separately. Landed totals appear only where both amounts use the same currency. Print this file from your browser, or send it with the CSV.</small></p></body></html>`;
}
export function downloadManifest(manifest: LogisticsManifest, format: 'csv' | 'html'): void {
  const blob = new Blob([format === 'csv' ? manifestCsv(manifest) : manifestHtml(manifest)], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${manifest.title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'contents'}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
