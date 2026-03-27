export interface WhatsAppOrderItem {
  name: string;
  variant?: string;
  quantity: number;
  unit: string; // 'g', 'units', etc.
  price: string; // pre-formatted price string
  total: string; // pre-formatted total string
}

export interface WhatsAppMessageOptions {
  type: 'inquiry' | 'invoice' | 'purchase';
  ref?: string;
  date?: string;
  customerName?: string;
  customerContact?: string;
  customerLocation?: string;
  notes?: string;
  items: WhatsAppOrderItem[];
  subtotal: string;
  shipping?: string;
  total: string;
}

export function buildOrderMessage(opts: WhatsAppMessageOptions): string {
  const date = opts.date || new Date().toLocaleDateString();
  const lines: string[] = [];

  if (opts.type === 'inquiry') {
    lines.push('ORDER INQUIRY [TEAJIA]');
    if (opts.ref) lines.push(`Ref: ${opts.ref}`);
    lines.push(`Date: ${date}`, '');
    if (opts.customerName) {
      lines.push('CUSTOMER:');
      lines.push(`Name: ${opts.customerName}`);
      if (opts.customerContact) lines.push(`Contact: ${opts.customerContact}`);
      if (opts.customerLocation) lines.push(`Shipping To: ${opts.customerLocation}`);
      if (opts.notes) lines.push(`Notes: ${opts.notes}`);
      lines.push('');
    }
  } else if (opts.type === 'invoice') {
    lines.push('*Teajia Order*', '');
    if (opts.ref) lines.push(`*Invoice:* ${opts.ref}`);
    if (opts.customerName) lines.push(`*Customer:* ${opts.customerName}`);
    lines.push(`*Date:* ${date}`, '');
  } else if (opts.type === 'purchase') {
    lines.push('PURCHASE ORDER [TEAJIA]');
    lines.push(`Date: ${date}`);
    if (opts.customerName) lines.push(`Vendor: ${opts.customerName}`);
    lines.push('');
  }

  lines.push(opts.type === 'invoice' ? '*Items:*' : 'ITEMS:');
  opts.items.forEach(item => {
    const qty = `${item.quantity}${item.unit}`;
    if (opts.type === 'invoice') {
      lines.push(`\u2022 ${item.name} - ${qty} @ ${item.price} = ${item.total}`);
    } else {
      const variant = item.variant ? ` (${item.variant})` : '';
      lines.push(`- ${item.name}${variant}: ${qty} @ ${item.total}`);
    }
  });

  lines.push('');
  if (opts.type === 'invoice') {
    lines.push(`*Subtotal:* ${opts.subtotal}`);
    if (opts.shipping) lines.push(`*Shipping:* ${opts.shipping}`);
    lines.push(`*Total:* ${opts.total}`);
  } else {
    lines.push(`TOTAL ESTIMATE: ${opts.total}`);
    if (opts.type === 'inquiry') {
      lines.push('', 'Please confirm availability and shipping costs.');
    } else if (opts.type === 'purchase') {
      lines.push('', 'Please confirm availability and pricing.');
    }
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (clean.length < 7) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
