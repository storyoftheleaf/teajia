/** @color-literals: the printable contents list leaves the app on white paper. */
import { canonicalCurrency } from '../../../lib/currency';
import type { LogisticsFreight } from '../../../lib/logisticsTypes';
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
  weightKg?: number | null;
  weightEstimated?: boolean;
  inboundCourier?: string | null;
}
export interface LogisticsManifest {
  title: string;
  company: string;
  mode?: string | null;
  outboundTracking?: string | null;
  destination?: string | null;
  eta?: string | null;
  status?: string | null;
  freight?: LogisticsFreight | null;
  freightTotal?: number | null;
  freightPlanning?: boolean;
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


const messageNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 6 });
const messageUnknown = '未记录 / Not recorded';
const messageStatus: Record<string, string> = {
  draft: '待发货 / Ready to send', in_transit: '运输中 / On the way',
  partially_received: '工作室部分签收 / Part received at studio', received: '工作室已签收 / Received at studio',
  cancelled: '已取消 / Cancelled', 'At logistics': '已到集运仓 / At logistics warehouse',
  'To logistics': '等待到仓确认 / Awaiting warehouse arrival confirmation',
};
const messageMoney = (amount: number | null | undefined, currency: string | null | undefined) => amount == null
  ? messageUnknown : `${messageNumber(amount)} ${currency?.trim() || '币种未记录 / currency not recorded'}`;

/** Editable forwarding brief. It reports stored facts; it never books or dispatches goods. */
export function manifestMessage(manifest: LogisticsManifest): string {
  const freight = manifest.freight;
  const billedUnit = freight?.basis === 'm3' ? 'm³' : freight?.basis === 'kg' ? 'kg' : '';
  const lines = [
    `货物与运输清单 / Goods & shipping list: ${manifest.title}`,
    `物流公司 / Logistics company: ${manifest.company}`,
    `目的地 / Destination: ${manifest.destination || '艺术工作室（地址未记录，请发货前确认） / Art studio (address not recorded; confirm before dispatch)'}`,
    `运输方式 / Shipping method: ${manifest.mode === 'Boat' ? '海运 / Sea freight' : manifest.mode === 'Air' ? '空运 / Air freight' : manifest.mode || messageUnknown}`,
    `状态 / Status: ${manifest.status ? messageStatus[manifest.status] || manifest.status : '请核对下列包裹状态 / Check the parcel status below'}`,
    `出库运单号 / Outbound tracking: ${manifest.outboundTracking || messageUnknown}`,
    `预计到达 / Expected arrival: ${manifest.eta || messageUnknown}`,
    '', '商品明细 / Item details',
  ];
  const totals = new Map<string, { amount: number; label: string }>();
  let missingCosts = 0;
  manifest.items.forEach((item, index) => {
    const currency = item.currency?.trim();
    if (item.paidCost == null || !currency || canonicalCurrency(currency) === 'UNK') missingCosts++;
    else {
      const key = canonicalCurrency(currency) || currency;
      const existing = totals.get(key);
      totals.set(key, { amount: (existing?.amount || 0) + item.paidCost, label: existing?.label || currency });
    }
    lines.push(
      `${index + 1}. ${item.product}`,
      `供应商 / Supplier: ${item.supplier || messageUnknown}${/^PO[-\s]?\d+/i.test(item.purchase) ? ` · 订单 / Order: ${item.purchase}` : ''}`,
      `数量 / Quantity: ${item.quantity == null ? messageUnknown : messageNumber(item.quantity)} ${item.unit}`,
      `货款（此数量） / Goods cost (this quantity): ${messageMoney(item.paidCost, item.currency)}`,
      `到仓快递 / Inbound courier: ${item.inboundCourier || messageUnknown} · 运单号 / Tracking: ${item.inboundTracking || messageUnknown}`,
      `状态 / Status: ${item.stage ? messageStatus[item.stage] || item.stage : messageUnknown}`,
      `包装后重量 / Packed weight: ${item.weightKg == null ? messageUnknown : `${messageNumber(item.weightKg)} kg (${item.weightEstimated ? '估算 / estimate' : '已测量 / measured'})`}`,
      `包装后体积 / Packed volume: ${item.volumeM3 == null ? messageUnknown : `${messageNumber(item.volumeM3)} m³ (${item.volumeEstimated ? '估算 / estimate' : '已测量 / measured'})`}`,
    );
    if (item.freight != null) lines.push(`分摊运费 / Allocated freight: ${messageMoney(item.freight, item.freightCurrency)} (${item.freightEstimated ? '估算 / estimate' : '已记录 / recorded'})`);
    const image = referenceUrl(item.imageUrl); const source = referenceUrl(item.sourceUrl);
    if (image) lines.push(`商品参考图 / Reference photo: ${image}`);
    if (source) lines.push(`商品链接 / Product link: ${source}`);
    lines.push('');
  });
  lines.push(
    `已记录货款合计（按币种） / Recorded goods subtotal (by currency): ${totals.size ? [...totals.values()].map(total => messageMoney(total.amount, total.label)).join(' + ') : messageUnknown}`,
  );
  if (missingCosts) lines.push(`${missingCosts} 项货款或币种未记录；合计不完整。 / ${missingCosts} item(s) lack cost or currency; subtotal is incomplete.`);
  lines.push(
    `计费方式 / Freight basis: ${freight ? freight.basis === 'm3' ? '按立方米 / per m³' : freight.basis === 'kg' ? '按公斤 / per kg' : '整票运费 / fixed bill' : messageUnknown}`,
    `运费单价 / Freight rate: ${freight?.basis === 'fixed' ? '不适用 / Not applicable' : `${messageMoney(freight?.rate, freight?.currency)}${billedUnit ? ` / ${billedUnit}` : ''}`}`,
    `${manifest.freightPlanning ? '估算计费数量 / Planning quantity' : '计费数量 / Billable quantity'}: ${freight?.billed_quantity == null ? messageUnknown : `${messageNumber(freight.billed_quantity)} ${billedUnit}`}`,
    `运费合计 / Freight total: ${messageMoney(manifest.freightTotal ?? freight?.total_amount, freight?.currency)}${manifest.freightTotal != null || freight?.total_amount != null ? ` (${freight?.confirmed ? '账单已确认 / bill confirmed' : '估算 / estimate'})` : ''}`,
    '',
    '请核对各入库运单、实收品名和数量，并提供合箱后的外箱尺寸、毛重、计费体积、运费及其他费用明细。发货前请确认收货地址、运输方式和预计到达时间；发出后请提供出库运单号。',
    'Please check each inbound tracking number against the goods and quantities received. Provide the consolidated carton dimensions, gross weight, billable volume, freight and other charges separately. Confirm the delivery address, shipping method and ETA before dispatch, then provide the outbound tracking number.',
    '',
    '按立方米计费时，运费为计费体积 × 每立方米单价；公斤数不能直接换算为立方米。估算需以物流公司测量及最终报价为准。',
    'For volume-based freight, cost is billable m³ × rate per m³; kilograms cannot be directly converted into cubic metres. Estimates require the logistics company’s measurements and final quotation.',
    '商品名称保留原文，未自动翻译。',
    'Product names are kept as recorded, without automatic translation.',
  );
  return lines.join('\n');
}
export function downloadMessage(title: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'logistics'}-message.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
