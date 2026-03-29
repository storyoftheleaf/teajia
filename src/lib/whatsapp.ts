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

/** Build a WhatsApp message for order status updates (confirmation, fulfillment, etc.) */
export function buildStatusMessage(opts: {
  status: 'confirmed' | 'filled' | 'shipped' | 'cancelled';
  ref?: string;
  customerName?: string;
  items?: WhatsAppOrderItem[];
  total?: string;
  note?: string;
}): string {
  const lines: string[] = [];

  const statusText: Record<typeof opts.status, string> = {
    confirmed: 'Your order has been confirmed',
    filled: 'Your order has been fulfilled and is ready',
    shipped: 'Your order has been shipped',
    cancelled: 'Your order has been cancelled',
  };

  lines.push(`*Teajia — Order Update*`, '');
  if (opts.customerName) lines.push(`Hi ${opts.customerName},`);
  lines.push(statusText[opts.status] + '.');
  if (opts.ref) lines.push(`*Ref:* ${opts.ref}`);

  if (opts.items && opts.items.length > 0) {
    lines.push('', '*Items:*');
    opts.items.forEach(item => {
      lines.push(`\u2022 ${item.name} — ${item.quantity}${item.unit}`);
    });
  }
  if (opts.total) lines.push('', `*Total:* ${opts.total}`);
  if (opts.note) lines.push('', opts.note);
  lines.push('', 'Thank you for choosing Teajia \ud83c\udf75');

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (clean.length < 7) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp with a pre-filled status update message */
export function openWhatsAppStatus(phone: string, opts: Parameters<typeof buildStatusMessage>[0]): void {
  const message = buildStatusMessage(opts);
  window.open(buildWhatsAppUrl(phone, message), '_blank');
}
